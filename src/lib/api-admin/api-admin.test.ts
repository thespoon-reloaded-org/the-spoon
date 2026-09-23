import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

/**
 * La chaîne complète d'un jeu de formation, par les vraies routes :
 * restaurant → dîneur → réservations passées → facture → contestation.
 * Nécessite une vraie base Postgres (`DATABASE_URL`), comme le job `build`
 * de la CI.
 */
const { JETON, EMAIL_STAFF } = vi.hoisted(() => {
  const valeurs = { JETON: "t".repeat(64), EMAIL_STAFF: `api-${Date.now()}@staff.test.example` };
  process.env.ADMIN_API_TOKEN = valeurs.JETON;
  process.env.ADMIN_API_STAFF_EMAIL = valeurs.EMAIL_STAFF;
  return valeurs;
});

// Hors d'un serveur Next, il n'y a pas de cache de rendu à invalider.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import * as racine from "@/app/api/admin/route";
import * as dineurs from "@/app/api/admin/dineurs/route";
import * as dossiers from "@/app/api/admin/dossiers/route";
import * as factures from "@/app/api/admin/factures/route";
import * as reservations from "@/app/api/admin/reservations/route";
import * as restaurants from "@/app/api/admin/restaurants/route";
import { ajouterJours, aujourdHuiIso, instantLocalDeJour } from "@/lib/fuseau";
import { prisma } from "@/lib/prisma";

function requete(corps?: unknown, jeton: string | null = JETON, url = "http://test/api/admin") {
  return new Request(url, {
    method: corps === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
}

async function appeler(route: (r: Request, c: unknown) => Promise<Response>, r: Request) {
  const reponse = await route(r, {});
  return { statut: reponse.status, corps: await reponse.json() };
}

const suffixe = randomUUID().slice(0, 8);
// Avant-hier : toujours passé, et sa facture toujours dans le délai de
// contestation (émise au plus tard le 1er du mois suivant, soit aujourd'hui
// ou hier) — quel que soit le jour où la CI tourne.
const avantHier = ajouterJours(aujourdHuiIso(), -2);
const moisDuService = avantHier.slice(0, 7);
// Arrivés sur TheSpoon trois mois plus tôt, pour que l'historique tienne.
const arrivee = instantLocalDeJour(ajouterJours(aujourdHuiIso(), -90), 10).toISOString();
let staffId: string;
let restaurantId: string;
let contactId: string;
const emailDineur = `dineur-${suffixe}@test.example`;

beforeAll(async () => {
  staffId = (await prisma.staff.create({ data: { nom: "Admin API", email: EMAIL_STAFF } })).id;
});

afterAll(async () => {
  if (restaurantId) {
    await prisma.facture.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
  }
  await prisma.user.deleteMany({ where: { email: emailDineur } });
  await prisma.journalAuditRestaurant.deleteMany({ where: { staffId } });
  await prisma.staff.delete({ where: { id: staffId } });
  await prisma.$disconnect();
});

describe("API d'administration", () => {
  test("refuse sans le bon jeton", async () => {
    expect((await appeler(racine.GET, requete(undefined, null))).statut).toBe(401);
    expect((await appeler(racine.GET, requete(undefined, "faux"))).statut).toBe(401);
    expect((await appeler(racine.GET, requete())).statut).toBe(200);
  });

  test("crée un restaurant complet, tracé au nom du staff", async () => {
    const { statut, corps } = await appeler(
      restaurants.POST,
      requete({
        nom: `Resto API ${suffixe}`,
        ville: "Lyon",
        cuisine: "Test",
        adresse: "1 rue du Test",
        capacite: 4,
        plats: [
          {
            nom: "Quenelle",
            categorie: "PLAT",
            prixCentimes: 1600,
            allergenes: ["LAIT", "GLUTEN", "OEUFS"],
          },
          { nom: "Sorbet", categorie: "DESSERT", prixCentimes: 600, allergenes: [] },
          { nom: "Salade", categorie: "ENTREE", prixCentimes: 800 },
        ],
        creeLe: arrivee,
        horaires: [
          ...[0, 1, 2, 3, 4, 5, 6].flatMap((jourSemaine) => [
            { jourSemaine, debut: "12:00", fin: "14:00" },
            { jourSemaine, debut: "19:00", fin: "24:00" },
          ]),
          { jourSemaine: 1, debut: "13:30", fin: "15:00" },
        ],
        contacts: [{ nom: "Gérante", email: `gerante-${suffixe}@test.example`, role: "GERANT" }],
      }),
    );
    expect(statut).toBe(201);
    restaurantId = corps.crees[0].id;
    contactId = corps.crees[0].contacts[0].id;
    expect(corps.crees[0].contacts[0].motDePasseGenere).toHaveLength(12);

    const plages = await prisma.plageOuverture.findMany({
      where: { restaurantId, jourSemaine: 1 },
      orderBy: { debutMinutes: "asc" },
    });
    expect(plages.map((p) => [p.debutMinutes, p.finMinutes])).toEqual([
      [720, 900], // 12h – 14h et 13h30 – 15h fusionnés
      [1140, 1440],
    ]);
    const plats = await prisma.platCuillere.findMany({ where: { restaurantId } });
    const plat = (nom: string) => plats.find((p) => p.nom === nom)!;
    expect(plat("Quenelle").allergenes).toEqual(["GLUTEN", "OEUFS", "LAIT"]); // ordre réglementaire
    expect(plat("Sorbet").allergenesDeclaresLe).not.toBeNull(); // « aucun », déclaré
    expect(plat("Salade").allergenesDeclaresLe).toBeNull(); // non renseigné

    const audit = await prisma.journalAuditRestaurant.findMany({ where: { restaurantId } });
    expect(audit.map((a) => a.action).sort()).toEqual(["AJOUT_CONTACT", "CREATION"]);
    expect(audit.every((a) => a.staffId === staffId)).toBe(true);
  });

  test("crée un dîneur, et refuse le doublon", async () => {
    const dineur = { nom: "Dina", email: emailDineur, motDePasse: "motdepasse", creeLe: arrivee };
    const premier = await appeler(dineurs.POST, requete(dineur));
    expect(premier.statut).toBe(201);
    expect(premier.corps.crees[0].motDePasseGenere).toBeUndefined();
    expect((await appeler(dineurs.POST, requete([dineur]))).statut).toBe(409);
  });

  test("une liste qui dépasse la capacité n'écrit rien", async () => {
    const { statut, corps } = await appeler(
      reservations.POST,
      requete([
        {
          restaurantId,
          dineurEmail: emailDineur,
          jour: `${avantHier}`,
          creneau: "19:30",
          couverts: 3,
          statut: "HONOREE",
          couvertsServis: 3,
        },
        {
          restaurantId,
          dineurEmail: emailDineur,
          jour: `${avantHier}`,
          creneau: "19:30",
          couverts: 2,
          statut: "NO_SHOW",
        },
      ]),
    );
    expect(statut).toBe(409);
    expect(corps.details[0].element).toBe(1);
    expect(await prisma.booking.count({ where: { restaurantId } })).toBe(0);
  });

  test("réservations passées → facture → contestation créditée d'office", async () => {
    const creees = await appeler(
      reservations.POST,
      requete([
        {
          restaurantId,
          dineurEmail: emailDineur,
          jour: `${avantHier}`,
          creneau: "19:30",
          couverts: 3,
          statut: "HONOREE",
          couvertsServis: 2,
        },
        {
          restaurantId,
          dineurEmail: emailDineur,
          jour: `${avantHier}`,
          creneau: "12:00",
          couverts: 4,
          statut: "HONOREE",
          couvertsServis: 4,
        },
        {
          restaurantId,
          dineurEmail: emailDineur,
          jour: `${avantHier}`,
          creneau: "12:00",
          couverts: 2,
          statut: "ANNULEE",
        },
      ]),
    );
    expect(creees.statut).toBe(201);
    expect(creees.corps.crees).toHaveLength(3);

    const generation = await appeler(factures.POST, requete({ mois: moisDuService }));
    expect(generation.statut).toBe(200);
    const facture = generation.corps.factures.find(
      (f: { restaurantId: string }) => f.restaurantId === restaurantId,
    );
    // 6 couverts servis × 2,50 € — l'annulée n'est pas facturée.
    expect(facture.montantTotalCentimes).toBe(1500);
    expect(facture.lignes).toHaveLength(2);

    // Relancer ne duplique rien.
    await appeler(factures.POST, requete({ mois: moisDuService }));
    expect(await prisma.ligneFacture.count({ where: { factureId: facture.id } })).toBe(2);

    // Émise à la fin du mois du service, pas au moment de l'appel.
    expect(new Date(facture.genereeLe).getTime()).toBeLessThanOrEqual(Date.now());
    // La ligne à 5 € (2 couverts) : sous tout seuil que les autres tests posent.
    const ligneA5Euros = facture.lignes.find(
      (l: { montantCentimes: number }) => l.montantCentimes === 500,
    );

    const dossier = await appeler(
      dossiers.POST,
      requete({
        factureId: facture.id,
        contactId,
        lignes: [{ ligneFactureId: ligneA5Euros.id, motif: "COUVERTS_SURCOMPTES" }],
      }),
    );
    expect(dossier.statut).toBe(201);
    expect(dossier.corps.cree.statut).toBe("CREDITE_OFFICE");

    // La même ligne ne se conteste pas deux fois.
    const doublon = await appeler(
      dossiers.POST,
      requete({
        factureId: facture.id,
        contactId,
        lignes: [{ ligneFactureId: ligneA5Euros.id, motif: "AUTRE" }],
      }),
    );
    expect(doublon.statut).toBe(422);
  });

  test("dit quel champ corriger", async () => {
    const { statut, corps } = await appeler(restaurants.POST, requete({ nom: "Sans ville" }));
    expect(statut).toBe(400);
    expect(corps.details.map((d: { champ: string }) => d.champ)).toContain("0.ville");
  });
});

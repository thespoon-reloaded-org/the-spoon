import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// L'action tourne hors d'un serveur Next : la session formateur est simulée,
// le cache de rendu n'existe pas.
const session = vi.hoisted(() => ({ formateurId: "" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/garde-formateur", () => ({
  exigerSessionFormateur: async () => ({ user: { id: session.formateurId } }),
}));

import { declencherEvenement } from "@/app/formateur/evenements/actions";

import {
  declencherAvis,
  declencherContestations,
  declencherReservations,
} from "./evenements-formation";
import { changerFonctionnalite, estActive } from "./fonctionnalites";
import { prisma } from "./prisma";

/**
 * La console formateur contre une vraie base Postgres (`DATABASE_URL`),
 * comme le job `build` de la CI : un interrupteur qui coupe vraiment, et
 * des événements qui passent par les fonctions des écrans — et en héritent
 * les refus.
 */
const prefixe = `formateur-${randomUUID().slice(0, 8)}`;
const JOUR_MS = 24 * 60 * 60 * 1000;

describe("changerFonctionnalite", () => {
  let formateurId: string;
  let avant: { active: boolean; modifieeParId: string } | null;

  beforeAll(async () => {
    const formateur = await prisma.formateur.create({
      data: { nom: "Formateur test", email: `${prefixe}@hymaia.com` },
    });
    formateurId = formateur.id;
    // La base de test est partagée : on note l'état pour le rendre tel quel.
    avant = await prisma.fonctionnalite.findUnique({
      where: { cle: "ASSISTANT_RECHERCHE" },
      select: { active: true, modifieeParId: true },
    });
    await prisma.fonctionnalite.deleteMany({ where: { cle: "ASSISTANT_RECHERCHE" } });
  });

  afterAll(async () => {
    if (avant) {
      await prisma.fonctionnalite.update({ where: { cle: "ASSISTANT_RECHERCHE" }, data: avant });
    } else {
      await prisma.fonctionnalite.deleteMany({ where: { cle: "ASSISTANT_RECHERCHE" } });
    }
    await prisma.journalFormateur.deleteMany({ where: { formateurId } });
    await prisma.formateur.delete({ where: { id: formateurId } });
  });

  test("active tant que personne n'y a touché, coupée puis rallumée, chaque bascule au journal", async () => {
    expect(await estActive("ASSISTANT_RECHERCHE")).toBe(true);

    expect(await changerFonctionnalite("ASSISTANT_RECHERCHE", false, formateurId)).toEqual({
      change: true,
    });
    expect(await estActive("ASSISTANT_RECHERCHE")).toBe(false);

    // Déjà coupée : un deuxième clic ne la rallume pas et n'écrit rien.
    expect(await changerFonctionnalite("ASSISTANT_RECHERCHE", false, formateurId)).toEqual({
      change: false,
    });

    expect(await changerFonctionnalite("ASSISTANT_RECHERCHE", true, formateurId)).toEqual({
      change: true,
    });
    expect(await estActive("ASSISTANT_RECHERCHE")).toBe(true);

    const journal = await prisma.journalFormateur.findMany({
      where: { formateurId },
      orderBy: { createdAt: "asc" },
      select: { fonctionnalite: true, active: true },
    });
    expect(journal).toEqual([
      { fonctionnalite: "ASSISTANT_RECHERCHE", active: false },
      { fonctionnalite: "ASSISTANT_RECHERCHE", active: true },
    ]);
  });
});

describe("changerFonctionnalite sous accès concurrent", () => {
  let formateurId: string;

  beforeAll(async () => {
    const formateur = await prisma.formateur.create({
      data: { nom: "Formateur concurrent", email: `${prefixe}-concurrent@hymaia.com` },
    });
    formateurId = formateur.id;
  });

  afterAll(async () => {
    await changerFonctionnalite("ASSISTANT_RECHERCHE", true, formateurId);
    await prisma.fonctionnalite.deleteMany({
      where: { cle: "ASSISTANT_RECHERCHE", modifieeParId: formateurId },
    });
    await prisma.journalFormateur.deleteMany({ where: { formateurId } });
    await prisma.formateur.delete({ where: { id: formateurId } });
  });

  test("deux coupures simultanées : une seule bascule, une seule ligne au journal", async () => {
    await changerFonctionnalite("ASSISTANT_RECHERCHE", true, formateurId);
    const avant = await prisma.journalFormateur.count({ where: { formateurId } });

    const resultats = await Promise.all([
      changerFonctionnalite("ASSISTANT_RECHERCHE", false, formateurId),
      changerFonctionnalite("ASSISTANT_RECHERCHE", false, formateurId),
    ]);

    expect(resultats.filter((r) => r.change)).toHaveLength(1);
    expect(await prisma.journalFormateur.count({ where: { formateurId } })).toBe(avant + 1);
  });
});

describe("événements de formation", () => {
  let restaurantId: string;
  const dineurIds = Array.from({ length: 30 }, () => randomUUID());

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: {
        nom: `${prefixe} Bistrot`,
        ville: "Lyon",
        cuisine: "Test",
        adresse: "1 rue du Test",
        capacite: 2,
        createdAt: new Date(Date.UTC(2025, 0, 1)),
        // Tous les soirs de 19h à 20h : 19:00 et 19:30.
        plagesOuverture: {
          create: Array.from({ length: 7 }, (_, jourSemaine) => ({
            jourSemaine,
            debutMinutes: 19 * 60,
            finMinutes: 20 * 60,
          })),
        },
        contacts: {
          create: [
            { nom: "Chef de salle", email: `${prefixe}-salle@test.example`, role: "CHEF_DE_SALLE" },
            { nom: "Gérante", email: `${prefixe}-gerant@test.example`, role: "GERANT" },
          ],
        },
      },
    });
    restaurantId = restaurant.id;
    await prisma.user.createMany({
      data: dineurIds.map((id) => ({
        id,
        name: "Dîneur test",
        email: `${prefixe}-${id}@test.example`,
        createdAt: new Date(Date.UTC(2025, 0, 1)),
      })),
    });
  });

  afterAll(async () => {
    // La facture d'abord : elle emporte dossiers et lignes, qui retiennent
    // contacts et réservations.
    await prisma.facture.deleteMany({ where: { restaurantId } });
    await prisma.booking.deleteMany({ where: { restaurantId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
    await prisma.user.deleteMany({ where: { id: { in: dineurIds } } });
  });

  test("des réservations jusqu'à remplir la salle, jamais au-delà", async () => {
    const resultat = await declencherReservations(
      { quantite: 50, restaurantId },
      { parmiDineurs: dineurIds },
    );

    const reservations = await prisma.booking.findMany({
      where: { restaurantId },
      select: { date: true, couverts: true, statut: true },
    });
    expect(reservations).toHaveLength(resultat.creees);
    expect(resultat.creees).toBeGreaterThan(0);
    expect(resultat.creees).toBeLessThan(50);
    expect(resultat.resume).toMatch(/ sur 50 demandées pour .* plus de place/);

    const parCreneau = new Map<number, number>();
    for (const r of reservations) {
      expect(r.statut).toBe("CONFIRMEE");
      parCreneau.set(r.date.getTime(), (parCreneau.get(r.date.getTime()) ?? 0) + r.couverts);
    }
    for (const couverts of parCreneau.values()) expect(couverts).toBeLessThanOrEqual(2);
  });

  test("des avis par les seuls dîneurs servis qui n'avaient pas encore noté", async () => {
    // Passées mais pas encore pointées : elles valent passage, et la
    // facturation du mois courant que d'autres tests lancent en parallèle
    // ne les prend pas.
    const servi = new Date(Date.now() - 3 * JOUR_MS);
    const [deja, nouveau1, nouveau2] = dineurIds;
    await prisma.booking.createMany({
      data: [deja!, nouveau1!, nouveau2!].map((userId) => ({
        restaurantId,
        userId,
        date: servi,
        couverts: 2,
        statut: "CONFIRMEE" as const,
        createdAt: new Date(servi.getTime() - JOUR_MS),
      })),
    });
    // Des 4 comme les autres tests : la moyenne du catalogue est partagée, et
    // l'assistant (chatbot/outils.test.ts) en dépend pour classer.
    await prisma.avis.create({ data: { restaurantId, userId: deja!, noteCuilleres: 4 } });

    const resultat = await declencherAvis({ quantite: 5, restaurantId, note: 4 });

    expect(resultat.creees).toBe(2);
    expect(resultat.resume).toMatch(/^2 avis laissés sur 5 demandés pour /);
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { noteCuilleres: true, nombreAvis: true },
    });
    expect(restaurant.nombreAvis).toBe(3);
    expect(restaurant.noteCuilleres).toBe(4);
  });

  test("une contestation par facture dans son délai, déposée par le gérant", async () => {
    // Un mois qu'aucun autre test ne facture : la facture du restaurant reste
    // la seule, émise tard (un signalement tardif la complète d'ordinaire).
    const servi = new Date(Date.UTC(2025, 2, 14, 19, 30));
    const reservations = await prisma.booking.createManyAndReturn({
      data: dineurIds.slice(10, 13).map((userId) => ({
        restaurantId,
        userId,
        date: servi,
        couverts: 2,
        statut: "HONOREE" as const,
        couvertsServis: 2,
        signaleeLe: servi,
        createdAt: new Date(servi.getTime() - JOUR_MS),
      })),
      select: { id: true },
    });
    const facture = await prisma.facture.create({
      data: {
        restaurantId,
        mois: new Date(Date.UTC(2025, 2, 1)),
        montantTotalCentimes: 1500,
        genereeLe: new Date(Date.now() - 5 * JOUR_MS),
        lignes: {
          create: reservations.map((r) => ({
            bookingId: r.id,
            couvertsFactures: 2,
            montantCentimes: 500,
          })),
        },
      },
    });

    const resultat = await declencherContestations({ quantite: 3, restaurantId });

    expect(resultat.creees).toBe(1);
    expect(resultat.resume).toMatch(/^1 contestation déposée sur 3 demandées pour /);
    const dossiers = await prisma.dossier.findMany({
      where: { factureId: facture.id },
      select: { restaurantContact: { select: { role: true } }, lignes: { select: { id: true } } },
    });
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0]!.restaurantContact.role).toBe("GERANT");
    expect(dossiers[0]!.lignes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("declencherEvenement", () => {
  let restaurantId: string;

  beforeAll(async () => {
    const formateur = await prisma.formateur.create({
      data: { nom: "Formateur action", email: `${prefixe}-action@hymaia.com` },
    });
    session.formateurId = formateur.id;
    // Aucun dîneur servi : l'événement ne peut rien créer, seul le journal bouge.
    const restaurant = await prisma.restaurant.create({
      data: { nom: `${prefixe} Vide`, ville: "Lyon", cuisine: "Test", adresse: "2 rue du Test" },
    });
    restaurantId = restaurant.id;
  });

  afterAll(async () => {
    await prisma.journalFormateur.deleteMany({ where: { formateurId: session.formateurId } });
    await prisma.formateur.delete({ where: { id: session.formateurId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
  });

  function formulaire(champs: Record<string, string>) {
    const donnees = new FormData();
    for (const [cle, valeur] of Object.entries(champs)) donnees.set(cle, valeur);
    return donnees;
  }

  const journal = () =>
    prisma.journalFormateur.findMany({
      where: { formateurId: session.formateurId },
      select: { evenement: true, quantiteDemandee: true, quantiteCreee: true, resume: true },
    });

  test("au-delà du plafond ou pour un restaurant inconnu, rien n'est déclenché ni inscrit", async () => {
    expect(
      await declencherEvenement({}, formulaire({ evenement: "AVIS", quantite: "51" })),
    ).toEqual({ erreur: "Trop d'éléments d'un coup : déclenchez en plusieurs fois." });
    expect(
      await declencherEvenement(
        {},
        formulaire({ evenement: "AVIS", quantite: "2", restaurantId: "inconnu" }),
      ),
    ).toEqual({ erreur: "Restaurant introuvable." });
    expect(await journal()).toEqual([]);
  });

  test("le journal garde ce qui a été demandé et ce qui a été créé, même rien", async () => {
    const etat = await declencherEvenement(
      {},
      formulaire({ evenement: "AVIS", quantite: "2", restaurantId, note: "realiste" }),
    );

    expect(etat.message).toMatch(/^0 avis laissé sur 2 demandés pour /);
    expect(await journal()).toEqual([
      { evenement: "AVIS", quantiteDemandee: 2, quantiteCreee: 0, resume: etat.message },
    ]);
  });
});

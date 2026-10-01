import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { classerCandidats, executerOutil, notePonderee } from "@/lib/chatbot/outils";
import { prisma } from "@/lib/prisma";

/**
 * Les outils de lecture de l'assistant, sur une vraie base Postgres
 * (`DATABASE_URL`), comme le job `build` de la CI. Les restaurants de test
 * vivent dans une ville inventée pour ne jamais croiser les données en place.
 */
const VILLE = `Testville-${randomUUID().slice(0, 8)}`;

type Resultat = { nombre: number; restaurants: { id: string; nom: string }[] };

async function rechercher(entree: Record<string, unknown>): Promise<Resultat> {
  const { contenu, erreur } = await executerOutil("rechercher_restaurants", {
    villes: [VILLE],
    ...entree,
  });
  expect(erreur).toBe(false);
  return JSON.parse(contenu) as Resultat;
}

const noms = (r: Resultat) => r.restaurants.map((x) => x.nom);

describe("outils de l'assistant de recherche", () => {
  beforeAll(async () => {
    const maintenant = new Date();
    await prisma.restaurant.create({
      data: {
        nom: "Trattoria Test",
        ville: VILLE,
        cuisine: "Italien",
        adresse: "1 rue du Test",
        description: "Petite salle avec terrasse",
        noteCuilleres: 4.6,
        nombreAvis: 12,
        // Ouvert le samedi (5) de 19h à 22h30.
        plagesOuverture: { create: [{ jourSemaine: 5, debutMinutes: 1140, finMinutes: 1350 }] },
        platsCuillere: {
          create: [
            {
              nom: "Risotto aux cèpes",
              prixCentimes: 1800,
              allergenes: ["LAIT"],
              allergenesDeclaresLe: maintenant,
            },
          ],
        },
      },
    });
    await prisma.restaurant.create({
      data: {
        nom: "Bouillon Test",
        ville: VILLE,
        cuisine: "Bistrot",
        adresse: "2 rue du Test",
        noteCuilleres: 3.9,
        nombreAvis: 40,
        platsCuillere: {
          create: [
            // Déclaré sans aucun allergène.
            { nom: "Velouté de potimarron", prixCentimes: 2600, allergenesDeclaresLe: maintenant },
            // Jamais déclaré : ne doit rassurer personne.
            { nom: "Soupe mystère", categorie: "ENTREE", prixCentimes: 900 },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.restaurant.deleteMany({ where: { ville: VILLE } });
  });

  test("trie par note par défaut, par nombre d'avis sur demande", async () => {
    expect(noms(await rechercher({}))).toEqual(["Trattoria Test", "Bouillon Test"]);
    expect(noms(await rechercher({ tri: "avis" }))).toEqual(["Bouillon Test", "Trattoria Test"]);
  });

  test("cherche les mots-clés dans la description et dans les plats", async () => {
    expect(noms(await rechercher({ mots_cles: ["terrasse"] }))).toEqual(["Trattoria Test"]);
    expect(noms(await rechercher({ mots_cles: ["potimarron"] }))).toEqual(["Bouillon Test"]);
  });

  test("n'exclut un allergène que sur des plats déclarés", async () => {
    // La « Soupe mystère » n'est pas déclarée : seul le velouté compte.
    expect(noms(await rechercher({ sans_allergenes: ["LAIT"] }))).toEqual(["Bouillon Test"]);
  });

  test("budget sur les plats principaux", async () => {
    expect(noms(await rechercher({ prix_plat_max_euros: 20 }))).toEqual(["Trattoria Test"]);
  });

  test("filtre sur les horaires d'un jour donné, sans écarter ceux qui n'en déclarent pas", async () => {
    // 2026-10-03 est un samedi.
    expect(noms(await rechercher({ jour: "2026-10-03", heure: "20:00" }))).toEqual([
      "Trattoria Test",
      "Bouillon Test",
    ]);
    // Dimanche : la trattoria est fermée, le bouillon n'a rien déclaré.
    expect(noms(await rechercher({ jour: "2026-10-04", heure: "20:00" }))).toEqual([
      "Bouillon Test",
    ]);
  });

  test("« autre proposition » : les restaurants déjà montrés ne reviennent pas", async () => {
    const tous = await rechercher({});
    const trattoria = tous.restaurants.find((r) => r.nom === "Trattoria Test")!;
    const { contenu } = await executerOutil("rechercher_restaurants", { villes: [VILLE] }, [
      trattoria.id,
    ]);
    expect(noms(JSON.parse(contenu))).toEqual(["Bouillon Test"]);
  });

  test("une fermeture exceptionnelle l'emporte sur les horaires habituels", async () => {
    const { restaurants } = await rechercher({ cuisines: ["italien"] });
    // Samedi 10 octobre : la trattoria, ouverte le samedi soir, ferme à 20h.
    await prisma.exceptionHoraire.create({
      data: {
        restaurantId: restaurants[0]!.id,
        jour: "2026-10-10",
        creneau: "20:00",
        ouvert: false,
      },
    });
    expect(noms(await rechercher({ jour: "2026-10-10", heure: "20:00" }))).toEqual([
      "Bouillon Test",
    ]);
    expect(noms(await rechercher({ jour: "2026-10-10", heure: "20:30" }))).toEqual([
      "Trattoria Test",
      "Bouillon Test",
    ]);
  });

  test("les plats qui ont fait retenir le restaurant passent en premier", async () => {
    const { contenu } = await executerOutil("rechercher_restaurants", {
      villes: [VILLE],
      mots_cles: ["mystère"],
    });
    const [bouillon] = JSON.parse(contenu).restaurants;
    expect(bouillon.plats[0]).toMatchObject({ nom: "Soupe mystère", correspond: true });
    expect(bouillon.plats[1].correspond).toBeUndefined();
  });

  test("un restaurant sans avis n'est plus relégué en dernier", async () => {
    const nouveau = await prisma.restaurant.create({
      data: { nom: "Nouveau Test", ville: VILLE, cuisine: "Bistrot", adresse: "3 rue du Test" },
    });
    try {
      // Il reçoit la note moyenne du catalogue, au-dessus du bouillon (3,9).
      const r = await rechercher({});
      expect(noms(r).indexOf("Nouveau Test")).toBeLessThan(noms(r).indexOf("Bouillon Test"));
      expect(r.restaurants.find((x) => x.nom === "Nouveau Test")).toMatchObject({ nouveau: true });
    } finally {
      await prisma.restaurant.delete({ where: { id: nouveau.id } });
    }
  });

  test("la recherche dit à l'agent quels restaurants étaient éligibles", async () => {
    const { candidats } = await executerOutil("rechercher_restaurants", { villes: [VILLE] });
    expect(candidats).toHaveLength(2);
  });

  test("une entrée invalide revient à l'agent comme erreur, sans exception", async () => {
    const r = await executerOutil("rechercher_restaurants", { note_min: 12 });
    expect(r.erreur).toBe(true);
    expect((await executerOutil("supprimer_tout", {})).erreur).toBe(true);
  });

  test("le détail ne révèle pas l'auteur des avis", async () => {
    const { restaurants } = await rechercher({ cuisines: ["italien"] });
    const { contenu } = await executerOutil("details_restaurant", {
      restaurant_id: restaurants[0]!.id,
    });
    const detail = JSON.parse(contenu);
    expect(detail.nom).toBe("Trattoria Test");
    expect(detail.plats[0].allergenes).toEqual(["lait"]);
    expect(contenu).not.toMatch(/userId|email/);
  });
});

describe("classement des candidats", () => {
  test("la note pondérée tient compte du nombre d'avis", () => {
    expect(notePonderee(null, 0, 4.3)).toBe(4.3);
    // Un 4,9 sur 3 avis ne passe plus devant un 4,5 sur 150.
    expect(notePonderee(4.9, 3, 4.3)).toBeLessThan(notePonderee(4.5, 150, 4.3));
  });

  test("la pertinence passe avant la note", () => {
    const classes = classerCandidats(
      [
        { nom: "bien noté", pertinence: 1, notePonderee: 4.8, nombreAvis: 200 },
        { nom: "pertinent", pertinence: 2, notePonderee: 4.1, nombreAvis: 10 },
      ],
      "pertinence",
    );
    expect(classes.map((c) => c.nom)).toEqual(["pertinent", "bien noté"]);
  });

  test("les ex æquo tournent d'une recherche à l'autre", () => {
    const candidats = [
      { nom: "a", pertinence: 0, notePonderee: 4.52, nombreAvis: 50 },
      { nom: "b", pertinence: 0, notePonderee: 4.48, nombreAvis: 80 },
    ];
    // Même dixième (4,5) : c'est le tirage qui départage.
    const tirages = (valeurs: number[]) => () => valeurs.shift()!;
    expect(classerCandidats(candidats, "note", tirages([0.1, 0.9])).map((c) => c.nom)).toEqual([
      "a",
      "b",
    ]);
    expect(classerCandidats(candidats, "note", tirages([0.9, 0.1])).map((c) => c.nom)).toEqual([
      "b",
      "a",
    ]);
  });
});

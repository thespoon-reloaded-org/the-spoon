import "dotenv/config";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { CRENEAUX_HORAIRES } from "./creneaux";
import { creneauEstOuvert, jourSemaineDeIso, lireOuvertures } from "./disponibilites";
import { prisma } from "./prisma";

/**
 * L'ouverture effective telle que la lisent la carte de réservation du dîneur
 * *et* la création de réservation. Nécessite une vraie base Postgres
 * (`DATABASE_URL`), comme le job `build` de la CI.
 *
 * Les dates sont fixes et lointaines, mais les plages sont posées sur le jour
 * de semaine calculé depuis elles : le test ne dépend pas du calendrier.
 */
describe("ouverture effective d'un créneau", () => {
  const JOUR_OUVERT = "2027-03-02";
  const JOUR_FERME = "2027-03-03";

  let restaurantId: string;
  let sansHorairesId: string;

  beforeAll(async () => {
    const jourSemaine = jourSemaineDeIso(JOUR_OUVERT);
    const restaurant = await prisma.restaurant.create({
      data: {
        nom: "Test disponibilités",
        ville: "Lyon",
        cuisine: "Test",
        adresse: "1 rue des Horaires",
        // Un seul jour de la semaine ouvert, midi et soir — tout le reste fermé.
        plagesOuverture: {
          create: [
            { jourSemaine, debutMinutes: 12 * 60, finMinutes: 14 * 60 },
            { jourSemaine, debutMinutes: 19 * 60, finMinutes: 22 * 60 + 30 },
          ],
        },
      },
    });
    restaurantId = restaurant.id;

    const sansHoraires = await prisma.restaurant.create({
      data: {
        nom: "Test sans horaires",
        ville: "Lyon",
        cuisine: "Test",
        adresse: "2 rue des Horaires",
      },
    });
    sansHorairesId = sansHoraires.id;
  });

  afterAll(async () => {
    await prisma.restaurant.deleteMany({ where: { id: { in: [restaurantId, sansHorairesId] } } });
  });

  test("les créneaux ouverts sont ceux des services déclarés", async () => {
    const ouvertures = await lireOuvertures(restaurantId, [JOUR_OUVERT]);
    expect(ouvertures[JOUR_OUVERT]).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
    ]);
  });

  test("un jour sans service ne propose rien", async () => {
    const ouvertures = await lireOuvertures(restaurantId, [JOUR_FERME]);
    expect(ouvertures[JOUR_FERME]).toEqual([]);
  });

  test("sans horaires déclarés, tous les créneaux restent proposés", async () => {
    const ouvertures = await lireOuvertures(sansHorairesId, [JOUR_OUVERT, JOUR_FERME]);
    expect(ouvertures[JOUR_OUVERT]).toEqual([...CRENEAUX_HORAIRES]);
    expect(ouvertures[JOUR_FERME]).toEqual([...CRENEAUX_HORAIRES]);
  });

  test("une exception ferme un créneau que les horaires ouvraient", async () => {
    await prisma.exceptionHoraire.create({
      data: { restaurantId, jour: JOUR_OUVERT, creneau: "20:00", ouvert: false },
    });

    const ouvertures = await lireOuvertures(restaurantId, [JOUR_OUVERT]);
    expect(ouvertures[JOUR_OUVERT]).not.toContain("20:00");
    expect(ouvertures[JOUR_OUVERT]).toContain("20:30");

    await prisma.exceptionHoraire.deleteMany({ where: { restaurantId, jour: JOUR_OUVERT } });
  });

  test("une exception ouvre un créneau que les horaires fermaient", async () => {
    await prisma.exceptionHoraire.create({
      data: { restaurantId, jour: JOUR_FERME, creneau: "20:00", ouvert: true },
    });

    const ouvertures = await lireOuvertures(restaurantId, [JOUR_FERME]);
    expect(ouvertures[JOUR_FERME]).toEqual(["20:00"]);

    await prisma.exceptionHoraire.deleteMany({ where: { restaurantId, jour: JOUR_FERME } });
  });

  /**
   * La garantie qui justifie ce module : la carte de réservation et la
   * création de réservation ne peuvent pas répondre différemment, puisque
   * c'est la même règle. Un créneau affiché est acceptable, un créneau caché
   * est refusé.
   */
  test("la réponse au créneau unitaire est celle de la liste affichée", async () => {
    const ouvertures = await lireOuvertures(restaurantId, [JOUR_OUVERT, JOUR_FERME]);

    for (const jour of [JOUR_OUVERT, JOUR_FERME]) {
      for (const creneau of CRENEAUX_HORAIRES) {
        expect(await creneauEstOuvert(restaurantId, jour, creneau)).toBe(
          (ouvertures[jour] ?? []).includes(creneau),
        );
      }
    }
  });
});

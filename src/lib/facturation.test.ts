import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  couvertsAFacturer,
  genererFacturesMois,
  joursRestantsContestation,
  montantAvoirsCentimes,
  netAPayerCentimes,
} from "./facturation";
import { prisma } from "./prisma";

describe("couvertsAFacturer", () => {
  test("utilise couvertsServis quand il est renseigné", () => {
    expect(couvertsAFacturer({ couverts: 4, couvertsServis: 2 })).toBe(2);
  });

  test("retombe sur couverts (réservé) quand couvertsServis est absent", () => {
    expect(couvertsAFacturer({ couverts: 4, couvertsServis: null })).toBe(4);
  });
});

describe("joursRestantsContestation", () => {
  test("30 jours restants juste après génération", () => {
    const maintenant = new Date("2026-06-01T00:00:00Z");
    expect(joursRestantsContestation(new Date("2026-06-01T00:00:00Z"), maintenant)).toBe(30);
  });

  test("délai expiré (0, jamais négatif) au-delà de 30 jours", () => {
    const maintenant = new Date("2026-07-15T00:00:00Z");
    expect(joursRestantsContestation(new Date("2026-06-01T00:00:00Z"), maintenant)).toBe(0);
  });
});

/**
 * Preuve de bout en bout du moteur de facturation — nécessite une vraie base
 * Postgres (`DATABASE_URL`), comme `reservation.concurrence.test.ts`.
 */
describe("montantAvoirsCentimes / netAPayerCentimes", () => {
  test("sans avoir, le net est le total facturé", () => {
    expect(montantAvoirsCentimes([])).toBe(0);
    expect(netAPayerCentimes(3250, [])).toBe(3250);
  });

  test("les avoirs se cumulent et se déduisent du total", () => {
    const avoirs = [{ montantCentimes: 750 }, { montantCentimes: 1500 }];
    expect(montantAvoirsCentimes(avoirs)).toBe(2250);
    expect(netAPayerCentimes(3250, avoirs)).toBe(1000);
  });

  test("un avoir qui dépasse la facture ne rend pas le net négatif", () => {
    // Inatteignable aujourd'hui (on ne peut pas contester plus que ce qui est
    // facturé), mais un net négatif s'afficherait comme une dette de TheSpoon
    // envers le restaurant, que rien ne sait traiter.
    expect(netAPayerCentimes(1000, [{ montantCentimes: 1500 }])).toBe(0);
  });
});

describe("genererFacturesMois", () => {
  let restaurantId: string;
  const userId = randomUUID();
  const mois = new Date(Date.UTC(2026, 5, 1)); // juin 2026, pour ne pas tomber sur le mois courant

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { nom: "Test facturation", ville: "Lyon", cuisine: "Test", adresse: "1 rue du Test" },
    });
    restaurantId = restaurant.id;

    await prisma.user.create({
      data: { id: userId, name: "Dîneur test", email: `${userId}@test.example` },
    });

    await prisma.booking.createMany({
      data: [
        // Honorée avec couvertsServis renseigné (3 couverts facturés).
        {
          restaurantId,
          userId,
          date: new Date(Date.UTC(2026, 5, 10, 19, 30)),
          couverts: 4,
          statut: "HONOREE",
          couvertsServis: 3,
        },
        // Honorée sans couvertsServis : repli sur couverts (2 couverts facturés).
        {
          restaurantId,
          userId,
          date: new Date(Date.UTC(2026, 5, 15, 20, 0)),
          couverts: 2,
          statut: "HONOREE",
          couvertsServis: null,
        },
        // No-show : jamais facturé.
        {
          restaurantId,
          userId,
          date: new Date(Date.UTC(2026, 5, 20, 20, 0)),
          couverts: 5,
          statut: "NO_SHOW",
        },
        // Confirmée, en dehors du mois facturé : jamais facturée non plus.
        {
          restaurantId,
          userId,
          date: new Date(Date.UTC(2026, 6, 1, 19, 0)),
          couverts: 2,
          statut: "CONFIRMEE",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.ligneFacture.deleteMany({ where: { facture: { restaurantId } } });
    await prisma.facture.deleteMany({ where: { restaurantId } });
    await prisma.booking.deleteMany({ where: { restaurantId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
  });

  test("facture uniquement les réservations honorées du mois, au bon montant", async () => {
    const resultat = await genererFacturesMois(mois);
    expect(resultat.facturesCreees).toBeGreaterThanOrEqual(1);

    const facture = await prisma.facture.findUnique({
      where: { restaurantId_mois: { restaurantId, mois } },
      include: { lignes: true },
    });

    expect(facture).not.toBeNull();
    expect(facture!.lignes).toHaveLength(2);
    // (3 + 2) couverts × 2,50 € = 12,50 € = 1250 centimes.
    expect(facture!.montantTotalCentimes).toBe(1250);
  });

  test("relancer le traitement sur le même mois sans nouvelle réservation ne crée rien", async () => {
    const resultat = await genererFacturesMois(mois);
    expect(resultat.facturesCreees).toBe(0);
    expect(resultat.lignesAjoutees).toBe(0);

    const factures = await prisma.facture.findMany({ where: { restaurantId, mois } });
    expect(factures).toHaveLength(1);
  });

  test("une réservation signalée honorée après la génération rejoint la facture existante, jamais perdue", async () => {
    // Signalement tardif : la facture de juin a déjà été émise (test
    // précédent) quand cette réservation est marquée honorée après coup.
    const bookingTardif = await prisma.booking.create({
      data: {
        restaurantId,
        userId,
        date: new Date(Date.UTC(2026, 5, 25, 19, 0)),
        couverts: 6,
        statut: "HONOREE",
        couvertsServis: 6,
      },
    });

    const resultat = await genererFacturesMois(mois);
    // La facture existe déjà : pas de nouvelle facture, mais la ligne
    // manquante doit être ajoutée, pas ignorée silencieusement.
    expect(resultat.facturesCreees).toBe(0);
    expect(resultat.lignesAjoutees).toBe(1);

    const factures = await prisma.facture.findMany({ where: { restaurantId, mois } });
    expect(factures).toHaveLength(1); // toujours une seule facture, complétée

    const facture = await prisma.facture.findUnique({
      where: { restaurantId_mois: { restaurantId, mois } },
      include: { lignes: true },
    });
    expect(facture!.lignes).toHaveLength(3);
    expect(facture!.lignes.some((l) => l.bookingId === bookingTardif.id)).toBe(true);
    // (3 + 2 + 6) couverts × 2,50 € = 27,50 € = 2750 centimes.
    expect(facture!.montantTotalCentimes).toBe(2750);
  });
});

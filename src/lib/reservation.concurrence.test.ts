import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { prisma } from "./prisma";
import { CreneauCompletError, reserverCreneau } from "./reservation";

/**
 * Preuve que `reserverCreneau` tient sous accès concurrent (voir le "point
 * dur" du ticket Notion "Capacité & conflits de réservation") : un simple
 * SELECT puis INSERT laisserait passer deux réservations simultanées sur la
 * dernière place. Nécessite une vraie base Postgres (`DATABASE_URL`), comme
 * le job `build` de la CI.
 */
describe("reserverCreneau sous accès concurrent", () => {
  let restaurantId: string;
  const userAId = randomUUID();
  const userBId = randomUUID();
  const date = new Date("2026-12-01T19:30:00");

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: {
        nom: "Test concurrence",
        ville: "Lyon",
        cuisine: "Test",
        adresse: "1 rue du Test",
        capacite: 1,
      },
    });
    restaurantId = restaurant.id;

    await prisma.user.createMany({
      data: [
        { id: userAId, name: "Dîneur A", email: `${userAId}@test.example` },
        { id: userBId, name: "Dîneur B", email: `${userBId}@test.example` },
      ],
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { restaurantId } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
  });

  test("une seule des deux réservations simultanées sur la dernière place passe", async () => {
    const [resultatA, resultatB] = await Promise.allSettled([
      reserverCreneau({ restaurantId, userId: userAId, date, couverts: 1 }),
      reserverCreneau({ restaurantId, userId: userBId, date, couverts: 1 }),
    ]);

    const reussites = [resultatA, resultatB].filter((r) => r.status === "fulfilled");
    const echecs = [resultatA, resultatB].filter((r) => r.status === "rejected");

    expect(reussites).toHaveLength(1);
    expect(echecs).toHaveLength(1);
    expect((echecs[0] as PromiseRejectedResult).reason).toBeInstanceOf(CreneauCompletError);

    const reservations = await prisma.booking.findMany({ where: { restaurantId, date } });
    expect(reservations).toHaveLength(1);
  });
});

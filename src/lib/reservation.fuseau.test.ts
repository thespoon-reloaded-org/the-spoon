import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { construireDateCreneau } from "./creneaux";
import { prisma } from "./prisma";
import { reserverCreneau } from "./reservation";

/**
 * Le défaut corrigé vivait à la frontière entre le code et la base : le
 * créneau était construit correctement, ou pas, et personne ne le voyait
 * avant de relire la colonne. Ce test franchit cette frontière — il écrit une
 * réservation par le même chemin que l'action serveur, puis relit l'instant
 * stocké, brut, sans repasser par Prisma.
 *
 * Il tient sous n'importe quel fuseau machine : l'assertion porte sur
 * l'instant absolu, et le 23 septembre Paris est à UTC+2.
 *
 * Nécessite une vraie base Postgres (`DATABASE_URL`), comme le job `build` de
 * la CI.
 */
describe("l'instant écrit en base est bien l'heure de Paris", () => {
  let restaurantId: string;
  const userId = randomUUID();

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { nom: "Test fuseau", ville: "Lyon", cuisine: "Test", adresse: "1 rue du Fuseau" },
    });
    restaurantId = restaurant.id;
    await prisma.user.create({
      data: { id: userId, name: "Dîneur fuseau", email: `${userId}@test.example` },
    });
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { restaurantId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
  });

  test("un créneau de 20h se relit 18h UTC, pas 20h", async () => {
    const date = construireDateCreneau("2027-09-23", "20:00");
    expect(date?.toISOString()).toBe("2027-09-23T18:00:00.000Z");

    const booking = await reserverCreneau({ restaurantId, userId, date: date!, couverts: 2 });

    // Lecture brute : ce que la colonne contient, sans l'interprétation de Prisma.
    const [ligne] = await prisma.$queryRaw<{ naif: string }[]>`
      SELECT to_char(date, 'YYYY-MM-DD"T"HH24:MI:SS') AS naif
      FROM "Booking" WHERE id = ${booking.id}
    `;
    expect(ligne?.naif).toBe("2027-09-23T18:00:00");

    const relu = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(relu?.date.toISOString()).toBe("2027-09-23T18:00:00.000Z");
  });

  test("et en janvier, 19h UTC — le décalage suit la saison", async () => {
    const date = construireDateCreneau("2027-01-15", "20:00");
    expect(date?.toISOString()).toBe("2027-01-15T19:00:00.000Z");

    const booking = await reserverCreneau({ restaurantId, userId, date: date!, couverts: 2 });
    const relu = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(relu?.date.toISOString()).toBe("2027-01-15T19:00:00.000Z");
  });
});

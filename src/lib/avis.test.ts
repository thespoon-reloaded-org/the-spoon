import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import type { StatutReservation } from "@/generated/prisma";

/**
 * Qui peut déposer un avis : un dîneur servi, que le restaurant ait déjà
 * signalé sa réservation (HONOREE) ou pas encore (CONFIRMEE) — jamais sur
 * une réservation annulée ou un no-show. Passe par la vraie action
 * `deposerAvis`, seule la session est simulée. Nécessite une vraie base
 * Postgres (`DATABASE_URL`), comme le job `build` de la CI.
 */
const session = vi.hoisted(() => ({ userId: "" }));

// Hors d'un serveur Next, ni requête, ni cache de rendu.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: session.userId } }) } },
}));

import { deposerAvis } from "@/app/(site)/restaurants/[id]/actions";
import { prisma } from "@/lib/prisma";

describe("dépôt d'un avis après passage", () => {
  let restaurantId: string;
  const dineurs = new Map<string, string>();
  const hier = new Date(Date.now() - 24 * 3600 * 1000);

  async function dineurAvec(statut: StatutReservation) {
    const id = randomUUID();
    await prisma.user.create({
      data: { id, name: `Dîneur ${statut}`, email: `${id}@test.example` },
    });
    await prisma.booking.create({
      data: { restaurantId, userId: id, date: hier, couverts: 2, statut },
    });
    dineurs.set(statut, id);
    return id;
  }

  async function deposer(userId: string) {
    session.userId = userId;
    const formulaire = new FormData();
    formulaire.set("noteCuilleres", "4");
    formulaire.set("commentaire", "");
    return deposerAvis(restaurantId, {}, formulaire);
  }

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: {
        nom: "Test avis",
        ville: "Lyon",
        cuisine: "Test",
        adresse: "1 rue du Test",
        capacite: 20,
      },
    });
    restaurantId = restaurant.id;
  });

  afterAll(async () => {
    const ids = [...dineurs.values()];
    await prisma.avis.deleteMany({ where: { restaurantId } });
    await prisma.booking.deleteMany({ where: { restaurantId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
  });

  test("réservation passée signalée honorée : l'avis est déposé", async () => {
    const userId = await dineurAvec("HONOREE");
    expect(await deposer(userId)).toEqual({ ok: true });
    expect(await prisma.avis.count({ where: { restaurantId, userId } })).toBe(1);
  });

  test("réservation passée pas encore signalée : l'avis est déposé", async () => {
    const userId = await dineurAvec("CONFIRMEE");
    expect(await deposer(userId)).toEqual({ ok: true });
  });

  test.each<StatutReservation>(["NO_SHOW", "ANNULEE"])(
    "seulement une réservation %s : refusé",
    async (statut) => {
      const userId = await dineurAvec(statut);
      expect(await deposer(userId)).toEqual({
        erreur: "Tu dois avoir été servi dans ce restaurant pour déposer un avis.",
      });
      expect(await prisma.avis.count({ where: { restaurantId, userId } })).toBe(0);
    },
  );

  test("la note du restaurant ne compte que les avis acceptés", async () => {
    const restaurant = await prisma.restaurant.findUniqueOrThrow({ where: { id: restaurantId } });
    expect(restaurant.nombreAvis).toBe(2);
  });
});

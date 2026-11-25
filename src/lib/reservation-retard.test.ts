import { afterEach, expect, test, vi } from "vitest";

import { creerReservation } from "@/app/(site)/restaurants/[id]/actions";
import { reserverCreneau } from "./reservation";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: "dineur" } }) } },
}));
vi.mock("@/lib/avis", () => ({
  aEteServi: vi.fn(),
  recalculerNoteRestaurant: vi.fn(),
}));
vi.mock("@/lib/disponibilites", () => ({ creneauEstOuvert: async () => true }));
vi.mock("@/lib/prisma", () => ({
  prisma: { restaurant: { findUnique: async () => ({ id: "restaurant" }) } },
}));
vi.mock("@/lib/reservation", () => ({
  CreneauCompletError: class extends Error {},
  reserverCreneau: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function formulaireReservation() {
  const formulaire = new FormData();
  formulaire.set("jourIso", "2026-09-22");
  formulaire.set("creneau", "19:00");
  formulaire.set("couverts", "2");
  return formulaire;
}

test("confirme une réservation pour un créneau ouvert", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));

  expect(await creerReservation("restaurant", {}, formulaireReservation())).toEqual({ ok: true });
  expect(reserverCreneau).toHaveBeenCalledOnce();
});

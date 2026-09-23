import { describe, expect, test } from "vitest";

import { resoudreReservations } from "./creations";
import { schemaReservation } from "./schemas";

/**
 * Les états que l'API refuse de fabriquer parce que le produit ne saurait pas
 * les atteindre — voir l'en-tête de `creations.ts`.
 */
const maintenant = new Date("2026-09-23T10:00:00+02:00");
const connus = {
  restaurantIds: new Set(["resto"]),
  dineurParId: new Set(["dineur-1"]),
  dineurParEmail: new Map([["dina@test.example", "dineur-1"]]),
};

function saisie(champs: Record<string, unknown>) {
  return schemaReservation.parse({
    restaurantId: "resto",
    dineurEmail: "dina@test.example",
    jour: "2026-09-10",
    creneau: "19:30",
    couverts: 2,
    ...champs,
  });
}

function resoudre(champs: Record<string, unknown>) {
  return resoudreReservations([saisie(champs)], connus, maintenant);
}

describe("resoudreReservations", () => {
  test("le créneau est lu à l'heure de Paris", () => {
    const { reservations } = resoudre({});
    expect(reservations[0]!.date.toISOString()).toBe("2026-09-10T17:30:00.000Z");
  });

  test("une réservation passée honorée est acceptée, signalée maintenant par défaut", () => {
    const { reservations, erreurs } = resoudre({ statut: "HONOREE", couvertsServis: 3 });
    expect(erreurs).toEqual([]);
    expect(reservations[0]).toMatchObject({
      statut: "HONOREE",
      couvertsServis: 3,
      signaleeLe: maintenant,
    });
    // Jamais créée après son propre service.
    expect(reservations[0]!.createdAt.getTime()).toBeLessThanOrEqual(
      reservations[0]!.date.getTime(),
    );
  });

  test("on ne signale pas un créneau qui n'a pas encore eu lieu", () => {
    const { erreurs } = resoudre({ jour: "2026-09-30", statut: "NO_SHOW" });
    expect(erreurs[0]!.message).toMatch(/créneau passé/);
  });

  test("le signalement tombe entre le service et maintenant", () => {
    expect(
      resoudre({ statut: "NO_SHOW", signaleeLe: "2026-09-09T20:00:00+02:00" }).erreurs,
    ).toHaveLength(1);
    expect(
      resoudre({ statut: "NO_SHOW", signaleeLe: "2026-09-24T20:00:00+02:00" }).erreurs,
    ).toHaveLength(1);
    expect(
      resoudre({ statut: "NO_SHOW", signaleeLe: "2026-09-11T09:00:00+02:00" }).erreurs,
    ).toEqual([]);
  });

  test("une réservation n'est pas créée après son créneau", () => {
    const { erreurs } = resoudre({ creeeLe: "2026-09-11T09:00:00+02:00" });
    expect(erreurs[0]!.message).toMatch(/creeeLe/);
  });

  test("une réservation future confirmée est créée maintenant", () => {
    const { reservations } = resoudre({ jour: "2026-09-30" });
    expect(reservations[0]!.createdAt).toEqual(maintenant);
  });

  test("dîneur et restaurant inconnus sont nommés, élément par élément", () => {
    const { erreurs } = resoudreReservations(
      [
        saisie({}),
        saisie({ restaurantId: "autre" }),
        saisie({ dineurEmail: "inconnu@test.example" }),
      ],
      connus,
      maintenant,
    );
    expect(erreurs.map((e) => e.element)).toEqual([1, 2]);
  });

  test("le schéma refuse ce que les écrans refusent", () => {
    const refuse = (champs: Record<string, unknown>) =>
      schemaReservation.safeParse({
        restaurantId: "resto",
        dineurId: "dineur-1",
        jour: "2026-09-10",
        creneau: "19:30",
        couverts: 2,
        ...champs,
      }).success;
    expect(refuse({ creneau: "19:15" })).toBe(false);
    expect(refuse({ jour: "2026-02-30" })).toBe(false);
    expect(refuse({ statut: "HONOREE" })).toBe(false); // couvertsServis manquant
    expect(refuse({ couvertsServis: 2 })).toBe(false); // couvertsServis sans HONOREE
    expect(refuse({ dineurEmail: "dina@test.example" })).toBe(false); // les deux identifiants
    expect(refuse({ signaleeLe: "2026-09-11T09:00:00" })).toBe(false); // instant sans fuseau
  });
});

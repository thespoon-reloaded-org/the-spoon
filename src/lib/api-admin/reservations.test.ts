import { describe, expect, test } from "vitest";

import { resoudreReservations, type RestaurantConnu } from "./creations";
import { schemaReservation } from "./schemas";

/**
 * Les états que l'API refuse de fabriquer parce que le produit ne saurait pas
 * les atteindre — voir l'en-tête de `creations.ts`.
 */
const maintenant = new Date("2026-09-23T10:00:00+02:00");
const ilYaUnAn = new Date("2025-09-01T10:00:00+02:00");

// Ouvert tous les jours 12h – 14h30 et 19h – 23h, sauf le lundi (fermé).
const plages = [1, 2, 3, 4, 5, 6].flatMap((jourSemaine) => [
  { jourSemaine, debutMinutes: 720, finMinutes: 870 },
  { jourSemaine, debutMinutes: 1140, finMinutes: 1380 },
]);

function connus(restaurant: Partial<RestaurantConnu> = {}, dineurCreeLe = ilYaUnAn) {
  return {
    restaurants: new Map([
      ["resto", { createdAt: ilYaUnAn, plages, exceptions: [], ...restaurant }],
    ]),
    dineurParId: new Map([["dineur-1", dineurCreeLe]]),
    dineurParEmail: new Map([["dina@test.example", { id: "dineur-1", createdAt: dineurCreeLe }]]),
  };
}

function saisie(champs: Record<string, unknown>) {
  return schemaReservation.parse({
    restaurantId: "resto",
    dineurEmail: "dina@test.example",
    jour: "2026-09-10", // un jeudi
    creneau: "19:30",
    couverts: 2,
    ...champs,
  });
}

function resoudre(champs: Record<string, unknown>, contexte = connus()) {
  return resoudreReservations([saisie(champs)], contexte, maintenant);
}

describe("resoudreReservations", () => {
  test("le créneau est lu à l'heure de Paris", () => {
    const { reservations } = resoudre({});
    expect(reservations[0]!.date.toISOString()).toBe("2026-09-10T17:30:00.000Z");
  });

  test("une réservation passée honorée : prise la veille, signalée le soir même", () => {
    const { reservations, erreurs } = resoudre({ statut: "HONOREE", couvertsServis: 3 });
    expect(erreurs).toEqual([]);
    expect(reservations[0]).toMatchObject({
      statut: "HONOREE",
      couvertsServis: 3,
      createdAt: new Date("2026-09-09T19:30:00+02:00"),
      signaleeLe: new Date("2026-09-10T22:30:00+02:00"),
    });
  });

  test("jamais sur un créneau fermé, horaires ou exception", () => {
    expect(resoudre({ jour: "2026-09-07" }).erreurs[0]!.message).toMatch(/fermé/); // lundi
    expect(resoudre({ creneau: "13:30" }).erreurs).toEqual([]); // jeudi midi, ouvert
  });

  test("une exception datée ferme un créneau habituellement ouvert", () => {
    const contexte = connus({
      exceptions: [{ jour: "2026-09-10", creneau: "19:30", ouvert: false }],
    });
    expect(resoudre({}, contexte).erreurs[0]!.message).toMatch(/fermé/);
  });

  test("on ne signale pas un créneau qui n'a pas encore eu lieu", () => {
    const { erreurs } = resoudre({ jour: "2026-09-24", statut: "NO_SHOW" });
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

  test("la fenêtre de 5 jours vaut au jour où la réservation a été prise", () => {
    expect(resoudre({ creeLe: "2026-09-11T09:00:00+02:00" }).erreurs[0]!.message).toMatch(
      /à l'avance/,
    );
    expect(resoudre({ creeLe: "2026-09-01T09:00:00+02:00" }).erreurs[0]!.message).toMatch(
      /à l'avance/,
    );
    expect(resoudre({ creeLe: "2026-09-06T09:00:00+02:00" }).erreurs).toEqual([]);
    // Dans deux mois : aucune date de prise possible avant maintenant.
    expect(resoudre({ jour: "2026-11-19" }).erreurs[0]!.message).toMatch(/à l'avance/);
  });

  test("une réservation future proche est prise maintenant", () => {
    const { reservations } = resoudre({ jour: "2026-09-24" });
    expect(reservations[0]!.createdAt).toEqual(maintenant);
  });

  test("pas d'historique avant l'arrivée du restaurant ou du dîneur", () => {
    const recent = new Date("2026-09-20T10:00:00+02:00");
    expect(resoudre({}, connus({ createdAt: recent })).erreurs[0]!.message).toMatch(/creeLe/);
    expect(resoudre({}, connus({}, recent)).erreurs[0]!.message).toMatch(/creeLe/);
    // Arrivé l'avant-veille au soir : la réservation est prise à son arrivée, pas avant.
    const arrive = new Date("2026-09-09T21:00:00+02:00");
    expect(resoudre({}, connus({ createdAt: arrive })).reservations[0]!.createdAt).toEqual(arrive);
  });

  test("dîneur et restaurant inconnus sont nommés, élément par élément", () => {
    const { erreurs } = resoudreReservations(
      [
        saisie({}),
        saisie({ restaurantId: "autre" }),
        saisie({ dineurEmail: "inconnu@test.example" }),
      ],
      connus(),
      maintenant,
    );
    expect(erreurs.map((e) => e.element)).toEqual([1, 2]);
  });

  test("le schéma refuse ce que les écrans refusent", () => {
    const accepte = (champs: Record<string, unknown>) =>
      schemaReservation.safeParse({
        restaurantId: "resto",
        dineurId: "dineur-1",
        jour: "2026-09-10",
        creneau: "19:30",
        couverts: 2,
        ...champs,
      }).success;
    expect(accepte({})).toBe(true);
    expect(accepte({ creneau: "19:15" })).toBe(false);
    expect(accepte({ creneau: "17:00" })).toBe(false);
    expect(accepte({ jour: "2026-02-30" })).toBe(false);
    expect(accepte({ couverts: 7 })).toBe(false); // au-delà des tailles de table
    expect(accepte({ statut: "HONOREE" })).toBe(false); // couvertsServis manquant
    expect(accepte({ couvertsServis: 2 })).toBe(false); // couvertsServis sans HONOREE
    expect(accepte({ dineurEmail: "dina@test.example" })).toBe(false); // les deux identifiants
    expect(accepte({ signaleeLe: "2026-09-11T09:00:00" })).toBe(false); // instant sans fuseau
  });
});

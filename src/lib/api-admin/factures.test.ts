import { describe, expect, test } from "vitest";

import { dateEmissionFactures, datesDossier } from "./creations";

describe("dateEmissionFactures", () => {
  const maintenant = new Date("2026-09-23T10:00:00+02:00");

  test("un mois passé est facturé le 1er du mois suivant, 6h à Paris", () => {
    expect(dateEmissionFactures("2026-06", maintenant)).toEqual(
      new Date("2026-07-01T06:00:00+02:00"),
    );
    // Changement d'heure : 6h reste 6h à Paris, en hiver aussi.
    expect(dateEmissionFactures("2026-11", new Date("2027-01-15T10:00:00+01:00"))).toEqual(
      new Date("2026-12-01T06:00:00+01:00"),
    );
  });

  test("le mois en cours est facturé maintenant, jamais dans le futur", () => {
    expect(dateEmissionFactures("2026-09", maintenant)).toEqual(maintenant);
  });
});

describe("datesDossier", () => {
  const maintenant = new Date("2026-09-23T10:00:00+02:00");
  const bornes = {
    factureEmiseLe: new Date("2026-07-01T06:00:00+02:00"),
    contactCreeLe: new Date("2026-01-01T10:00:00+01:00"),
  };

  test("par défaut : déposé 5 jours après la facture, chaque étape un jour après", () => {
    const { deposeLe, etapes, erreurs } = datesDossier({ etapes: [{}, {}] }, bornes, maintenant);
    expect(erreurs).toEqual([]);
    expect(deposeLe).toEqual(new Date("2026-07-06T06:00:00+02:00"));
    expect(etapes).toEqual([
      new Date("2026-07-07T06:00:00+02:00"),
      new Date("2026-07-08T06:00:00+02:00"),
    ]);
  });

  test("jamais avant la facture, ni avant le contact, ni dans le futur", () => {
    const avant = new Date("2026-06-30T10:00:00+02:00");
    expect(datesDossier({ deposeLe: avant, etapes: [] }, bornes, maintenant).erreurs).toHaveLength(
      1,
    );
    expect(
      datesDossier(
        { etapes: [] },
        { ...bornes, contactCreeLe: new Date("2026-09-24T10:00:00+02:00") },
        maintenant,
      ).erreurs.length,
    ).toBeGreaterThan(0);
  });

  test("les étapes se suivent", () => {
    const { erreurs } = datesDossier(
      {
        etapes: [
          { le: new Date("2026-07-10T10:00:00+02:00") },
          { le: new Date("2026-07-09T10:00:00+02:00") },
        ],
      },
      bornes,
      maintenant,
    );
    expect(erreurs[0]).toMatch(/etapes\.1/);
  });

  test("un dossier récent ne se date pas dans le futur", () => {
    const recente = { ...bornes, factureEmiseLe: new Date("2026-09-21T06:00:00+02:00") };
    const { deposeLe, etapes } = datesDossier({ etapes: [{}] }, recente, maintenant);
    expect(deposeLe).toEqual(maintenant);
    expect(etapes[0]).toEqual(maintenant);
  });
});

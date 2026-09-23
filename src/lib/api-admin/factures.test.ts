import { describe, expect, test } from "vitest";

import { dateEmissionFactures } from "./creations";

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

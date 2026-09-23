import { describe, expect, test } from "vitest";

import { jetonCorrespond, jetonDeLEntete } from "./garde";

describe("jeton de l'API d'administration", () => {
  const attendu = "a".repeat(64);

  test("seul le jeton exact passe", () => {
    expect(jetonCorrespond(attendu, attendu)).toBe(true);
    expect(jetonCorrespond(`${attendu}b`, attendu)).toBe(false);
    expect(jetonCorrespond("a", attendu)).toBe(false);
    expect(jetonCorrespond(null, attendu)).toBe(false);
    expect(jetonCorrespond("", attendu)).toBe(false);
  });

  test("lit un en-tête Bearer, et rien d'autre", () => {
    expect(jetonDeLEntete(`Bearer ${attendu}`)).toBe(attendu);
    expect(jetonDeLEntete(`bearer ${attendu}`)).toBe(attendu);
    expect(jetonDeLEntete(attendu)).toBeNull();
    expect(jetonDeLEntete(`Basic ${attendu}`)).toBeNull();
    expect(jetonDeLEntete("Bearer ")).toBeNull();
    expect(jetonDeLEntete(null)).toBeNull();
  });
});

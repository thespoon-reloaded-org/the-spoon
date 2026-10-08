import { describe, expect, test } from "vitest";

import { estEmailFormateur } from "./formateurs";

describe("estEmailFormateur", () => {
  test("une adresse @hymaia.com est formatrice, quelle que soit la casse", () => {
    expect(estEmailFormateur("elsa.margier@hymaia.com")).toBe(true);
    expect(estEmailFormateur("  Elsa.Margier@Hymaia.COM ")).toBe(true);
  });

  test("contenir « hymaia » ne suffit pas", () => {
    expect(estEmailFormateur("hymaia.fan@gmail.com")).toBe(false);
    expect(estEmailFormateur("elsa@hymaia.com.ailleurs.io")).toBe(false);
    expect(estEmailFormateur("elsa@pas-hymaia.com")).toBe(false);
    expect(estEmailFormateur("elsa@formation.hymaia.com")).toBe(false);
  });

  test("une adresse sans partie locale n'est personne", () => {
    expect(estEmailFormateur("@hymaia.com")).toBe(false);
    expect(estEmailFormateur("hymaia.com")).toBe(false);
    expect(estEmailFormateur("")).toBe(false);
  });
});

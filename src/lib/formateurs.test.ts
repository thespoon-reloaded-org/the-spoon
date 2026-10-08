import { describe, expect, test } from "vitest";

import {
  ERREUR_HORS_DOMAINE,
  estEmailFormateur,
  messageErreurConnexion,
  refusIdentiteFormateur,
} from "./formateurs";

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

describe("refusIdentiteFormateur", () => {
  test("une identité Google @hymaia.com est admise", () => {
    expect(refusIdentiteFormateur("elsa.margier@hymaia.com")).toBeUndefined();
  });

  test("une autre adresse, ou pas d'adresse du tout, est refusée avec un code reconnaissable", () => {
    for (const email of ["elsa@gmail.com", "hymaia.fan@gmail.com", "", null, undefined]) {
      expect(refusIdentiteFormateur(email)?.error, String(email)).toBe(ERREUR_HORS_DOMAINE);
    }
  });
});

describe("messageErreurConnexion", () => {
  test("rien à dire sans erreur", () => {
    expect(messageErreurConnexion(null)).toBeNull();
    expect(messageErreurConnexion("")).toBeNull();
  });

  test("le mauvais compte Google a son propre message, le reste un message générique", () => {
    expect(messageErreurConnexion(ERREUR_HORS_DOMAINE)).toMatch(/@hymaia\.com/);
    expect(messageErreurConnexion("access_denied")).toMatch(/n'a pas abouti/);
  });
});

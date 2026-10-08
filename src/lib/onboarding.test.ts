import { describe, expect, test } from "vitest";

import { PARCOURS } from "./onboarding";
import { UNIVERS } from "./univers";

/**
 * Le contenu n'a pas de logique à tester, mais il a des règles produit, et
 * elles se perdent vite quand on ajoute « juste une étape de plus ».
 */
describe("les parcours d'onboarding", () => {
  test("il y en a un par univers, et pas un de plus", () => {
    expect(Object.keys(PARCOURS).sort()).toEqual(Object.keys(UNIVERS).sort());
  });

  /** « Quelques étapes » : au-delà de cinq, plus personne ne va au bout. */
  test("chaque parcours tient en trois à cinq étapes", () => {
    for (const [univers, parcours] of Object.entries(PARCOURS)) {
      expect(parcours.etapes.length, univers).toBeGreaterThanOrEqual(3);
      expect(parcours.etapes.length, univers).toBeLessThanOrEqual(5);
    }
  });

  test("rien n'est laissé vide", () => {
    for (const [univers, parcours] of Object.entries(PARCOURS)) {
      expect(parcours.titre.trim(), univers).not.toBe("");
      expect(parcours.accroche.trim(), univers).not.toBe("");
      for (const etape of parcours.etapes) {
        expect(etape.titre.trim(), `${univers} / ${etape.titre}`).not.toBe("");
        expect(etape.texte.trim(), `${univers} / ${etape.titre}`).not.toBe("");
      }
    }
  });

  /**
   * Une étape montre l'écran dont elle parle. Un lien externe ou relatif
   * sortirait l'onboarding de l'univers dans lequel il s'ouvre.
   */
  test("les liens d'étape restent internes", () => {
    for (const parcours of Object.values(PARCOURS)) {
      for (const etape of parcours.etapes) {
        if (!etape.lien) continue;
        expect(etape.lien.href.startsWith("/"), etape.lien.href).toBe(true);
        expect(etape.lien.libelle.trim()).not.toBe("");
      }
    }
  });

  /** Chaque univers parle de son propre produit : le staff n'envoie pas sur l'espace partenaire. */
  test("les liens d'un parcours restent dans son univers", () => {
    const prefixeAttendu: Record<string, (href: string) => boolean> = {
      client: (href) =>
        !href.startsWith("/espace-restaurant") &&
        !href.startsWith("/admin") &&
        !href.startsWith("/formateur"),
      restaurant: (href) => href.startsWith("/espace-restaurant"),
      staff: (href) => href.startsWith("/admin"),
      formateur: (href) => href.startsWith("/formateur"),
    };

    for (const [univers, parcours] of Object.entries(PARCOURS)) {
      for (const etape of parcours.etapes) {
        if (!etape.lien) continue;
        expect(prefixeAttendu[univers]!(etape.lien.href), `${univers} → ${etape.lien.href}`).toBe(
          true,
        );
      }
    }
  });
});

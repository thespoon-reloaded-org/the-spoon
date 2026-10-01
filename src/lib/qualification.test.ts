import { describe, expect, test } from "vitest";

import {
  CRITERES,
  type Criteres,
  deciderStatut,
  schemaAnalyseDemande,
  verifierLocalisation,
} from "./qualification";

function criteres(verdicts: Partial<Record<keyof Criteres, "OK" | "KO" | "INCONNU">> = {}) {
  return Object.fromEntries(
    CRITERES.map((c) => [c, { verdict: verdicts[c] ?? "OK", justification: "Vu.", sources: [] }]),
  ) as unknown as Criteres;
}

describe("deciderStatut", () => {
  test("tout OK : acceptée", () => {
    expect(deciderStatut(criteres())).toBe("ACCEPTEE");
  });

  test("un critère éliminatoire KO : refusée, même avec des INCONNU", () => {
    for (const c of ["existence", "localisation", "menu", "capacite"] as const) {
      expect(deciderStatut(criteres({ [c]: "KO", reputation: "INCONNU" }))).toBe("REFUSEE");
    }
  });

  test("un INCONNU, ou une réputation KO : infos manquantes", () => {
    expect(deciderStatut(criteres({ menu: "INCONNU" }))).toBe("INFOS_MANQUANTES");
    expect(deciderStatut(criteres({ reputation: "KO" }))).toBe("INFOS_MANQUANTES");
  });
});

describe("verifierLocalisation", () => {
  test("un code postal hors Paris force la localisation à KO", () => {
    const verifies = verifierLocalisation(criteres(), "12 rue de la Ré, 69002 Lyon");
    expect(verifies.localisation.verdict).toBe("KO");
    expect(deciderStatut(verifies)).toBe("REFUSEE");
  });

  test("Paris, 75116 ou une adresse sans code postal : inchangé", () => {
    for (const adresse of ["7 rue Exemple, 75009 Paris", "1 av. Foch 75116", "Paris", null]) {
      expect(verifierLocalisation(criteres(), adresse).localisation.verdict).toBe("OK");
    }
  });
});

describe("schemaAnalyseDemande", () => {
  const valide = { criteres: criteres(), brouillonObjet: "Objet", brouillonCorps: "Corps" };

  test("accepte une analyse complète et ignore un statut fourni", () => {
    const r = schemaAnalyseDemande.safeParse({ ...valide, statut: "ACCEPTEE" });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty("statut");
  });

  test("refuse un critère manquant, un verdict inconnu ou une source qui n'est pas une URL", () => {
    const sansMenu: Partial<Criteres> = { ...valide.criteres };
    delete sansMenu.menu;
    expect(schemaAnalyseDemande.safeParse({ ...valide, criteres: sansMenu }).success).toBe(false);
    const peutEtre = { ...valide.criteres, menu: { verdict: "PEUT-ETRE", justification: "?" } };
    expect(schemaAnalyseDemande.safeParse({ ...valide, criteres: peutEtre }).success).toBe(false);
    const source = {
      ...valide.criteres,
      menu: { verdict: "OK", justification: "Vu.", sources: ["x"] },
    };
    expect(schemaAnalyseDemande.safeParse({ ...valide, criteres: source }).success).toBe(false);
  });
});

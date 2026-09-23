import { describe, expect, it } from "vitest";

import { cheminRetour, lienConnexion } from "./retour";

describe("cheminRetour", () => {
  it("garde un chemin interne avec sa sélection", () => {
    expect(cheminRetour("/restaurants/abc?couverts=4&jour=2026-09-24&creneau=20%3A00")).toBe(
      "/restaurants/abc?couverts=4&jour=2026-09-24&creneau=20%3A00",
    );
  });

  it("refuse ce qui sort du site", () => {
    expect(cheminRetour("//evil.com")).toBeNull();
    expect(cheminRetour("/\\evil.com")).toBeNull();
    expect(cheminRetour("https://evil.com")).toBeNull();
  });

  it("refuse une valeur absente ou répétée dans l'URL", () => {
    expect(cheminRetour(undefined)).toBeNull();
    expect(cheminRetour(["/a", "/b"])).toBeNull();
  });
});

describe("lienConnexion", () => {
  it("encode le chemin pour qu'il traverse l'URL intact", () => {
    expect(lienConnexion("/restaurants/abc?creneau=20:00")).toBe(
      "/connexion?retour=%2Frestaurants%2Fabc%3Fcreneau%3D20%3A00",
    );
  });
});

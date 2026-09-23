import { describe, expect, test } from "vitest";

import {
  ALLERGENES,
  LIBELLE_ALLERGENE,
  declarationDepuisFormulaire,
  lireDeclaration,
  trierAllergenes,
} from "./allergenes";

const LE_23_SEPTEMBRE = new Date("2026-09-23T10:00:00Z");

describe("la liste réglementaire", () => {
  test("porte les quatorze allergènes de l'annexe II", () => {
    expect(ALLERGENES).toHaveLength(14);
  });

  test("commence par le gluten et finit par les mollusques, comme l'annexe", () => {
    expect(ALLERGENES[0]).toBe("GLUTEN");
    expect(ALLERGENES.at(-1)).toBe("MOLLUSQUES");
  });

  test("a un libellé pour chaque valeur", () => {
    for (const allergene of ALLERGENES) {
      expect(LIBELLE_ALLERGENE[allergene]).toBeTruthy();
    }
  });
});

describe("trierAllergenes", () => {
  test("remet dans l'ordre réglementaire, quel que soit l'ordre des clics", () => {
    expect(trierAllergenes(["MOLLUSQUES", "OEUFS", "GLUTEN"])).toEqual([
      "GLUTEN",
      "OEUFS",
      "MOLLUSQUES",
    ]);
  });

  test("dédoublonne", () => {
    expect(trierAllergenes(["LAIT", "LAIT"])).toEqual(["LAIT"]);
  });
});

describe("lireDeclaration", () => {
  // Le cœur de la story : une liste vide ne veut rien dire sans sa date.
  test("liste vide sans date : non renseigné, surtout pas « sans allergène »", () => {
    expect(lireDeclaration({ allergenes: [], allergenesDeclaresLe: null })).toEqual({
      etat: "non_renseigne",
    });
  });

  test("liste vide datée : le restaurant affirme qu'il n'y en a aucun", () => {
    expect(lireDeclaration({ allergenes: [], allergenesDeclaresLe: LE_23_SEPTEMBRE })).toEqual({
      etat: "aucun",
      declareLe: LE_23_SEPTEMBRE,
    });
  });

  test("liste remplie : les allergènes, dans l'ordre de l'annexe", () => {
    expect(
      lireDeclaration({
        allergenes: ["LAIT", "GLUTEN"],
        allergenesDeclaresLe: LE_23_SEPTEMBRE,
      }),
    ).toEqual({
      etat: "presents",
      declareLe: LE_23_SEPTEMBRE,
      allergenes: ["GLUTEN", "LAIT"],
    });
  });

  test("des allergènes en base sans date restent non renseignés", () => {
    // Cas que seul un bricolage en base peut produire, mais la date reste
    // l'unique juge : pas de demi-déclaration affichée au dîneur.
    expect(lireDeclaration({ allergenes: ["LAIT"], allergenesDeclaresLe: null })).toEqual({
      etat: "non_renseigne",
    });
  });
});

describe("declarationDepuisFormulaire", () => {
  test("rien de coché ne date rien — le plat reste non renseigné", () => {
    expect(
      declarationDepuisFormulaire({ allergenes: [], aucunAllergene: false }, LE_23_SEPTEMBRE),
    ).toEqual({ allergenes: [], allergenesDeclaresLe: null });
  });

  test("« aucun allergène » coché date une déclaration vide", () => {
    expect(
      declarationDepuisFormulaire({ allergenes: [], aucunAllergene: true }, LE_23_SEPTEMBRE),
    ).toEqual({ allergenes: [], allergenesDeclaresLe: LE_23_SEPTEMBRE });
  });

  test("des allergènes cochés datent la déclaration et sont triés", () => {
    expect(
      declarationDepuisFormulaire(
        { allergenes: ["LAIT", "GLUTEN"], aucunAllergene: false },
        LE_23_SEPTEMBRE,
      ),
    ).toEqual({ allergenes: ["GLUTEN", "LAIT"], allergenesDeclaresLe: LE_23_SEPTEMBRE });
  });

  test("« aucun allergène » l'emporte sur des cases restées cochées", () => {
    // Le formulaire désactive les cases quand « aucun » est coché, donc le cas
    // n'arrive pas depuis l'écran — mais une requête forgée, oui, et elle ne
    // doit pas produire un plat à la fois « sans allergène » et « au lait ».
    expect(
      declarationDepuisFormulaire({ allergenes: ["LAIT"], aucunAllergene: true }, LE_23_SEPTEMBRE),
    ).toEqual({ allergenes: [], allergenesDeclaresLe: LE_23_SEPTEMBRE });
  });
});

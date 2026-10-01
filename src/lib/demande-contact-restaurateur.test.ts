import { describe, expect, test } from "vitest";

import { schemaDemandeContact } from "./demande-contact-restaurateur";

/** Un dépôt valide, surchargeable champ par champ pour isoler chaque règle. */
function demandeValide(surcharge: Partial<Record<string, unknown>> = {}) {
  return {
    nom: "Jeanne Dupont",
    email: "contact@monrestaurant.fr",
    etablissement: "Le Petit Plat",
    adresse: "12 rue de la Paix, 75002 Paris",
    siren: "123456789",
    urlGoogleMyBusiness: "",
    menusALaCuillere: "oui",
    message: "Nous souhaitons être référencés.",
    ...surcharge,
  };
}

/** Le premier message d'erreur, pour vérifier ce que voit le restaurateur. */
function premierMessage(saisie: Record<string, unknown>): string {
  const resultat = schemaDemandeContact.safeParse(saisie);
  if (resultat.success) throw new Error("La saisie aurait dû être refusée.");
  return resultat.error.issues[0]?.message ?? "";
}

describe("SIREN", () => {
  test("neuf chiffres avec espaces : accepté et stocké sans espace", () => {
    const resultat = schemaDemandeContact.parse(demandeValide({ siren: "123 456 789" }));
    expect(resultat.siren).toBe("123456789");
  });

  test("huit chiffres : refusé", () => {
    expect(premierMessage(demandeValide({ siren: "12345678" }))).toBe(
      "Le SIREN doit comporter 9 chiffres.",
    );
  });

  test("des lettres : refusé", () => {
    expect(premierMessage(demandeValide({ siren: "12AB56789" }))).toBe(
      "Le SIREN doit comporter 9 chiffres.",
    );
  });

  test("absent : refusé, avec le message du SIREN", () => {
    expect(premierMessage(demandeValide({ siren: null }))).toBe(
      "Le SIREN doit comporter 9 chiffres.",
    );
  });
});

describe("URL Google My Business", () => {
  test("vide : accepté et stocké null", () => {
    const resultat = schemaDemandeContact.parse(demandeValide({ urlGoogleMyBusiness: "" }));
    expect(resultat.urlGoogleMyBusiness).toBeNull();
  });

  test("absente : accepté et stocké null", () => {
    const resultat = schemaDemandeContact.parse({
      nom: "Jeanne Dupont",
      email: "contact@monrestaurant.fr",
      etablissement: "Le Petit Plat",
      adresse: "12 rue de la Paix, 75002 Paris",
      siren: "123456789",
      menusALaCuillere: "oui",
      message: "Nous souhaitons être référencés.",
    });
    expect(resultat.urlGoogleMyBusiness).toBeNull();
  });

  test("http ou https : acceptée telle quelle", () => {
    for (const url of ["https://maps.app.goo.gl/abc", "http://exemple.fr/fiche"]) {
      const resultat = schemaDemandeContact.parse(
        demandeValide({ urlGoogleMyBusiness: url }),
      );
      expect(resultat.urlGoogleMyBusiness).toBe(url);
    }
  });

  test("invalide : refusée", () => {
    expect(premierMessage(demandeValide({ urlGoogleMyBusiness: "pas une url" }))).toBe(
      "Lien Google My Business invalide.",
    );
  });

  test("autre protocole : refusé", () => {
    expect(premierMessage(demandeValide({ urlGoogleMyBusiness: "ftp://exemple.fr" }))).toBe(
      "Lien Google My Business invalide.",
    );
  });
});

describe("menus à la cuillère", () => {
  test("« oui » devient true", () => {
    const resultat = schemaDemandeContact.parse(demandeValide({ menusALaCuillere: "oui" }));
    expect(resultat.menusALaCuillere).toBe(true);
  });

  test("« non » devient false", () => {
    const resultat = schemaDemandeContact.parse(demandeValide({ menusALaCuillere: "non" }));
    expect(resultat.menusALaCuillere).toBe(false);
  });

  test("manquant : refusé, en demandant de répondre", () => {
    expect(premierMessage(demandeValide({ menusALaCuillere: null }))).toBe(
      "Indiquez si vous proposez des menus à la cuillère.",
    );
  });

  test("valeur hors oui/non : refusée", () => {
    expect(premierMessage(demandeValide({ menusALaCuillere: "peut-être" }))).toBe(
      "Indiquez si vous proposez des menus à la cuillère.",
    );
  });
});

describe("un dépôt complet", () => {
  test("accepte les trois champs et les convertit pour la base", () => {
    const resultat = schemaDemandeContact.parse(
      demandeValide({
        siren: "123 456 789",
        urlGoogleMyBusiness: "https://maps.app.goo.gl/abc",
        menusALaCuillere: "oui",
      }),
    );
    expect(resultat.siren).toBe("123456789");
    expect(resultat.urlGoogleMyBusiness).toBe("https://maps.app.goo.gl/abc");
    expect(resultat.menusALaCuillere).toBe(true);
  });
});

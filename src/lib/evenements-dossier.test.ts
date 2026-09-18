import { describe, expect, test } from "vitest";

import { decrireEvenement, formaterHorodatage, type EvenementAvecAuteur } from "./evenements-dossier";
// Les montants attendus passent par le formateur plutôt que par une chaîne
// recopiée : `toLocaleString` sépare le nombre du € par une espace insécable
// étroite, invisible à la relecture d'un test mais pas à la comparaison.
import { formaterMontant } from "./montants";

const LE_18_A_14H32 = new Date(2026, 8, 18, 14, 32);

function evenement(champs: Partial<EvenementAvecAuteur>): EvenementAvecAuteur {
  return {
    id: "evt",
    dossierId: "dossier",
    type: "DEPOT",
    details: null,
    auteurStaffId: null,
    auteurStaff: null,
    interne: false,
    createdAt: LE_18_A_14H32,
    ...champs,
  };
}

describe("formaterHorodatage", () => {
  test("date et heure, à la minute", () => {
    expect(formaterHorodatage(LE_18_A_14H32)).toBe("18 sept. à 14:32");
  });
});

describe("decrireEvenement", () => {
  test("un dépôt annonce le montant contesté et le nombre de réservations", () => {
    const ligne = decrireEvenement(
      evenement({ type: "DEPOT", details: { montantContesteCentimes: 2250, nbLignes: 2 } }),
    );
    expect(ligne.titre).toBe("Dossier déposé");
    expect(ligne.detail).toBe(`${formaterMontant(2250)} contestés sur 2 réservations`);
    expect(ligne.auteur).toBe("Le restaurant");
  });

  test("côté partenaire, le dépôt est le sien", () => {
    const ligne = decrireEvenement(evenement({ type: "DEPOT" }), { pourLePartenaire: true });
    expect(ligne.auteur).toBe("Vous");
  });

  test("une décision montre l'imputation au staff, jamais au partenaire", () => {
    const decision = evenement({
      type: "DECISION",
      details: { issue: "PARTIEL", montantAccordeCentimes: 1500, imputation: "CLIENT" },
      auteurStaffId: "staff",
      auteurStaff: { nom: "Léa Fontaine" },
    });

    const cotéStaff = decrireEvenement(decision);
    expect(cotéStaff.titre).toBe("Décision : accordé en partie");
    expect(cotéStaff.detail).toBe(`${formaterMontant(1500)} accordés · À la charge du client`);
    expect(cotéStaff.auteur).toBe("Léa Fontaine");

    // Le partenaire lit ce qu'il obtient, pas qui porte le coût — l'imputation
    // "client" laisserait entendre que le dîneur va être facturé — ni le nom
    // de l'instructeur : c'est TheSpoon qui lui répond.
    const cotéPartenaire = decrireEvenement(decision, { pourLePartenaire: true });
    expect(cotéPartenaire.detail).toBe(`${formaterMontant(1500)} accordés`);
    expect(cotéPartenaire.auteur).toBe("TheSpoon");
  });

  test("un refus n'annonce aucun montant accordé", () => {
    const ligne = decrireEvenement(
      evenement({
        type: "DECISION",
        details: { issue: "REFUSE", montantAccordeCentimes: 0, imputation: "RESTAURANT" },
        auteurStaff: { nom: "Hugo Rieu" },
      }),
      { pourLePartenaire: true },
    );
    expect(ligne.titre).toBe("Décision : refusé");
    expect(ligne.detail).toBeUndefined();
  });

  test("une demande de complément reprend le message envoyé", () => {
    const ligne = decrireEvenement(
      evenement({ type: "COMPLEMENT_DEMANDE", details: { message: "Le ticket de caisse." } }),
    );
    expect(ligne.detail).toBe("Le ticket de caisse.");
  });

  test("un avoir dit ce qu'il déduit", () => {
    const ligne = decrireEvenement(evenement({ type: "AVOIR_EMIS", details: { montantCentimes: 750 } }));
    expect(ligne.titre).toBe("Avoir émis");
    expect(ligne.detail).toBe(`${formaterMontant(750)} en déduction de la facture`);
  });

  test("des détails absents ou d'une autre forme ne cassent pas la ligne", () => {
    // Une ligne écrite par une version antérieure du code doit rester lisible :
    // un journal se relit des années plus tard.
    expect(decrireEvenement(evenement({ type: "DEPOT", details: null })).detail).toBeUndefined();
    expect(
      decrireEvenement(evenement({ type: "AVOIR_EMIS", details: { montantCentimes: "750" } })).detail,
    ).toBeUndefined();
    expect(decrireEvenement(evenement({ type: "DECISION", details: {} })).titre).toBe("Décision");
  });

  test("un traitement automatique n'a pas d'auteur nommé", () => {
    const ligne = decrireEvenement(evenement({ type: "AVOIR_EMIS", details: { montantCentimes: 750 } }));
    expect(ligne.auteur).toBe("Traitement automatique");
  });

  test("un crédit d'office n'est jamais attribué au restaurant", () => {
    // Il n'a pas d'auteur en base (c'est la règle de seuil qui décide) : sans
    // règle explicite, le partenaire lisait « Vous » sur l'avoir qu'il reçoit.
    const avoirOffice = evenement({ type: "AVOIR_EMIS", details: { montantCentimes: 750 } });
    expect(decrireEvenement(avoirOffice, { pourLePartenaire: true }).auteur).toBe("TheSpoon");
  });
});

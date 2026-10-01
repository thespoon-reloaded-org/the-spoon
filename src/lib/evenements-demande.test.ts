import { describe, expect, test } from "vitest";

import {
  decrireEvenementDemande,
  formaterHorodatageDemande,
  type EvenementDemandeAvecAuteur,
} from "./evenements-demande";

// Instant absolu plutôt qu'heure locale : le rendu impose le fuseau de Paris,
// et ce test doit dire la même chose sur n'importe quel poste (CI en UTC).
const LE_18_A_14H32_A_PARIS = new Date("2026-09-18T12:32:00Z");

function evenement(champs: Partial<EvenementDemandeAvecAuteur>): EvenementDemandeAvecAuteur {
  return {
    id: "evt",
    demandeId: "demande",
    type: "DEPOT",
    details: null,
    auteurStaffId: null,
    auteurStaff: null,
    createdAt: LE_18_A_14H32_A_PARIS,
    ...champs,
  };
}

describe("formaterHorodatageDemande", () => {
  test("date et heure de Paris, à la minute, quel que soit le fuseau du serveur", () => {
    expect(formaterHorodatageDemande(LE_18_A_14H32_A_PARIS)).toBe("18 sept. à 14:32");
  });
});

describe("decrireEvenementDemande", () => {
  test("un dépôt vient du restaurateur, sans auteur staff", () => {
    const ligne = decrireEvenementDemande(evenement({ type: "DEPOT" }));
    expect(ligne.titre).toBe("Demande déposée");
    expect(ligne.auteur).toBe("Le restaurateur");
    expect(ligne.detail).toBeUndefined();
  });

  test("une acceptation porte l'auteur connecté et le motif", () => {
    const ligne = decrireEvenementDemande(
      evenement({
        type: "DECISION",
        details: { issue: "ACCEPTEE", motif: "Établissement validé." },
        auteurStaffId: "staff",
        auteurStaff: { nom: "Léa Fontaine" },
      }),
    );
    expect(ligne.titre).toBe("Demande acceptée");
    expect(ligne.detail).toBe("Établissement validé.");
    expect(ligne.auteur).toBe("Léa Fontaine");
  });

  test("un rejet garde son motif", () => {
    const ligne = decrireEvenementDemande(
      evenement({
        type: "DECISION",
        details: { issue: "REJETEE", motif: "Hors zone de couverture." },
        auteurStaff: { nom: "Hugo Rieu" },
      }),
    );
    expect(ligne.titre).toBe("Demande rejetée");
    expect(ligne.detail).toBe("Hors zone de couverture.");
    expect(ligne.auteur).toBe("Hugo Rieu");
  });

  test("des détails absents ou inattendus ne cassent pas la ligne", () => {
    // Un journal se relit des années plus tard, y compris des lignes écrites
    // par une version du code qui n'existe plus : mieux vaut une étape sans
    // détail qu'un écran qui plante.
    expect(decrireEvenementDemande(evenement({ type: "DECISION", details: null })).titre).toBe(
      "Décision",
    );
    expect(
      decrireEvenementDemande(evenement({ type: "DECISION", details: {} })).detail,
    ).toBeUndefined();
    expect(
      decrireEvenementDemande(
        evenement({ type: "DECISION", details: { issue: 42, motif: [] } }),
      ).titre,
    ).toBe("Décision");
    expect(
      decrireEvenementDemande(
        evenement({ type: "DECISION", details: { issue: "VALEUR_INCONNUE" } }),
      ).titre,
    ).toBe("Décision");
  });

  test("un motif reste lisible même si l'issue n'est plus connue", () => {
    const ligne = decrireEvenementDemande(
      evenement({
        type: "DECISION",
        details: { issue: "ANCIENNE_VALEUR", motif: "Motif toujours valable." },
      }),
    );
    expect(ligne.titre).toBe("Décision");
    expect(ligne.detail).toBe("Motif toujours valable.");
  });
});

import type { EvenementDemandeRestaurateur, Staff } from "@/generated/prisma";

import { TITRES_DECISION_DEMANDE, type IssueDemande } from "./demande-labels";
import { formaterJourEtHeure } from "./fuseau";

export type EvenementDemandeAvecAuteur = EvenementDemandeRestaurateur & {
  auteurStaff: Pick<Staff, "nom"> | null;
};

/** Une ligne de journal prête à afficher. Même forme que `LigneJournal` d'un dossier. */
export type LigneJournalDemande = {
  horodatage: string;
  titre: string;
  /** Le détail de l'étape — absent quand le titre se suffit à lui-même. */
  detail?: string;
  auteur: string;
};

/**
 * `details` est du JSON libre en base (voir `EvenementDemandeRestaurateur`) :
 * ces lecteurs évitent de faire confiance à sa forme. Un journal se relit des
 * années plus tard, y compris des lignes écrites par une version du code qui
 * n'existe plus — mieux vaut une étape sans détail qu'un écran qui plante.
 * Même précaution que src/lib/evenements-dossier.ts.
 */
function texte(details: unknown, cle: string): string | null {
  if (typeof details !== "object" || details === null) return null;
  const valeur = (details as Record<string, unknown>)[cle];
  return typeof valeur === "string" ? valeur : null;
}

/**
 * "18 sept. à 14:32" — un journal se lit à la minute, pas au jour près, et le
 * format vient de `src/lib/fuseau.ts`, qui impose aussi le fuseau : en
 * production le code tourne en UTC (Netlify), et un journal qui daterait à
 * 12:32 un geste fait à 14:32 à Paris serait faux là où il doit faire foi.
 */
export const formaterHorodatageDemande = formaterJourEtHeure;

/**
 * Traduit un événement de demande restaurateur en ligne lisible : qui a fait
 * quoi, quand, avec quel motif. Le dépôt vient du restaurateur (pas d'auteur
 * staff en base), la décision du staff connecté.
 */
export function decrireEvenementDemande(evenement: EvenementDemandeAvecAuteur): LigneJournalDemande {
  const horodatage = formaterHorodatageDemande(evenement.createdAt);

  switch (evenement.type) {
    case "DEPOT":
      return { horodatage, titre: "Demande déposée", auteur: "Le restaurateur" };
    case "DECISION": {
      const issue = texte(evenement.details, "issue");
      const motif = texte(evenement.details, "motif")?.trim();
      // Une issue inconnue (valeur retirée de l'enum, ligne écrite par une
      // version antérieure du code) ne doit pas produire « Demande undefined »
      // à l'écran. Le motif, lui, reste lisible même sans issue reconnue.
      const titre =
        issue !== null && Object.prototype.hasOwnProperty.call(TITRES_DECISION_DEMANDE, issue)
          ? TITRES_DECISION_DEMANDE[issue as IssueDemande]
          : "Décision";
      return {
        horodatage,
        titre,
        detail: motif ? motif : undefined,
        auteur: evenement.auteurStaff?.nom ?? "Traitement automatique",
      };
    }
  }
}

import type { EvenementDossier, ImputationLitige, IssueDecision, Staff } from "@/generated/prisma";

import { LABELS_IMPUTATION_LITIGE, LABELS_ISSUE_DECISION } from "./contestation-labels";
import { formaterMontant } from "./montants";

export type EvenementAvecAuteur = EvenementDossier & { auteurStaff: Pick<Staff, "nom"> | null };

/** Une ligne de journal prête à afficher. */
export type LigneJournal = {
  horodatage: string;
  titre: string;
  /** Le détail de l'étape — absent quand le titre se suffit à lui-même. */
  detail?: string;
  auteur: string;
};

/**
 * `details` est du JSON libre en base (voir `EvenementDossier`) : ces deux
 * lecteurs évitent de faire confiance à sa forme. Un journal se relit des
 * années plus tard, y compris des lignes écrites par une version du code qui
 * n'existe plus — mieux vaut une étape sans détail qu'un écran qui plante.
 */
function nombre(details: unknown, cle: string): number | null {
  if (typeof details !== "object" || details === null) return null;
  const valeur = (details as Record<string, unknown>)[cle];
  return typeof valeur === "number" ? valeur : null;
}

function texte(details: unknown, cle: string): string | null {
  if (typeof details !== "object" || details === null) return null;
  const valeur = (details as Record<string, unknown>)[cle];
  return typeof valeur === "string" ? valeur : null;
}

/** "18 sept. à 14:32" — un journal se lit à la minute, pas au jour près. */
export function formaterHorodatage(date: Date): string {
  const jour = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} à ${heure}`;
}

/**
 * Traduit un événement en ligne lisible. `pourLePartenaire` n'est pas un
 * détail d'affichage : c'est la règle produit qui dit ce qu'un restaurant a le
 * droit de lire de l'instruction de son dossier. Il voit l'étape et ce qu'elle
 * lui a rapporté, pas l'imputation (savoir que le coût est "à la charge du
 * client" laisserait entendre que le dîneur va être facturé) ni le nom de
 * l'instructeur (c'est TheSpoon qui répond, pas une personne).
 *
 * Les événements marqués `interne` ne lui sont pas montrés du tout — les
 * filtrer reste la responsabilité de l'appelant, qui seul sait pour qui il
 * affiche.
 */
export function decrireEvenement(
  evenement: EvenementAvecAuteur,
  { pourLePartenaire = false }: { pourLePartenaire?: boolean } = {},
): LigneJournal {
  const horodatage = formaterHorodatage(evenement.createdAt);
  // Côté partenaire, l'auteur se lit du type et non de `auteurStaff` : un
  // crédit d'office n'a pas d'auteur en base, et l'attribuer au restaurant
  // ("Vous avez accordé un avoir") serait faux. Seul le dépôt est de lui.
  const auteur = pourLePartenaire
    ? evenement.type === "DEPOT"
      ? "Vous"
      : "TheSpoon"
    : (evenement.auteurStaff?.nom ?? "Traitement automatique");

  switch (evenement.type) {
    case "DEPOT": {
      const montant = nombre(evenement.details, "montantContesteCentimes");
      const lignes = nombre(evenement.details, "nbLignes");
      return {
        horodatage,
        titre: "Dossier déposé",
        detail:
          montant === null
            ? undefined
            : `${formaterMontant(montant)} contestés${
                lignes === null ? "" : ` sur ${lignes} réservation${lignes > 1 ? "s" : ""}`
              }`,
        auteur: pourLePartenaire ? "Vous" : "Le restaurant",
      };
    }
    case "PRISE_EN_CHARGE":
      return { horodatage, titre: "Dossier pris en charge", auteur };
    case "COMPLEMENT_DEMANDE":
      return {
        horodatage,
        titre: "Complément demandé au restaurant",
        detail: texte(evenement.details, "message") ?? undefined,
        auteur,
      };
    case "DECISION": {
      const issue = texte(evenement.details, "issue") as IssueDecision | null;
      const montant = nombre(evenement.details, "montantAccordeCentimes");
      const imputation = texte(evenement.details, "imputation") as ImputationLitige | null;
      const morceaux = [
        montant !== null && montant > 0 ? `${formaterMontant(montant)} accordés` : null,
        !pourLePartenaire && imputation ? LABELS_IMPUTATION_LITIGE[imputation] : null,
      ].filter((morceau): morceau is string => morceau !== null);
      return {
        horodatage,
        titre: issue ? `Décision : ${LABELS_ISSUE_DECISION[issue].toLowerCase()}` : "Décision",
        detail: morceaux.length > 0 ? morceaux.join(" · ") : undefined,
        auteur,
      };
    }
    case "AVOIR_EMIS": {
      const montant = nombre(evenement.details, "montantCentimes");
      return {
        horodatage,
        titre: "Avoir émis",
        detail: montant === null ? undefined : `${formaterMontant(montant)} en déduction de la facture`,
        auteur,
      };
    }
  }
}

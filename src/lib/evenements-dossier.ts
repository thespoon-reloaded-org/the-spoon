import type { EvenementDossier, Staff } from "@/generated/prisma";

import { LABELS_IMPUTATION_LITIGE, LABELS_ISSUE_DECISION } from "./contestation-labels";
import { formaterJourEtHeure } from "./fuseau";
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

/**
 * Libellé d'une valeur d'enum lue dans le JSON — `null` si elle n'est pas (ou
 * n'est plus) dans la table. Un cast direct donnerait « Décision : undefined »
 * sur une ligne écrite par une version antérieure du code.
 */
function libelle<Cle extends string>(table: Record<Cle, string>, valeur: string | null): string | null {
  if (valeur === null) return null;
  return Object.prototype.hasOwnProperty.call(table, valeur) ? table[valeur as Cle] : null;
}

/**
 * "18 sept. à 14:32" — un journal se lit à la minute, pas au jour près. Le
 * format vient de `src/lib/fuseau.ts`, qui impose aussi le fuseau : en
 * production le code tourne en UTC (Netlify), et un journal qui daterait à
 * 12:32 un geste fait à 14:32 à Paris serait faux là où il doit faire foi.
 */
export const formaterHorodatage = formaterJourEtHeure;

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
  // L'auteur se lit du type et non de `auteurStaff` pour le dépôt (il vient du
  // restaurant) et pour tout ce que voit le partenaire : un crédit d'office
  // n'a pas d'auteur en base, et l'attribuer au restaurant ("Vous avez accordé
  // un avoir") serait faux.
  const auteur =
    evenement.type === "DEPOT"
      ? pourLePartenaire
        ? "Vous"
        : "Le restaurant"
      : pourLePartenaire
        ? "TheSpoon"
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
        auteur,
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
      const issue = libelle(LABELS_ISSUE_DECISION, texte(evenement.details, "issue"));
      const montant = nombre(evenement.details, "montantAccordeCentimes");
      const imputation = libelle(LABELS_IMPUTATION_LITIGE, texte(evenement.details, "imputation"));
      const morceaux = [
        montant !== null && montant > 0 ? `${formaterMontant(montant)} accordés` : null,
        pourLePartenaire ? null : imputation,
      ].filter((morceau): morceau is string => morceau !== null);
      return {
        horodatage,
        titre: issue ? `Décision : ${issue.toLowerCase()}` : "Décision",
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

import type { StatutDemandeRestaurateur } from "@/generated/prisma";

import type { EtatPastille } from "./ui";

/**
 * Libellés d'affichage des statuts d'une demande de contact restaurateur —
 * isolés dans un module sans dépendance à Prisma runtime (contrairement à
 * src/lib/demandes-restaurateur.ts, qui importe `prisma`) pour rester
 * importables depuis un composant client sans tirer `pg` dans le bundle
 * navigateur. Même découpage que contestation-labels.ts.
 */
export const LABELS_STATUT_DEMANDE: Record<StatutDemandeRestaurateur, string> = {
  A_QUALIFIER: "À qualifier",
  ACCEPTEE: "Acceptée",
  REJETEE: "Rejetée",
};

/** Couleur du statut : à qualifier n'est ni une bonne ni une mauvaise nouvelle. */
export const ETAT_STATUT_DEMANDE: Record<StatutDemandeRestaurateur, EtatPastille> = {
  A_QUALIFIER: "attention",
  ACCEPTEE: "succes",
  REJETEE: "danger",
};

/**
 * Les deux issues d'une décision — un sous-ensemble de `StatutDemandeRestaurateur`,
 * typé à part parce que c'est ce que la saisie accepte (`A_QUALIFIER` n'est pas
 * une décision). Sert aussi à valider ce qui est lu dans `details`.
 */
export const ISSUES_DECISION_DEMANDE = ["ACCEPTEE", "REJETEE"] as const;

export type IssueDemande = (typeof ISSUES_DECISION_DEMANDE)[number];

/** Titre d'une ligne de journal de décision, selon l'issue. */
export const TITRES_DECISION_DEMANDE: Record<IssueDemande, string> = {
  ACCEPTEE: "Demande acceptée",
  REJETEE: "Demande rejetée",
};

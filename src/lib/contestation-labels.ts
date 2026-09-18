import type {
  ImputationLitige,
  IssueDecision,
  MotifContestation,
  StatutDossier,
} from "@/generated/prisma";

import type { EtatPastille } from "./ui";

/**
 * Libellés d'affichage pour les enums MotifContestation/StatutDossier —
 * isolés dans un module sans dépendance à Prisma runtime (contrairement à
 * src/lib/contestation.ts, qui importe `prisma`) pour rester importable
 * depuis un composant client (voir DeposerContestationForm.tsx) sans tirer
 * `pg`/`@prisma/adapter-pg` dans le bundle navigateur.
 */
export const LABELS_MOTIF_CONTESTATION: Record<MotifContestation, string> = {
  NO_SHOW: "Client absent (no-show)",
  ANNULATION_TARDIVE: "Annulation tardive",
  COUVERTS_SURCOMPTES: "Couverts sur-comptés",
  DOUBLON: "Réservation en doublon",
  HORS_PLATEFORME: "Réservation hors plateforme",
  AUTRE: "Autre",
};

export const LABELS_STATUT_DOSSIER: Record<StatutDossier, string> = {
  EN_ATTENTE_INSTRUCTION: "En attente d'instruction",
  CREDITE_OFFICE: "Crédité d'office",
  ESCALADE: "Escaladé",
  CLOTURE: "Tranché",
};

/**
 * Le statut dit où en est le dossier, l'issue dit ce qu'il a obtenu : les deux
 * s'affichent côte à côte sur un dossier tranché, jamais l'un à la place de
 * l'autre.
 */
export const LABELS_ISSUE_DECISION: Record<IssueDecision, string> = {
  ACCORDE: "Accordé",
  PARTIEL: "Accordé en partie",
  REFUSE: "Refusé",
  ESCALADE: "Escaladé",
};

/** Formulé du point de vue de qui paie, pas du nom de l'enum. */
export const LABELS_IMPUTATION_LITIGE: Record<ImputationLitige, string> = {
  RESTAURANT: "À la charge du restaurant",
  THESPOON: "À la charge de TheSpoon",
  CLIENT: "À la charge du client",
};

/**
 * Couleur du statut d'un dossier — la même des deux côtés (instruction staff
 * et récapitulatif restaurant), sans quoi le même dossier changeait de couleur
 * selon qui le regardait. Un dossier tranché est neutre : c'est l'issue, à
 * côté, qui porte la bonne ou la mauvaise nouvelle.
 */
export const ETAT_STATUT_DOSSIER: Record<StatutDossier, EtatPastille> = {
  EN_ATTENTE_INSTRUCTION: "attention",
  CREDITE_OFFICE: "succes",
  ESCALADE: "danger",
  CLOTURE: "neutre",
};

/** Couleur de l'issue, du point de vue du restaurant qui la reçoit. */
export const ETAT_ISSUE_DECISION: Record<IssueDecision, EtatPastille> = {
  ACCORDE: "succes",
  PARTIEL: "succes",
  REFUSE: "danger",
  ESCALADE: "attention",
};

/**
 * Le même dossier, dit au restaurant. Deux différences avec le vocabulaire
 * interne, et c'est volontaire : une escalade est une affaire d'organisation
 * chez TheSpoon (l'instructeur passe la main), pas une réponse au partenaire —
 * pour lui, le dossier est toujours en cours d'examen, et rien ne justifie de
 * lui apprendre qu'il a changé de mains.
 */
export const STATUT_DOSSIER_COTE_RESTAURANT: Record<
  StatutDossier,
  { libelle: string; etat: EtatPastille }
> = {
  EN_ATTENTE_INSTRUCTION: { libelle: "En cours d'examen", etat: "attention" },
  CREDITE_OFFICE: { libelle: "Crédité d'office", etat: "succes" },
  ESCALADE: { libelle: "En cours d'examen", etat: "attention" },
  CLOTURE: { libelle: "Tranché", etat: "neutre" },
};

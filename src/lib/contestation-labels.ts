import type { MotifContestation, StatutDossier } from "@/generated/prisma";

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
};

/**
 * Jusqu'à quand un dîneur peut annuler — et ce qu'il lui reste quand il ne
 * peut plus.
 *
 * Le restaurant déclare son délai sur sa fiche (`Restaurant.delaiAnnulationHeures`,
 * en heures avant le créneau). Jusqu'ici personne ne le lisait : on pouvait
 * annuler à 19h59 une table de 20h, et c'est une table perdue.
 *
 * Module pur (aucun accès Prisma) : la même règle sert à l'écran qui propose
 * le bouton, au serveur qui accepte l'annulation, et à la carte de
 * réservation qui annonce la politique *avant* de réserver. Trois copies,
 * c'est trois occasions de promettre au dîneur autre chose que ce qu'on fera.
 */

import type { StatutReservation } from "@/generated/prisma";

/** Ce que ce module a besoin de savoir d'une réservation. */
export type ReservationAnnulable = {
  date: Date;
  statut: StatutReservation;
  absencePrevenueLe: Date | null;
};

/**
 * `null` : le restaurant n'a pas déclaré de délai, on peut annuler jusqu'au
 * créneau. C'est le comportement qui existait, gardé comme défaut explicite
 * plutôt que d'imposer une politique à qui n'en a pas choisi.
 *
 * Le délai se compte en heures réelles, pas en heures murales : « 24 h avant »
 * veut dire vingt-quatre heures, y compris le week-end du changement d'heure
 * où la limite tombe alors une heure à côté de l'heure du service. C'est la
 * lecture littérale d'un champ nommé `delaiAnnulationHeures`, et celle qui se
 * défend le mieux devant un restaurateur qui compte son temps de préparation.
 */
export function limiteAnnulation(dateCreneau: Date, delaiHeures: number | null): Date | null {
  if (delaiHeures === null || delaiHeures <= 0) return null;
  return new Date(dateCreneau.getTime() - delaiHeures * 60 * 1000);
}

export type Annulabilite =
  | { annulable: true }
  | {
      annulable: false;
      /**
       * `delai-depasse` est le seul refus qui laisse une porte : le créneau
       * est encore à venir, le dîneur peut prévenir qu'il ne viendra pas.
       * `non-annulable` couvre les trois statuts figés — annulée, honorée,
       * no-show — et pas seulement l'annulation.
       */
      raison: "non-annulable" | "creneau-passe" | "delai-depasse";
    };

export function annulabilite(
  reservation: ReservationAnnulable,
  delaiHeures: number | null,
  maintenant = new Date(),
): Annulabilite {
  if (reservation.statut !== "CONFIRMEE") return { annulable: false, raison: "non-annulable" };
  if (reservation.date.getTime() <= maintenant.getTime()) {
    return { annulable: false, raison: "creneau-passe" };
  }

  const limite = limiteAnnulation(reservation.date, delaiHeures);
  if (limite && maintenant.getTime() >= limite.getTime()) {
    return { annulable: false, raison: "delai-depasse" };
  }
  return { annulable: true };
}

/**
 * Prévenir n'a de sens que dans la fenêtre où l'on ne peut plus annuler mais
 * où le service est encore devant. Avant, on annule — c'est plus simple pour
 * tout le monde, et ça libère vraiment la table. Cette borne haute évite en
 * plus un état que l'interface ne sait pas produire : une réservation encore
 * annulable mais déjà signalée absente, que le restaurant verrait et pas le
 * dîneur.
 */
export function peutPrevenirAbsence(
  reservation: ReservationAnnulable,
  delaiHeures: number | null,
  maintenant = new Date(),
): boolean {
  if (reservation.absencePrevenueLe !== null) return false;
  const verdict = annulabilite(reservation, delaiHeures, maintenant);
  return !verdict.annulable && verdict.raison === "delai-depasse";
}

/** Ce qu'on dit au dîneur quand le bouton n'est pas là. Une phrase, pas un code. */
export const MESSAGES_REFUS_ANNULATION: Record<
  Exclude<Annulabilite, { annulable: true }>["raison"],
  string
> = {
  "non-annulable": "Cette réservation n'est plus annulable.",
  "creneau-passe": "Ce créneau est déjà passé, impossible d'annuler.",
  "delai-depasse": "Le délai d'annulation fixé par ce restaurant est dépassé.",
};

/**
 * "24 h avant" / "1 h avant", ou `null` quand aucun délai n'est déclaré — à
 * l'appelant de dire ce qu'il affiche alors, la formulation n'étant pas la
 * même sur une fiche et dans une liste de réservations.
 */
export function formaterDelaiAnnulation(delaiHeures: number | null): string | null {
  if (delaiHeures === null || delaiHeures <= 0) return null;
  if (delaiHeures % 24 === 0) {
    const jours = delaiHeures / 24;
    return `${jours} jour${jours > 1 ? "s" : ""} avant`;
  }
  return `${delaiHeures} h avant`;
}

/** La promesse faite au dîneur avant qu'il réserve, sur la carte de réservation. */
export function politiqueAnnulation(delaiHeures: number | null): string {
  const delai = formaterDelaiAnnulation(delaiHeures);
  return delai
    ? `annulation gratuite jusqu'à ${delai}`
    : "annulation gratuite jusqu'à l'heure du repas";
}

/**
 * Les horaires d'ouverture d'un restaurant, sous la forme qui sert à la fois
 * à les afficher et à décider des créneaux réservables.
 *
 * Module volontairement pur (aucun accès Prisma) : il est importé par des
 * composants client (`BookingCard`) autant que par le serveur. La lecture en
 * base, elle, est dans `src/lib/disponibilites.ts`.
 *
 * Une plage = un service continu sur un jour de semaine ISO (0 = lundi …
 * 6 = dimanche, voir `jourSemaineIso`). Ouvert midi et soir = deux plages sur
 * le même jour. Un jour sans plage est fermé, sauf si le restaurant n'a
 * aucune plage du tout, auquel cas il n'a rien déclaré et tous les créneaux
 * restent proposés (voir `horairesDeclares`).
 */

import { CRENEAUX_HORAIRES, JOURS_SEMAINE_ISO } from "./creneaux";

/** Les colonnes de `PlageOuverture` dont dépend ce module — jamais le modèle Prisma entier. */
export type Plage = {
  jourSemaine: number;
  /** Minutes depuis minuit, inclus (12h00 = 720). */
  debutMinutes: number;
  /** Minutes depuis minuit, exclu : on ne s'attable pas à l'heure de fermeture. */
  finMinutes: number;
};

/** Minutes depuis minuit d'un créneau "HH:mm", ou `null` si le format ne s'y prête pas. */
export function minutesDepuisCreneau(creneau: string): number | null {
  const correspondance = /^(\d{2}):(\d{2})$/.exec(creneau);
  if (!correspondance) return null;
  const heures = Number(correspondance[1]);
  const minutes = Number(correspondance[2]);
  if (heures > 23 || minutes > 59) return null;
  return heures * 60 + minutes;
}

/** Fermeture à minuit : 24h00 en minutes, borne haute légitime d'une plage. */
export const MINUIT = 24 * 60;

/**
 * Format français compact, celui que les restaurants écrivaient déjà
 * eux-mêmes dans l'ancien champ texte : "12h" à l'heure pile, "22h30" sinon.
 * Et "minuit" plutôt que "24h", qui ne se dit pas.
 */
export function formaterMinutes(minutes: number): string {
  if (minutes === MINUIT) return "minuit";
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${heures}h` : `${heures}h${String(reste).padStart(2, "0")}`;
}

/** Le restaurant a-t-il déclaré ses horaires ? Sinon, tous les créneaux restent proposés. */
export function horairesDeclares(plages: Plage[]): boolean {
  return plages.length > 0;
}

/**
 * Ce créneau tombe-t-il dans un service déclaré ce jour de semaine ?
 * Ne tient pas compte des exceptions datées (voir `disponibilites.ts`).
 */
export function creneauDansLesHoraires(
  plages: Plage[],
  jourSemaine: number,
  creneau: string,
): boolean {
  if (!horairesDeclares(plages)) return true;
  const minutes = minutesDepuisCreneau(creneau);
  if (minutes === null) return false;
  return plages.some(
    (plage) =>
      plage.jourSemaine === jourSemaine &&
      minutes >= plage.debutMinutes &&
      minutes < plage.finMinutes,
  );
}

/** Les créneaux réservables d'un jour de semaine, d'après les seuls horaires déclarés. */
export function creneauxDuJourSemaine(plages: Plage[], jourSemaine: number): string[] {
  return CRENEAUX_HORAIRES.filter((creneau) =>
    creneauDansLesHoraires(plages, jourSemaine, creneau),
  );
}

function plagesDuJour(plages: Plage[], jourSemaine: number): Plage[] {
  return plages
    .filter((plage) => plage.jourSemaine === jourSemaine)
    .sort((a, b) => a.debutMinutes - b.debutMinutes);
}

/** "12h – 14h · 19h – 22h30", ou chaîne vide si le jour est fermé. */
function libellePlages(plages: Plage[]): string {
  return plages
    .map((plage) => `${formaterMinutes(plage.debutMinutes)} – ${formaterMinutes(plage.finMinutes)}`)
    .join(" · ");
}

function libelleJours(premier: number, dernier: number): string {
  const debut = JOURS_SEMAINE_ISO[premier]!;
  if (premier === dernier) return debut;
  const fin = JOURS_SEMAINE_ISO[dernier]!.toLowerCase();
  return premier + 1 === dernier ? `${debut} et ${fin}` : `${debut} – ${fin}`;
}

/**
 * Les horaires en lignes lisibles, jours consécutifs identiques regroupés :
 * ["Mardi – samedi : 12h – 14h · 19h – 22h30", "Fermé : lundi, dimanche"].
 * Rend une liste vide quand rien n'est déclaré — à l'appelant de dire ce
 * qu'il affiche alors (voir la fiche restaurant).
 */
export function formaterHoraires(plages: Plage[]): string[] {
  if (!horairesDeclares(plages)) return [];

  const parJour = JOURS_SEMAINE_ISO.map((_, jourSemaine) =>
    libellePlages(plagesDuJour(plages, jourSemaine)),
  );

  const lignes: string[] = [];
  let debutGroupe = 0;
  for (let jour = 0; jour <= parJour.length; jour++) {
    // Un groupe se ferme au changement de libellé (donc aussi en fin de semaine).
    if (jour < parJour.length && parJour[jour] === parJour[debutGroupe]) continue;
    const libelle = parJour[debutGroupe]!;
    if (libelle !== "") lignes.push(`${libelleJours(debutGroupe, jour - 1)} : ${libelle}`);
    debutGroupe = jour;
  }

  const fermes = JOURS_SEMAINE_ISO.filter((_, jour) => parJour[jour] === "").map((label) =>
    label.toLowerCase(),
  );
  if (fermes.length > 0) lignes.push(`Fermé : ${fermes.join(", ")}`);

  return lignes;
}

/**
 * Range les plages d'un même jour et fond celles qui se chevauchent ou se
 * touchent : "12h – 14h" ajoutée à "13h – 15h" fait un seul service de 12h à
 * 15h, pas deux lignes qui disent la même chose. Appelé à l'écriture (voir
 * "Mes disponibilités") pour que la base ne garde jamais deux façons de
 * décrire la même ouverture.
 */
export function fusionnerPlages(
  plages: { debutMinutes: number; finMinutes: number }[],
): { debutMinutes: number; finMinutes: number }[] {
  const triees = [...plages].sort((a, b) => a.debutMinutes - b.debutMinutes);
  const fusionnees: { debutMinutes: number; finMinutes: number }[] = [];
  for (const plage of triees) {
    const precedente = fusionnees[fusionnees.length - 1];
    if (precedente && plage.debutMinutes <= precedente.finMinutes) {
      precedente.finMinutes = Math.max(precedente.finMinutes, plage.finMinutes);
    } else {
      fusionnees.push({ debutMinutes: plage.debutMinutes, finMinutes: plage.finMinutes });
    }
  }
  return fusionnees;
}

/** Minutes depuis minuit d'une valeur d'`<input type="time">`, ou `null` si elle ne s'y prête pas. */
export function minutesDepuisHeureInput(valeur: FormDataEntryValue | null): number | null {
  return typeof valeur === "string" ? minutesDepuisCreneau(valeur) : null;
}

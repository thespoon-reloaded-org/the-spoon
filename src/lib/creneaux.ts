/**
 * Créneaux de réservation : constantes partagées entre la fiche établissement
 * (génère les options affichées) et l'action serveur (valide ce qui est
 * reçu). Pas de moteur de disponibilité/capacité — un créneau est valide s'il
 * correspond à l'une de ces constantes et tombe dans la fenêtre réservable.
 *
 * Toutes les dates d'ici sont des heures murales parisiennes, jamais des
 * heures serveur : « le créneau de 19h du 22 septembre » veut dire 19h à
 * Paris, que le code tourne sur un poste français ou sur une machine en UTC.
 * Voir `src/lib/fuseau.ts`, qui porte cette décision et les conversions.
 */

import {
  ajouterJours,
  aujourdHuiIso,
  composantesLocales,
  instantLocalDeJour,
  jourEtHeureLocaux,
  jourIsoValide,
  jourSemaineIso,
  moisIsoValide,
} from "./fuseau";

export const NB_JOURS_RESERVABLES = 5;

export const CRENEAUX_MIDI = ["12:00", "12:30", "13:00", "13:30"] as const;

export const CRENEAUX_SOIR = [
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
] as const;

/** Toujours groupés par service (midi/soir) à l'affichage — voir `BookingCard` et "Mes disponibilités". */
export const CRENEAUX_HORAIRES = [...CRENEAUX_MIDI, ...CRENEAUX_SOIR] as const;

export type CreneauHoraire = (typeof CRENEAUX_HORAIRES)[number];

export const TAILLES_TABLE = [
  { valeur: 1, label: "1" },
  { valeur: 2, label: "2" },
  { valeur: 3, label: "3" },
  { valeur: 4, label: "4" },
  { valeur: 5, label: "5" },
  { valeur: 6, label: "6+" },
] as const;

export type JourReservable = {
  /** Format YYYY-MM-DD — identifiant stable transmis entre serveur et client. */
  iso: string;
  jourSemaine: string;
  numero: string;
};

/** Abrégés des jours, dans l'ordre ISO (0 = lundi) — comme `jourSemaineIso`. */
export const JOURS_SEMAINE_COURTS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** Le quantième affiché, sans son zéro de tête : « 2 », pas « 02 ». */
function numeroDuJour(jourIso: string): number {
  return Number(jourIso.slice(8, 10));
}

export function genererJoursReservables(depuis = new Date()): JourReservable[] {
  const premier = aujourdHuiIso(depuis);
  return Array.from({ length: NB_JOURS_RESERVABLES }, (_, i) => {
    const iso = ajouterJours(premier, i);
    return {
      iso,
      jourSemaine: JOURS_SEMAINE_COURTS[jourSemaineIso(iso)]!,
      numero: String(numeroDuJour(iso)),
    };
  });
}

function estCreneauValide(creneau: string): creneau is CreneauHoraire {
  return (CRENEAUX_HORAIRES as readonly string[]).includes(creneau);
}

/**
 * Combine un jour (YYYY-MM-DD) et un créneau ("HH:mm") en l'instant où ce
 * créneau tombe à Paris, ou `null` si l'un des deux ne tient pas debout.
 * C'est cet instant qui part en base : une table réservée à 19h l'est à 19h
 * heure de Paris, y compris quand le serveur pense qu'il est 17h.
 */
export function construireDateCreneau(jourIso: string, creneau: string): Date | null {
  if (!jourIsoValide(jourIso) || !estCreneauValide(creneau)) return null;
  const [heures, minutes] = creneau.split(":").map(Number) as [number, number];
  return instantLocalDeJour(jourIso, heures, minutes);
}

/**
 * Inverse de `construireDateCreneau` : sérialise un instant en clé
 * "YYYY-MM-DD_HH:mm" telle qu'on la lirait à Paris — sert à indexer
 * l'occupation d'un créneau (voir `reservation.ts`) sur la même clé côté
 * calcul serveur et côté affichage.
 */
export function cleCreneau(date: Date): string {
  const { jour, heure } = jourEtHeureLocaux(date);
  return `${jour}_${heure}`;
}

/**
 * La fenêtre réservable court jusqu'à la même heure, `NB_JOURS_RESERVABLES`
 * jours plus tard — calculée sur le calendrier parisien, pour qu'un week-end
 * de changement d'heure ne la rallonge ni ne la raccourcisse d'une heure.
 */
export function estDansLaFenetreReservable(date: Date, maintenant = new Date()): boolean {
  const { heures, minutes, secondes } = composantesLocales(maintenant);
  const limiteIso = ajouterJours(aujourdHuiIso(maintenant), NB_JOURS_RESERVABLES);
  const limite = instantLocalDeJour(limiteIso, heures, minutes, secondes);
  return date.getTime() > maintenant.getTime() && date.getTime() < limite.getTime();
}

/**
 * Jours de la semaine en index ISO (0 = lundi … 6 = dimanche), pas l'index
 * `Date.getDay()` (0 = dimanche) — plus naturel pour afficher un planning
 * hebdomadaire à la française. Voir `jourSemaineIso`.
 */
export const JOURS_SEMAINE_ISO = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export type JourCalendrier = {
  /** Format YYYY-MM-DD. */
  iso: string;
  numero: number;
  horsMois: boolean;
  estPasse: boolean;
  estAujourdhui: boolean;
};

/** Grille d'un mois calendaire, complétée par les jours des mois adjacents pour aligner les semaines (lundi-dimanche). */
export function genererGrilleMois(
  moisIsoActuel: string,
  aujourdHui = new Date(),
): JourCalendrier[] {
  if (!moisIsoValide(moisIsoActuel)) {
    throw new Error(`Mois invalide : "${moisIsoActuel}" — attendu AAAA-MM.`);
  }
  const premierDuMois = `${moisIsoActuel}-01`;
  const debutGrille = ajouterJours(premierDuMois, -jourSemaineIso(premierDuMois));
  const jourCourant = aujourdHuiIso(aujourdHui);

  return Array.from({ length: 42 }, (_, i) => {
    const iso = ajouterJours(debutGrille, i);
    return {
      iso,
      numero: numeroDuJour(iso),
      // Comparaison de chaînes sûre : `moisIsoValide` a garanti le zéro de tête.
      horsMois: iso.slice(0, 7) !== moisIsoActuel,
      estPasse: iso < jourCourant,
      estAujourdhui: iso === jourCourant,
    };
  });
}

const MOIS_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function formatMoisLabel(moisIsoActuel: string): string {
  const [annee, mois] = moisIsoActuel.split("-").map(Number) as [number, number];
  return `${MOIS_LABELS[mois - 1]} ${annee}`;
}

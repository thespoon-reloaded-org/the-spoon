/**
 * Créneaux de réservation : constantes partagées entre la fiche établissement
 * (génère les options affichées) et l'action serveur (valide ce qui est
 * reçu). Pas de moteur de disponibilité/capacité — un créneau est valide s'il
 * correspond à l'une de ces constantes et tombe dans la fenêtre réservable.
 */

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

const JOURS_SEMAINE = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/**
 * Sérialise une Date en YYYY-MM-DD à partir de ses composantes locales.
 * `Date.toISOString()` convertit d'abord en UTC — sur un fuseau en avance
 * (Europe/Paris, UTC+2 l'été), minuit local devient 22h la veille en UTC,
 * décalant la date d'un jour. Toujours passer par les composantes locales
 * pour un identifiant de jour, jamais par `toISOString`.
 */
export function formatIso(date: Date): string {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

export function genererJoursReservables(depuis = new Date()): JourReservable[] {
  return Array.from({ length: NB_JOURS_RESERVABLES }, (_, i) => {
    const jour = new Date(depuis);
    jour.setDate(jour.getDate() + i);
    return {
      iso: formatIso(jour),
      jourSemaine: JOURS_SEMAINE[jour.getDay()]!,
      numero: String(jour.getDate()),
    };
  });
}

function estCreneauValide(creneau: string): creneau is CreneauHoraire {
  return (CRENEAUX_HORAIRES as readonly string[]).includes(creneau);
}

/** Combine un jour (YYYY-MM-DD) et un créneau ("HH:mm") en Date locale, ou null si le format est invalide. */
export function construireDateCreneau(jourIso: string, creneau: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jourIso) || !estCreneauValide(creneau)) return null;
  const date = new Date(`${jourIso}T${creneau}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function estDansLaFenetreReservable(date: Date, maintenant = new Date()): boolean {
  const limite = new Date(maintenant);
  limite.setDate(limite.getDate() + NB_JOURS_RESERVABLES);
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

export function jourSemaineIso(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export type JourCalendrier = {
  /** Format YYYY-MM-DD. */
  iso: string;
  numero: number;
  horsMois: boolean;
  estPasse: boolean;
  estAujourdhui: boolean;
};

/** Grille d'un mois calendaire, complétée par les jours des mois adjacents pour aligner les semaines (lundi-dimanche). */
export function genererGrilleMois(moisIso: string, aujourdHui = new Date()): JourCalendrier[] {
  const [annee, mois] = moisIso.split("-").map(Number) as [number, number];
  const premierDuMois = new Date(annee, mois - 1, 1);
  const decalage = jourSemaineIso(premierDuMois);
  const debutGrille = new Date(premierDuMois);
  debutGrille.setDate(debutGrille.getDate() - decalage);

  const aujourdHuiIso = formatIso(aujourdHui);

  return Array.from({ length: 42 }, (_, i) => {
    const jour = new Date(debutGrille);
    jour.setDate(jour.getDate() + i);
    const iso = formatIso(jour);
    return {
      iso,
      numero: jour.getDate(),
      horsMois: jour.getMonth() !== mois - 1,
      estPasse: iso < aujourdHuiIso,
      estAujourdhui: iso === aujourdHuiIso,
    };
  });
}

export function moisIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function moisAdjacent(moisIsoActuel: string, delta: number): string {
  const [annee, mois] = moisIsoActuel.split("-").map(Number) as [number, number];
  const date = new Date(annee, mois - 1 + delta, 1);
  return moisIso(date);
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

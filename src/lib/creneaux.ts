/**
 * Créneaux de réservation : constantes partagées entre la fiche établissement
 * (génère les options affichées) et l'action serveur (valide ce qui est
 * reçu). Pas de moteur de disponibilité/capacité — un créneau est valide s'il
 * correspond à l'une de ces constantes et tombe dans la fenêtre réservable.
 */

export const NB_JOURS_RESERVABLES = 5;

export const CRENEAUX_HORAIRES = [
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
] as const;

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

export function genererJoursReservables(depuis = new Date()): JourReservable[] {
  return Array.from({ length: NB_JOURS_RESERVABLES }, (_, i) => {
    const jour = new Date(depuis);
    jour.setDate(jour.getDate() + i);
    return {
      iso: jour.toISOString().slice(0, 10),
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

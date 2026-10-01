/**
 * Les indicateurs du tableau de bord staff : ce que font les dîneurs, où ils
 * vont, et s'ils sont contents de ce qu'on leur sert.
 *
 * Rien n'est stocké : tout se recalcule à l'affichage depuis les
 * réservations, les avis et les propositions de l'assistant. Ce module ne
 * fait que compter — les lectures en base sont dans la page
 * (`src/app/admin/tableau-de-bord/page.tsx`), comme sur le tableau de bord
 * restaurant. Il reste ainsi testable sans base.
 *
 * Une règle tient tout le module : **rien à compter n'est pas zéro**. Un taux
 * de no-show sur aucun service pointé n'est pas 0 %, une satisfaction sans
 * vote n'est pas 100 % — ces cas rendent `null`, et l'écran affiche « — »
 * avec la raison. Même principe que « non renseigné n'est pas sans
 * allergène » (README).
 */

import type { StatutReservation, VerdictProposition } from "@/generated/prisma";

import {
  ajouterJours,
  aujourdHuiIso,
  composantesLocales,
  debutDeJournee,
  instantLocalDeJour,
  jourEtHeureLocaux,
  jourSemaineIso,
} from "./fuseau";

// ---------------------------------------------------------------------------
//  La période
// ---------------------------------------------------------------------------

/** Les fenêtres proposées, en jours. */
export const PERIODES = [7, 30, 90] as const;

export type Periode = (typeof PERIODES)[number];

export const PERIODE_PAR_DEFAUT: Periode = 30;

/** `?periode=` tel que reçu dans l'URL — ce qui n'est pas une période proposée retombe sur le défaut. */
export function lirePeriode(valeur: string | string[] | undefined): Periode {
  const lue = Number(Array.isArray(valeur) ? valeur[0] : valeur);
  return PERIODES.find((periode) => periode === lue) ?? PERIODE_PAR_DEFAUT;
}

export type Bornes = { debut: Date; fin: Date };

/**
 * La période affichée et celle à laquelle on la compare.
 *
 * La période affichée couvre les `n` derniers jours de Paris, aujourd'hui
 * compris : de minuit il y a `n - 1` jours jusqu'à maintenant. La précédente
 * a la même durée, décalée de `n` jours — elle s'arrête à la même heure de la
 * journée. La comparer à `n` jours pleins pénaliserait la période en cours de
 * sa journée pas finie : un mardi à 9h, les 7 derniers jours compteraient
 * presque un jour de moins que les 7 précédents, et afficheraient une baisse
 * qui n'existe pas.
 */
export function bornesPeriode(
  periode: Periode,
  maintenant = new Date(),
): { courante: Bornes; precedente: Bornes } {
  const aujourdHui = aujourdHuiIso(maintenant);
  const { heures, minutes, secondes } = composantesLocales(maintenant);
  return {
    courante: { debut: debutDeJournee(ajouterJours(aujourdHui, 1 - periode)), fin: maintenant },
    precedente: {
      debut: debutDeJournee(ajouterJours(aujourdHui, 1 - 2 * periode)),
      fin: instantLocalDeJour(ajouterJours(aujourdHui, -periode), heures, minutes, secondes),
    },
  };
}

// ---------------------------------------------------------------------------
//  Ratios
// ---------------------------------------------------------------------------

/** Une part entre 0 et 1, ou `null` quand il n'y a rien à rapporter : 0 sur 0 n'est pas 0 %. */
export function part(nombre: number, total: number): number | null {
  return total > 0 ? nombre / total : null;
}

/** Variation relative, ou `null` si la période précédente est vide — « +∞ % » ne dit rien. */
export function evolution(actuel: number, precedent: number): number | null {
  return precedent > 0 ? (actuel - precedent) / precedent : null;
}

/** "42 %", ou "—" quand la part n'existe pas. */
export function formaterPart(valeur: number | null): string {
  if (valeur === null) return "—";
  return valeur.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 0 });
}

/** "+12 %", "-8 %" — signée, et « stable » quand l'écart s'arrondit à zéro. */
export function formaterEvolution(valeur: number): string {
  if (Math.round(valeur * 100) === 0) return "stable";
  return valeur.toLocaleString("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
    signDisplay: "always",
  });
}

// ---------------------------------------------------------------------------
//  Activité — les réservations prises sur la période
// ---------------------------------------------------------------------------

export type ReservationActivite = { statut: StatutReservation; couverts: number; userId: string };

export type Activite = {
  /** Toutes les réservations prises, annulées comprises : c'est l'intention qui compte ici. */
  reservations: number;
  annulees: number;
  /** Couverts des réservations non annulées. */
  couverts: number;
  /** Dîneurs ayant pris au moins une réservation, même annulée depuis. */
  dineursActifs: number;
  /**
   * Dîneurs ayant au moins deux réservations non annulées sur la période.
   * Annuler puis reprendre une table n'est pas revenir.
   */
  dineursFideles: number;
};

export function activite(reservations: readonly ReservationActivite[]): Activite {
  let annulees = 0;
  let couverts = 0;
  const maintenuesParDineur = new Map<string, number>();

  for (const reservation of reservations) {
    const dejaVues = maintenuesParDineur.get(reservation.userId) ?? 0;
    if (reservation.statut === "ANNULEE") {
      annulees += 1;
      maintenuesParDineur.set(reservation.userId, dejaVues);
    } else {
      couverts += reservation.couverts;
      maintenuesParDineur.set(reservation.userId, dejaVues + 1);
    }
  }

  let dineursFideles = 0;
  for (const maintenues of maintenuesParDineur.values()) {
    if (maintenues >= 2) dineursFideles += 1;
  }

  return {
    reservations: reservations.length,
    annulees,
    couverts,
    dineursActifs: maintenuesParDineur.size,
    dineursFideles,
  };
}

// ---------------------------------------------------------------------------
//  Habitudes — quand ils viennent, et où
// ---------------------------------------------------------------------------

export type ReservationHabitude = ReservationActivite & { date: Date; restaurantId: string };

export type RestaurantLu = { nom: string; ville: string; cuisine: string };

export type EntreeClassement = {
  cle: string;
  libelle: string;
  nombre: number;
  /** Part des réservations non annulées de la période. */
  part: number;
};

export type Habitudes = {
  /** Réservations non annulées : la base de tout ce qui suit. */
  total: number;
  /** Par jour de service, 0 = lundi … 6 = dimanche (`jourSemaineIso`). */
  parJourSemaine: number[];
  midi: number;
  soir: number;
  restaurants: EntreeClassement[];
  villes: EntreeClassement[];
  cuisines: EntreeClassement[];
};

/**
 * Le midi s'arrête bien avant le premier créneau du soir (18h30, voir
 * `CRENEAUX_SOIR`) : une coupure à 16h ne dépend pas de la grille exacte.
 */
const FIN_DU_MIDI = "16:00";

/** Combien de lignes par classement : au-delà, c'est une liste, plus un indicateur. */
export const TAILLE_CLASSEMENT = 5;

function classer(
  comptes: Map<string, { libelle: string; nombre: number }>,
  total: number,
): EntreeClassement[] {
  return [...comptes.entries()]
    .map(([cle, { libelle, nombre }]) => ({ cle, libelle, nombre, part: nombre / total }))
    .sort((a, b) => b.nombre - a.nombre || a.libelle.localeCompare(b.libelle, "fr"))
    .slice(0, TAILLE_CLASSEMENT);
}

function compter(
  comptes: Map<string, { libelle: string; nombre: number }>,
  cle: string,
  libelle: string,
) {
  const entree = comptes.get(cle);
  if (entree) entree.nombre += 1;
  else comptes.set(cle, { libelle, nombre: 1 });
}

/**
 * Jour et service se lisent à l'heure de Paris, sur la date du créneau — pas
 * sur celle de la prise de réservation : « le samedi soir », c'est quand on
 * dîne, pas quand on a cliqué.
 */
export function habitudes(
  reservations: readonly ReservationHabitude[],
  restaurantsParId: ReadonlyMap<string, RestaurantLu>,
): Habitudes {
  const parJourSemaine = [0, 0, 0, 0, 0, 0, 0];
  let midi = 0;
  let soir = 0;
  const restaurants = new Map<string, { libelle: string; nombre: number }>();
  const villes = new Map<string, { libelle: string; nombre: number }>();
  const cuisines = new Map<string, { libelle: string; nombre: number }>();

  const maintenues = reservations.filter((reservation) => reservation.statut !== "ANNULEE");

  for (const reservation of maintenues) {
    const { jour, heure } = jourEtHeureLocaux(reservation.date);
    parJourSemaine[jourSemaineIso(jour)]! += 1;
    if (heure < FIN_DU_MIDI) midi += 1;
    else soir += 1;

    const restaurant = restaurantsParId.get(reservation.restaurantId);
    if (!restaurant) continue;
    compter(restaurants, reservation.restaurantId, restaurant.nom);
    // Regroupées sans tenir compte de la casse ni des espaces : « Paris » et
    // « paris » sont la même ville, saisie deux fois.
    compter(villes, restaurant.ville.trim().toLocaleLowerCase("fr"), restaurant.ville.trim());
    compter(cuisines, restaurant.cuisine.trim().toLocaleLowerCase("fr"), restaurant.cuisine.trim());
  }

  const total = maintenues.length;
  return {
    total,
    parJourSemaine,
    midi,
    soir,
    restaurants: classer(restaurants, total),
    villes: classer(villes, total),
    cuisines: classer(cuisines, total),
  };
}

// ---------------------------------------------------------------------------
//  Fiabilité — les services passés de la période
// ---------------------------------------------------------------------------

export type Fiabilite = {
  honorees: number;
  noShows: number;
  /** Créneaux passés que le restaurant n'a pas encore pointés honoré ou no-show. */
  nonPointees: number;
  /**
   * No-shows sur les services pointés seulement. Un créneau pas encore pointé
   * n'est ni honoré ni no-show : le compter dans un sens ou dans l'autre
   * inventerait une réponse que le restaurant n'a pas donnée.
   */
  tauxNoShow: number | null;
};

export function fiabilite(parStatut: Partial<Record<StatutReservation, number>>): Fiabilite {
  const honorees = parStatut.HONOREE ?? 0;
  const noShows = parStatut.NO_SHOW ?? 0;
  return {
    honorees,
    noShows,
    nonPointees: parStatut.CONFIRMEE ?? 0,
    tauxNoShow: part(noShows, honorees + noShows),
  };
}

// ---------------------------------------------------------------------------
//  Satisfaction — les avis, et les verdicts sur l'assistant
// ---------------------------------------------------------------------------

export type SyntheseAvis = {
  total: number;
  moyenne: number | null;
  /** Nombre d'avis par note, index 0 = 1 cuillère … 4 = 5 cuillères. */
  parNote: number[];
};

export function syntheseAvis(parNote: ReadonlyMap<number, number>): SyntheseAvis {
  const repartition = [1, 2, 3, 4, 5].map((note) => parNote.get(note) ?? 0);
  const total = repartition.reduce((somme, nombre) => somme + nombre, 0);
  const points = repartition.reduce((somme, nombre, index) => somme + nombre * (index + 1), 0);
  return { total, moyenne: total > 0 ? points / total : null, parNote: repartition };
}

export type SyntheseAssistant = {
  /** Top 10 servis par l'assistant. */
  servies: number;
  aime: number;
  aimePas: number;
  /** Part des propositions servies qui ont reçu un vote. */
  tauxVote: number | null;
  /** Cœurs pleins sur les propositions votées — pas sur les servies : se taire n'est pas aimer. */
  satisfaction: number | null;
};

export function syntheseAssistant(
  parVerdict: ReadonlyMap<VerdictProposition | null, number>,
): SyntheseAssistant {
  const aime = parVerdict.get("AIME") ?? 0;
  const aimePas = parVerdict.get("AIME_PAS") ?? 0;
  const servies = aime + aimePas + (parVerdict.get(null) ?? 0);
  return {
    servies,
    aime,
    aimePas,
    tauxVote: part(aime + aimePas, servies),
    satisfaction: part(aime, aime + aimePas),
  };
}

/**
 * L'heure de Paris — comment on la lit, comment on l'écrit.
 *
 * Le produit est français, ses serveurs ne le sont pas : en production
 * (Netlify) le code tourne en UTC. Tout ce qui touche à une heure murale —
 * « le créneau de 19h du 22 septembre » — doit donc nommer son fuseau, sans
 * quoi la même ligne de code donne deux instants différents selon la machine
 * qui l'exécute. C'était le cas de toutes les dates de réservation : `new
 * Date("2026-09-22T19:00:00")` donnait 19h à Paris sur un poste de dev et 19h
 * UTC — soit 21h à Paris — en production, et c'est cette valeur-là qui
 * partait en base.
 *
 * Un seul fuseau, pas celui du restaurant : tous les partenaires sont en
 * France métropolitaine. Le jour où ce ne sera plus vrai, c'est ici que la
 * question se posera.
 *
 * Et surtout : le fuseau se nomme à chaque conversion, il ne se règle pas une
 * fois pour toutes. La tentative précédente était un `process.env.TZ ??=
 * "Europe/Paris"` au chargement de `env.ts` — elle rendait le défaut
 * invisible en dev (où le poste est déjà à Paris) sans rien changer en
 * production : les réservations déposées six jours après sa mise en place y
 * sont toujours enregistrées avec deux heures d'avance. Un réglage global
 * qu'aucun test ne peut contredire n'est pas une garantie ; les tests de ce
 * module, eux, passent sous n'importe quel fuseau machine.
 */

export const FUSEAU = "Europe/Paris";

/** Les composantes d'un instant, telles qu'un Parisien les lirait sur une horloge. */
export type ComposantesLocales = {
  annee: number;
  mois: number;
  jour: number;
  heures: number;
  minutes: number;
  secondes: number;
};

/**
 * `hourCycle: "h23"` et pas `hour12: false` : ce dernier rend « 24 » pour
 * minuit sur certaines versions d'ICU, ce qui décale la date d'un jour au
 * moment de recomposer.
 */
const LECTEUR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function composantesLocales(instant: Date): ComposantesLocales {
  const parties = Object.fromEntries(
    LECTEUR.formatToParts(instant).map((partie) => [partie.type, partie.value]),
  );
  return {
    annee: Number(parties.year),
    mois: Number(parties.month),
    jour: Number(parties.day),
    heures: Number(parties.hour),
    minutes: Number(parties.minute),
    secondes: Number(parties.second),
  };
}

/** Décalage du fuseau sur UTC à cet instant précis, en millisecondes (été ≠ hiver). */
function decalage(instant: Date): number {
  const c = composantesLocales(instant);
  return Date.UTC(c.annee, c.mois - 1, c.jour, c.heures, c.minutes, c.secondes) - instant.getTime();
}

/**
 * L'instant absolu d'une heure murale parisienne. Le décalage se lit à
 * l'instant obtenu, pas à celui qu'on cherchait : la nuit du changement
 * d'heure, une première approximation peut tomber du mauvais côté de la
 * bascule, d'où la seconde lecture.
 *
 * Les heures qui n'existent pas (2h30 le dernier dimanche de mars) rendent
 * l'instant de la bascule. Nos créneaux vont de 11h à minuit, ils ne touchent
 * jamais ce trou.
 */
export function instantLocal(
  annee: number,
  mois: number,
  jour: number,
  heures = 0,
  minutes = 0,
): Date {
  const commeSiUtc = Date.UTC(annee, mois - 1, jour, heures, minutes);
  const premier = decalage(new Date(commeSiUtc));
  const candidat = commeSiUtc - premier;
  const second = decalage(new Date(candidat));
  return new Date(second === premier ? candidat : commeSiUtc - second);
}

/** Le jour "YYYY-MM-DD" sur lequel tombe cet instant à Paris. */
export function jourIsoLocal(instant: Date): string {
  const { annee, mois, jour } = composantesLocales(instant);
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Minuit à Paris, au début du jour "YYYY-MM-DD" — la borne d'une journée de service. */
export function debutDeJournee(jourIso: string): Date {
  const [annee, mois, jour] = jourIso.split("-").map(Number) as [number, number, number];
  return instantLocal(annee, mois, jour);
}

/** L'heure "HH:mm" qu'affiche une horloge parisienne à cet instant. */
export function heureLocale(instant: Date): string {
  const { heures, minutes } = composantesLocales(instant);
  return `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
//  Le calendrier parisien
//
//  Un jour "YYYY-MM-DD" est une date, pas un instant : personne n'a besoin de
//  savoir à quelle seconde il commence pour dire quel jour de la semaine
//  c'est, ou quel jour vient après. On le manipule donc en UTC, où tous les
//  jours durent vingt-quatre heures — le 25 octobre y compris. Le fuseau ne
//  revient qu'aux deux frontières : dire quel jour on est (`aujourdHuiIso`),
//  et donner à un jour son instant (`debutDeJournee`).
// ---------------------------------------------------------------------------

const REGEX_JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

function calendrier(jourIso: string): Date {
  const [annee, mois, jour] = jourIso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(annee, mois - 1, jour));
}

function isoDuCalendrier(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Un jour au format attendu **et** qui existe : `Date.UTC` reporte
 * silencieusement un 31 février sur mars, là où une construction par chaîne
 * rendait une date invalide qu'on savait rejeter.
 */
export function jourIsoValide(jourIso: string): boolean {
  return REGEX_JOUR_ISO.test(jourIso) && isoDuCalendrier(calendrier(jourIso)) === jourIso;
}

export function ajouterJours(jourIso: string, jours: number): string {
  const date = calendrier(jourIso);
  date.setUTCDate(date.getUTCDate() + jours);
  return isoDuCalendrier(date);
}

/** Le jour qu'on est à Paris — pas celui du serveur. */
export function aujourdHuiIso(maintenant = new Date()): string {
  return jourIsoLocal(maintenant);
}

/** 0 = lundi … 6 = dimanche — l'ordre français, pas celui de `Date.getDay()`. Libellés : `JOURS_SEMAINE_ISO`. */
export function jourSemaineIso(jourIso: string): number {
  return (calendrier(jourIso).getUTCDay() + 6) % 7;
}

/** Le mois "YYYY-MM" qu'on est à Paris. */
export function moisIso(date = new Date()): string {
  return aujourdHuiIso(date).slice(0, 7);
}

export function moisAdjacent(moisIsoActuel: string, delta: number): string {
  const [annee, mois] = moisIsoActuel.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(annee, mois - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
//  Affichage
//
//  Passer par ces fonctions plutôt que par `toLocaleDateString` /
//  `toLocaleTimeString` directement : sans `timeZone`, le rendu suit la
//  machine, et une réservation de 19h s'affiche 17h en production. L'oubli ne
//  se voit pas en dev, où le serveur est déjà à Paris.
// ---------------------------------------------------------------------------

/** `toLocaleDateString` avec le fuseau imposé — pour les formats qui ne servent qu'une fois. */
export function formaterDate(instant: Date, options: Intl.DateTimeFormatOptions): string {
  return instant.toLocaleDateString("fr-FR", { ...options, timeZone: FUSEAU });
}

/** "mardi 22 septembre" — la date d'une réservation, telle qu'on l'annonce au dîneur. */
export function formaterJourLong(instant: Date): string {
  return formaterDate(instant, { weekday: "long", day: "numeric", month: "long" });
}

/** "mar. 22 sept." — la même date dans une liste ou sur une ligne de facture. */
export function formaterJourCourt(instant: Date): string {
  return formaterDate(instant, { weekday: "short", day: "numeric", month: "short" });
}

/** "19:30". */
export function formaterHeure(instant: Date): string {
  return instant.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU,
  });
}

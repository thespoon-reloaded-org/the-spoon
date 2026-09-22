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
  secondes = 0,
): Date {
  const commeSiUtc = Date.UTC(annee, mois - 1, jour, heures, minutes, secondes);
  const premier = decalage(new Date(commeSiUtc));
  const candidat = commeSiUtc - premier;
  const second = decalage(new Date(candidat));
  return new Date(second === premier ? candidat : commeSiUtc - second);
}

/** Le jour "YYYY-MM-DD" sur lequel tombe cet instant à Paris. */
export function jourIsoLocal(instant: Date): string {
  return jourDesComposantes(composantesLocales(instant));
}

/**
 * L'instant parisien d'une heure murale donnée un jour donné — le seul
 * endroit qui découpe une chaîne "AAAA-MM-JJ" pour la donner à
 * `instantLocal`. Lève si le jour n'existe pas : ces fonctions sont appelées
 * avec des valeurs déjà validées (`jourIsoValide`), et un jour bancal qui
 * passerait quand même vaut mieux bruyant que silencieusement décalé.
 */
export function instantLocalDeJour(jourIso: string, heures = 0, minutes = 0, secondes = 0): Date {
  const { annee, mois, jour } = composantesDuJour(jourIso);
  return instantLocal(annee, mois, jour, heures, minutes, secondes);
}

/** Minuit à Paris, au début du jour "YYYY-MM-DD" — la borne d'une journée de service. */
export function debutDeJournee(jourIso: string): Date {
  return instantLocalDeJour(jourIso);
}

/** L'heure "HH:mm" qu'affiche une horloge parisienne à cet instant. */
export function heureLocale(instant: Date): string {
  return heureDesComposantes(composantesLocales(instant));
}

function jourDesComposantes({ annee, mois, jour }: ComposantesLocales): string {
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

function heureDesComposantes({ heures, minutes }: ComposantesLocales): string {
  return `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Jour et heure d'un même instant, lus en une fois — `jourIsoLocal` suivi de
 * `heureLocale` ferait deux formatages ICU pour la même horloge, et c'est
 * appelé par créneau à chaque rendu de la carte de réservation.
 */
export function jourEtHeureLocaux(instant: Date): { jour: string; heure: string } {
  const composantes = composantesLocales(instant);
  return { jour: jourDesComposantes(composantes), heure: heureDesComposantes(composantes) };
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
const REGEX_MOIS_ISO = /^\d{4}-(0[1-9]|1[0-2])$/;

function isoDuCalendrier(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Le jour, ou `null` s'il n'existe pas. La forme ne suffit pas : `Date.UTC`
 * reporte silencieusement un 31 février sur mars, d'où l'aller-retour qui
 * vérifie qu'on retombe sur la chaîne donnée.
 */
function calendrierEventuel(jourIso: string): Date | null {
  if (!REGEX_JOUR_ISO.test(jourIso)) return null;
  const [annee, mois, jour] = jourIso.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(annee, mois - 1, jour));
  return isoDuCalendrier(date) === jourIso ? date : null;
}

/**
 * Même chose, mais en refusant de continuer plutôt qu'en rendant `NaN` : une
 * date bancale qui traverse silencieusement donne un écran vide ou un jour
 * « undefined », ce qui coûte bien plus cher à comprendre qu'une erreur.
 */
function calendrier(jourIso: string): Date {
  const date = calendrierEventuel(jourIso);
  if (!date) throw new Error(`Jour invalide : "${jourIso}" — attendu AAAA-MM-JJ.`);
  return date;
}

export function jourIsoValide(jourIso: string): boolean {
  return calendrierEventuel(jourIso) !== null;
}

/** Un mois "AAAA-MM" qui existe — 2026-99 n'en est pas un. */
export function moisIsoValide(mois: string): boolean {
  return REGEX_MOIS_ISO.test(mois);
}

function composantesDuJour(jourIso: string): { annee: number; mois: number; jour: number } {
  const date = calendrier(jourIso);
  return { annee: date.getUTCFullYear(), mois: date.getUTCMonth() + 1, jour: date.getUTCDate() };
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

/**
 * "18 sept. à 14:32" — quand la minute compte : un journal de dossier, un
 * signalement daté. Le jour seul ne dirait pas assez.
 */
export function formaterJourEtHeure(instant: Date): string {
  return `${formaterJourSansSemaine(instant)} à ${formaterHeure(instant)}`;
}

/** "22 sept." — le jour, sans son jour de semaine. */
export function formaterJourSansSemaine(instant: Date): string {
  return formaterDate(instant, { day: "numeric", month: "short" });
}

/** "19:30". */
export function formaterHeure(instant: Date): string {
  return instant.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSEAU,
  });
}

/**
 * Styles partagés par les formulaires, cartes et boutons de l'app — un seul
 * endroit à changer pour ajuster la charte. `--color-line` (très clair)
 * suffit pour un simple séparateur, mais rend un champ de saisie ou un bouton
 * cliquable invisible sur fond blanc : ces éléments interactifs utilisent
 * `--color-line-strong`. Le focus visible, lui, est global (`globals.css`).
 */

/**
 * Champ de saisie sans largeur — pour les champs qui ne prennent pas la
 * ligne (une heure, par exemple). `CHAMP` l'habille de `w-full` ; ne pas
 * tenter l'inverse (`${CHAMP} w-auto`), Tailwind tranche les classes en
 * conflit par l'ordre de la feuille générée, pas par celui du texte.
 */
export const CHAMP_BASE =
  "rounded-xl border-[1.5px] border-[var(--color-line-strong)] bg-white px-3.5 py-2.5 text-[15px] text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-muted)] hover:border-[var(--color-ink-muted)] focus:border-[var(--color-ink)]";

export const CHAMP = `w-full ${CHAMP_BASE}`;

export const LABEL_CHAMP =
  "flex flex-col gap-1.5 text-sm font-semibold text-[var(--color-ink-soft)]";

/** Petit intitulé de section, en capitales — sert de sur-titre, pas de titre. */
export const EYEBROW =
  "font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]";

/** Titre de section dans les espaces connectés (restaurant, staff). */
export const TITRE_SECTION =
  "font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]";

export const CARTE =
  "rounded-2xl border border-[var(--color-line-strong)] bg-white p-5 shadow-[var(--shadow-carte)]";

/** Carte qui est un lien ou un bouton : elle réagit au survol. */
export const CARTE_CLIQUABLE = `${CARTE} transition-all hover:-translate-y-0.5 hover:border-[var(--color-ink-muted)] hover:shadow-[var(--shadow-carte-levee)]`;

export const BOUTON_PRIMAIRE =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-6 py-3 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] transition-colors hover:bg-[var(--color-ink-soft)] disabled:cursor-not-allowed disabled:opacity-60";

export const BOUTON_ACCENT =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 font-[family-name:var(--font-display)] text-[15px] font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60";

export const BOUTON_SECONDAIRE =
  "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60";

export const BOUTON_DANGER_DISCRET =
  "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-[var(--color-danger)] px-5 py-2.5 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-tint)] disabled:cursor-not-allowed disabled:opacity-60";

/** Pastille d'information : cuisine, ville, catégorie de plat… */
export const PASTILLE =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--color-line)] px-3 py-1 text-xs font-semibold text-[var(--color-ink-soft)]";

/** Pastille d'état — même forme que `PASTILLE`, couleur porteuse de sens. */
export const PASTILLE_ETAT = {
  neutre: "bg-[var(--color-line)] text-[var(--color-ink-soft)]",
  succes: "bg-[var(--color-success-tint)] text-[var(--color-success)]",
  attention: "bg-[var(--color-warning-tint)] text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger-tint)] text-[var(--color-danger)]",
  marque: "bg-[var(--color-accent-tint)] text-[var(--color-accent)]",
} as const;

export type EtatPastille = keyof typeof PASTILLE_ETAT;

export function pastilleEtat(etat: EtatPastille): string {
  return `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${PASTILLE_ETAT[etat]}`;
}

/** Bloc "il n'y a rien ici" — même traitement partout plutôt qu'un `<p>` gris. */
export const ETAT_VIDE =
  "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-cream)] px-6 py-10 text-center";

/**
 * Champ de type fichier. `input[type=file]` ne se met pas en forme comme les
 * autres champs : c'est `::file-selector-button` qui porte le bouton, et lui
 * seul. Sans ça, le sélecteur de photo était le seul contrôle de l'app à
 * garder l'apparence par défaut du navigateur.
 */
export const CHAMP_FICHIER =
  "w-full cursor-pointer rounded-xl border-[1.5px] border-dashed border-[var(--color-line-strong)] bg-white px-3.5 py-3 text-sm text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-ink-muted)] file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--color-ink)] file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--color-cream)]";

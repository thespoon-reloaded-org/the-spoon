/**
 * Styles partagés par les formulaires et cartes de l'espace restaurant — un
 * seul endroit à changer pour ajuster la charte. `--color-line` (très clair)
 * suffit pour un simple séparateur, mais rend un champ de saisie ou un bouton
 * cliquable invisible sur fond blanc : ces éléments interactifs utilisent
 * `--color-line-strong` et un focus visible.
 */

export const CHAMP =
  "w-full rounded-xl border-[1.5px] border-[var(--color-line-strong)] bg-white px-3.5 py-2.5 text-[15px] text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-ink-muted)] focus:border-[var(--color-ink)]";

export const LABEL_CHAMP =
  "flex flex-col gap-1.5 text-sm font-semibold text-[var(--color-ink-soft)]";

export const EYEBROW =
  "font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]";

export const CARTE = "rounded-2xl border-[1.5px] border-[var(--color-line-strong)] bg-white p-5";

export const BOUTON_PRIMAIRE =
  "rounded-full bg-[var(--color-ink)] px-6 py-3 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] transition-opacity hover:opacity-90 disabled:opacity-60";

export const BOUTON_SECONDAIRE =
  "rounded-full border-[1.5px] border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]";

export const BOUTON_DANGER_DISCRET =
  "rounded-full border-[1.5px] border-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-tint)]";

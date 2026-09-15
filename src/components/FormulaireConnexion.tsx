import type { Univers } from "@/lib/univers";

/**
 * Briques de formulaire des écrans de connexion. Elles prennent l'univers en
 * paramètre parce que la couleur d'action change d'une porte à l'autre
 * (framboise côté dîneur, vert côté restaurant, violet côté staff) — c'est
 * tout ce qui les distingue.
 */

export function ChampConnexion({
  libelle,
  univers,
  ...proprietesInput
}: {
  libelle: string;
  univers: Univers;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold" style={{ color: univers.encreDouce }}>
      {libelle}
      <input
        {...proprietesInput}
        className="w-full rounded-xl border-[1.5px] border-black/10 bg-white px-3.5 py-3 text-[15px] text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-muted)] hover:border-black/25 focus:border-black/40"
      />
    </label>
  );
}

export function BoutonConnexion({
  univers,
  enCours,
  children,
}: {
  univers: Univers;
  enCours: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={enCours}
      className="mt-2 w-full rounded-full px-6 py-3.5 font-[family-name:var(--font-display)] text-[15px] font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: univers.accent, color: univers.surAccent }}
    >
      {enCours ? "…" : children}
    </button>
  );
}

/** `role="alert"` : l'échec de connexion doit être annoncé, pas seulement affiché en rouge. */
export function ErreurConnexion({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]"
    >
      {message}
    </p>
  );
}

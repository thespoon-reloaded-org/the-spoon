/**
 * En-tête de page des espaces connectés.
 *
 * Avec un menu latéral, chaque page doit se nommer elle-même : le titre n'est
 * plus porté par l'onglet actif d'une barre d'onglets. Même gabarit partout —
 * titre, phrase d'explication, actions à droite — pour que l'œil sache où
 * regarder d'un écran à l'autre.
 */
export function EnteteEspace({
  titre,
  description,
  actions,
}: {
  titre: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
          {titre}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

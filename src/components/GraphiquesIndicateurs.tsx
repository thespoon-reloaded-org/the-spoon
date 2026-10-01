import Link from "next/link";

/**
 * Les deux graphiques du tableau de bord staff, en HTML et CSS plutôt qu'une
 * bibliothèque : une barre est un `div` dont la largeur porte la valeur, et
 * c'est tout ce dont ces écrans ont besoin.
 *
 * Une seule série par graphique, donc une seule couleur — l'accent violet de
 * l'univers staff. La couleur ne distingue rien ici, c'est la longueur qui
 * compte ; et chaque valeur reste lisible en clair, sans dépendre du survol.
 */

const COULEUR_BARRE = "var(--color-staff-accent)";

export type BarreClassement = {
  cle: string;
  libelle: string;
  valeur: number;
  /** Ce qui s'écrit au bout de la ligne : la valeur, et sa part. */
  detail: string;
  href?: string;
};

/**
 * Un classement en barres horizontales. Les longueurs se rapportent à la
 * première barre, pas au total : on compare les lignes entre elles, la part
 * de chacune est écrite à côté.
 */
export function ClassementBarres({
  barres,
  libelle,
}: {
  barres: readonly BarreClassement[];
  libelle: string;
}) {
  const max = Math.max(0, ...barres.map((barre) => barre.valeur));

  return (
    <ol className="flex flex-col gap-3.5" aria-label={libelle}>
      {barres.map((barre) => {
        const classeLibelle = "min-w-0 truncate font-semibold text-[var(--color-ink)]";
        return (
          <li key={barre.cle}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {barre.href ? (
                <Link href={barre.href} className={`${classeLibelle} hover:underline`}>
                  {barre.libelle}
                </Link>
              ) : (
                <span className={classeLibelle}>{barre.libelle}</span>
              )}
              <span className="shrink-0 tabular-nums text-[var(--color-ink-muted)]">
                {barre.detail}
              </span>
            </div>
            {/* Carrée à la base, arrondie au bout : la barre part de la gauche. */}
            <div
              aria-hidden="true"
              className="mt-1.5 h-2 rounded-r-[4px]"
              style={{
                background: COULEUR_BARRE,
                width:
                  barre.valeur > 0 && max > 0 ? `${Math.max((barre.valeur / max) * 100, 1.5)}%` : 0,
              }}
            />
          </li>
        );
      })}
    </ol>
  );
}

export type Colonne = {
  cle: string;
  /** Sous la colonne : court. */
  libelle: string;
  /** Lu par un lecteur d'écran et dans l'infobulle. */
  libelleLong: string;
  valeur: number;
  detail: string;
};

/**
 * Un histogramme en colonnes. Seul le pic est étiqueté au-dessus de sa
 * colonne — un chiffre sur chacune ne se lirait plus ; les autres valeurs
 * s'affichent au survol ou au focus clavier, et chaque colonne les annonce
 * aux lecteurs d'écran.
 */
export function HistogrammeColonnes({ colonnes }: { colonnes: readonly Colonne[] }) {
  const max = Math.max(0, ...colonnes.map((colonne) => colonne.valeur));
  const indexPic = max > 0 ? colonnes.findIndex((colonne) => colonne.valeur === max) : -1;

  return (
    <div>
      <div className="flex h-44 items-end gap-2 border-b border-[var(--color-line-strong)] pt-7">
        {colonnes.map((colonne, index) => (
          <div
            key={colonne.cle}
            role="img"
            tabIndex={0}
            aria-label={`${colonne.libelleLong} : ${colonne.detail}`}
            className="group relative flex h-full flex-1 items-end justify-center rounded-t-md outline-offset-2"
          >
            <div
              className="relative w-full max-w-6 rounded-t-[4px]"
              style={{
                background: COULEUR_BARRE,
                height: `${max > 0 ? (colonne.valeur / max) * 100 : 0}%`,
              }}
            >
              {index === indexPic && (
                <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs font-semibold tabular-nums text-[var(--color-ink)]">
                  {colonne.valeur.toLocaleString("fr-FR")}
                </span>
              )}
            </div>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--color-staff)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-cream)] shadow-lg group-hover:block group-focus-visible:block"
            >
              {colonne.libelleLong} · {colonne.detail}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2" aria-hidden="true">
        {colonnes.map((colonne) => (
          <span
            key={colonne.cle}
            className="flex-1 text-center font-mono text-[11px] font-semibold uppercase text-[var(--color-ink-muted)]"
          >
            {colonne.libelle}
          </span>
        ))}
      </div>
    </div>
  );
}

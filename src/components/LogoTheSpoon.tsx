import Link from "next/link";

type Ton = "clair" | "sombre";

/**
 * La marque TheSpoon. Le même signe (une cuillère stylisée) sert dans les
 * trois univers, seule la couleur change : `ton="clair"` sur fond clair,
 * `ton="sombre"` sur les fonds foncés de l'espace restaurant et de la console
 * staff. `couleurPastille` permet à chaque univers d'imposer son accent.
 */
export function LogoTheSpoon({
  href = "/",
  ton = "clair",
  couleurPastille = "var(--color-accent)",
  texte = true,
  className = "",
}: {
  href?: string | null;
  ton?: Ton;
  couleurPastille?: string;
  texte?: boolean;
  className?: string;
}) {
  const contenu = (
    <>
      <span
        aria-hidden
        className="h-[30px] w-[30px] shrink-0 rounded-[50%_50%_50%_4px]"
        style={{ background: couleurPastille }}
      />
      <span
        className={
          texte
            ? `font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight ${
                ton === "sombre" ? "text-[var(--color-cream)]" : "text-[var(--color-ink)]"
              }`
            : "sr-only"
        }
      >
        TheSpoon
      </span>
    </>
  );

  const classes = `flex items-center gap-2 ${className}`;

  if (href === null) {
    return <span className={classes}>{contenu}</span>;
  }

  return (
    <Link href={href} className={classes}>
      {contenu}
    </Link>
  );
}

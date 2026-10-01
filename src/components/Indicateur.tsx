import Link from "next/link";

import { CARTE, CARTE_CLIQUABLE, EYEBROW } from "@/lib/ui";

/**
 * Une tuile de tableau de bord : un libellé, un chiffre, une ligne qui le
 * situe. Partagée par le tableau de bord restaurant et celui de la console
 * staff — même lecture d'un écran à l'autre.
 */
export function Indicateur({
  libelle,
  valeur,
  precision,
  href,
}: {
  libelle: string;
  valeur: React.ReactNode;
  precision?: React.ReactNode;
  href?: string;
}) {
  const contenu = (
    <>
      <p className={EYEBROW}>{libelle}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-none tracking-tight text-[var(--color-ink)]">
        {valeur}
      </p>
      {precision && <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{precision}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARTE_CLIQUABLE}>
        {contenu}
      </Link>
    );
  }
  return <div className={CARTE}>{contenu}</div>;
}

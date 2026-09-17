import Link from "next/link";

import { IconeRecherche } from "@/components/Icones";

/**
 * Corps de la page 404, partagé par les deux fichiers `not-found` :
 * `app/not-found.tsx` (URLs qui ne correspondent à aucune route) et
 * `app/(site)/not-found.tsx` (appels à `notFound()` depuis une fiche
 * établissement). Le premier doit poser lui-même l'en-tête et le pied de page,
 * puisqu'il est rendu dans le layout racine, qui n'en a plus.
 */
export function PageIntrouvable() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-5 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
        <IconeRecherche taille={28} />
      </span>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-4xl">
        Cette page n&apos;est pas au menu
      </h1>
      <p className="max-w-sm text-[var(--color-ink-muted)]">
        L&apos;adresse que tu cherches n&apos;existe pas, ou le restaurant n&apos;est plus
        référencé sur TheSpoon.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-[var(--color-accent)] px-6 py-3 font-[family-name:var(--font-display)] text-[15px] font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        Retour à la recherche
      </Link>
    </main>
  );
}

import Link from "next/link";

import { AuthHeaderActions } from "@/components/AuthHeaderActions";
import { IconeBoutique } from "@/components/Icones";
import { LogoTheSpoon } from "@/components/LogoTheSpoon";

/**
 * Header du site public. Collant et translucide : sur une page de recherche
 * qui défile beaucoup, garder la marque et l'état de connexion à portée évite
 * de remonter en haut pour savoir si on est identifié.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-page)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3.5 md:px-10">
        <LogoTheSpoon />

        <div className="flex items-center gap-2">
          <AuthHeaderActions />
          {/* Pointe vers la connexion restaurant — pas d'inscription en ligne pour
              l'instant, un contact existant se connecte, un nouveau partenaire
              reste onboardé côté TheSpoon (cf. "Auth restaurant partenaire"). */}
          <Link
            href="/connexion-restaurant"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-pro)] px-4 py-2.5 text-sm font-semibold text-[var(--color-cream)] transition-colors hover:bg-[var(--color-pro-deep)] sm:px-5"
          >
            <IconeBoutique taille={17} />
            <span className="hidden sm:inline">Espace restaurateur</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

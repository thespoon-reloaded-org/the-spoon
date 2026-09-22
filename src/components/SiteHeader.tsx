import { headers } from "next/headers";
import Link from "next/link";

import { AuthHeaderActions } from "@/components/AuthHeaderActions";
import { IconeBoutique } from "@/components/Icones";
import { LogoTheSpoon } from "@/components/LogoTheSpoon";
import { Onboarding } from "@/components/Onboarding";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LIEN_ONBOARDING =
  "hidden rounded-full px-3 py-2 text-sm font-semibold text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-line)] hover:text-[var(--color-ink)] sm:inline-flex";

/**
 * Header du site public. Collant et translucide : sur une page de recherche
 * qui défile beaucoup, garder la marque et l'état de connexion à portée évite
 * de remonter en haut pour savoir si on est identifié.
 *
 * Lit la session côté serveur pour savoir si l'onboarding doit s'ouvrir seul.
 * C'est ce qui rend `/devenir-partenaire` dynamique — la seule page de ce
 * groupe qui était encore statique. La recherche et les fiches l'étaient déjà.
 */
export async function SiteHeader() {
  // Un visiteur non connecté n'a pas de trace : on ne lui ouvre rien de force,
  // le bouton reste à sa disposition.
  const session = await auth.api.getSession({ headers: await headers() });
  const diner = session
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { onboardingVuLe: true },
      })
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-page)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3.5 md:px-10">
        <LogoTheSpoon />

        <div className="flex items-center gap-2">
          <Onboarding
            univers="client"
            dejaVu={!session || diner?.onboardingVuLe !== null}
            classeBouton={LIEN_ONBOARDING}
          />
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

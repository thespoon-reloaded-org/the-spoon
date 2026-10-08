import type { Metadata } from "next";

import { BarreLaterale, type EntreeMenu, type ThemeBarre } from "@/components/BarreLaterale";
import { DeconnexionFormateurBouton } from "@/components/DeconnexionFormateurBouton";
import { BoutonOnboarding, Onboarding } from "@/components/Onboarding";
import { exigerSessionFormateur } from "@/lib/garde-formateur";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Console formateur", template: "%s · Console formateur" },
};

const MENU: readonly EntreeMenu[] = [
  { href: "/formateur/evenements", label: "Événements", icone: "eclair" },
  { href: "/formateur/fonctionnalites", label: "Fonctionnalités", icone: "interrupteur" },
];

/** Sur fond sombre, le bouton se pose en creux plutôt qu'en pleine couleur. */
const BOUTON_ONBOARDING =
  "rounded-full border border-white/25 px-3 py-2 text-xs font-semibold text-[var(--color-cream)] transition-colors hover:bg-white/10";

/** L'univers « formateur » : brun encre, accent orange (cf. `src/lib/univers.ts`). */
const THEME: ThemeBarre = {
  fond: "var(--color-formateur)",
  fondActif: "var(--color-formateur-line)",
  ligne: "var(--color-formateur-line)",
  texte: "#c4ab98",
  accent: "var(--color-formateur-accent)",
};

/**
 * Cadre de la console formateur. Même garde que la Console staff : posée ici
 * pour les requêtes directes, et reprise par chaque page et chaque action
 * (voir `src/lib/garde-formateur.ts`).
 */
export default async function FormateurLayout({ children }: { children: React.ReactNode }) {
  const session = await exigerSessionFormateur();
  const formateur = await prisma.formateur.findUnique({
    where: { id: session.user.id },
    select: { onboardingVuLe: true },
  });

  return (
    <div className="univers-formateur min-h-screen bg-[var(--color-formateur-tint)] lg:flex">
      <Onboarding univers="formateur" dejaVu={formateur?.onboardingVuLe !== null} />
      <BarreLaterale
        marque="Console formateur"
        titre="TheSpoon"
        sousTitre="Formations Hymaia"
        entrees={MENU}
        theme={THEME}
        pied={
          <div className="flex flex-col gap-3 px-1">
            <BoutonOnboarding univers="formateur" className={BOUTON_ONBOARDING} />
            <span className="text-xs" style={{ color: THEME.texte }}>
              Connecté en tant que
              <br />
              <strong className="font-semibold text-[var(--color-cream)]">
                {session.user.name}
              </strong>
            </span>
            <DeconnexionFormateurBouton />
          </div>
        }
      />

      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

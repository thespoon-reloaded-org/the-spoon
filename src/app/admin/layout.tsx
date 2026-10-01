import type { Metadata } from "next";

import { BarreLaterale, type EntreeMenu, type ThemeBarre } from "@/components/BarreLaterale";
import { DeconnexionAdminBouton } from "@/components/DeconnexionAdminBouton";
import { BoutonOnboarding, Onboarding } from "@/components/Onboarding";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Console staff", template: "%s · Console staff" },
};

const MENU: readonly EntreeMenu[] = [
  { href: "/admin/restaurants", label: "Restaurants", icone: "restaurants" },
  { href: "/admin/factures", label: "Facturation", icone: "facture" },
  { href: "/admin/litiges", label: "Litiges", icone: "litige" },
  { href: "/admin/contestation", label: "Réglages contestation", icone: "reglages" },
  { href: "/admin/contacts-restaurateurs", label: "Demandes restaurateurs", icone: "message" },
  { href: "/admin/assistant", label: "Assistant de recherche", icone: "etincelle" },
];

/** Sur fond sombre, le bouton se pose en creux plutôt qu'en pleine couleur. */
const BOUTON_ONBOARDING =
  "rounded-full border border-white/25 px-3 py-2 text-xs font-semibold text-[var(--color-cream)] transition-colors hover:bg-white/10";

/** L'univers « staff » : encre bleutée, accent violet (cf. `src/lib/univers.ts`). */
const THEME: ThemeBarre = {
  fond: "var(--color-staff)",
  fondActif: "var(--color-staff-line)",
  ligne: "var(--color-staff-line)",
  texte: "#9b9fc4",
  accent: "var(--color-staff-accent)",
};

/**
 * Cadre de la console staff.
 *
 * La garde posée ici couvre les requêtes directes, mais elle ne suffit pas :
 * chaque page appelle `exigerSessionStaff` de son côté, parce qu'un layout
 * n'est pas ré-exécuté lors d'une navigation côté client et n'empêche pas ses
 * segments de s'exécuter (voir `src/lib/garde-staff.ts`). Pas de permissions
 * par rôle : tout le staff connecté a le même accès (ticket Notion « Auth
 * staff TheSpoon & permissions »).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await exigerSessionStaff();
  const staff = await prisma.staff.findUnique({
    where: { id: session.user.id },
    select: { onboardingVuLe: true },
  });

  return (
    <div className="univers-staff min-h-screen bg-[var(--color-staff-tint)] lg:flex">
      {/* Une seule fenêtre par page : la barre latérale, elle, rend son pied
          deux fois (colonne fixe et tiroir mobile). */}
      <Onboarding univers="staff" dejaVu={staff?.onboardingVuLe !== null} />
      <BarreLaterale
        marque="Console staff"
        titre="TheSpoon"
        sousTitre="Back-office interne"
        entrees={MENU}
        theme={THEME}
        pied={
          <div className="flex flex-col gap-3 px-1">
            <BoutonOnboarding univers="staff" className={BOUTON_ONBOARDING} />
            <span className="text-xs" style={{ color: THEME.texte }}>
              Connecté en tant que
              <br />
              <strong className="font-semibold text-[var(--color-cream)]">
                {session.user.name}
              </strong>
            </span>
            <DeconnexionAdminBouton />
          </div>
        }
      />

      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

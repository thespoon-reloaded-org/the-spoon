import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BarreLaterale, type EntreeMenu, type ThemeBarre } from "@/components/BarreLaterale";
import { DeconnexionAdminBouton } from "@/components/DeconnexionAdminBouton";
import { authAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Console staff", template: "%s · Console staff" },
};

const MENU: readonly EntreeMenu[] = [
  { href: "/admin/restaurants", label: "Restaurants", icone: "restaurants" },
  { href: "/admin/factures", label: "Facturation", icone: "facture" },
  { href: "/admin/contestation", label: "Contestations", icone: "litige" },
];

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
 * Le contrôle d'accès vivait dans chaque page (`/admin`, `/admin/factures`,
 * chaque fiche) — une page ajoutée sans la garde serait passée en clair. Il
 * est fait une fois ici ; les pages continuent de lire la session, mais pour
 * afficher le nom, plus pour protéger la route. Pas de permissions par rôle :
 * tout le staff connecté a le même accès (ticket Notion « Auth staff TheSpoon
 * & permissions »).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  return (
    <div className="univers-staff min-h-screen bg-[var(--color-staff-tint)] lg:flex">
      <BarreLaterale
        marque="Console staff"
        titre="TheSpoon"
        sousTitre="Back-office interne"
        entrees={MENU}
        theme={THEME}
        pied={
          <div className="flex flex-col gap-3 px-1">
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

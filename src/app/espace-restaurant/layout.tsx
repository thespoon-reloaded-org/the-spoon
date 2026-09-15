import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BarreLaterale, type EntreeMenu, type ThemeBarre } from "@/components/BarreLaterale";
import { DeconnexionRestaurantBouton } from "@/components/DeconnexionRestaurantBouton";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Espace restaurateur", template: "%s · Espace restaurateur" },
};

const MENU: readonly EntreeMenu[] = [
  { href: "/espace-restaurant/tableau-de-bord", label: "Tableau de bord", icone: "tableauBord" },
  { href: "/espace-restaurant/reservations", label: "Réservations", icone: "calendrier" },
  { href: "/espace-restaurant/disponibilites", label: "Disponibilités", icone: "horloge" },
  { href: "/espace-restaurant/menu", label: "Ma carte", icone: "carte" },
  { href: "/espace-restaurant/fiche", label: "Ma fiche", icone: "boutique" },
  { href: "/espace-restaurant/factures", label: "Factures", icone: "facture" },
];

/** L'univers « partenaire » : vert profond, accent jaune (cf. `src/lib/univers.ts`). */
const THEME: ThemeBarre = {
  fond: "var(--color-pro)",
  fondActif: "var(--color-pro-soft)",
  ligne: "var(--color-pro-line)",
  texte: "#9dbcb1",
  accent: "var(--color-pro-accent)",
};

/**
 * Layout de l'espace restaurant : un seul contrôle d'accès ici, pas un par
 * page. Remplace la vue de secours `/restaurants/[id]/reservations` — c'est
 * le vrai tableau de bord partenaire, voir README.
 */
export default async function EspaceRestaurantLayout({ children }: { children: React.ReactNode }) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    select: { nom: true, ville: true },
  });

  return (
    <div className="univers-pro min-h-screen bg-[var(--color-pro-tint)] lg:flex">
      <BarreLaterale
        marque="Espace restaurateur"
        titre={restaurant?.nom ?? session.user.name}
        sousTitre={restaurant?.ville}
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
            <DeconnexionRestaurantBouton />
          </div>
        }
      />

      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DeconnexionRestaurantBouton } from "@/components/DeconnexionRestaurantBouton";
import { EspaceRestaurantNav } from "@/components/EspaceRestaurantNav";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EYEBROW } from "@/lib/ui";

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
    select: { nom: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className={EYEBROW}>Espace restaurant</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            {restaurant?.nom ?? session.user.name}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
          <span className="text-[var(--color-ink-muted)]">Bonjour {session.user.name}</span>
          <DeconnexionRestaurantBouton />
        </div>
      </div>

      <div className="mt-6 border-b-[1.5px] border-[var(--color-line-strong)] pb-4">
        <EspaceRestaurantNav />
      </div>

      <div className="mt-8">{children}</div>
    </main>
  );
}

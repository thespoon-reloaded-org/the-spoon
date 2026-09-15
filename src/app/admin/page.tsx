import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { DeconnexionAdminBouton } from "@/components/DeconnexionAdminBouton";
import { authAdmin } from "@/lib/auth";
import { BOUTON_PRIMAIRE, BOUTON_SECONDAIRE, CARTE, CHAMP } from "@/lib/ui";
import { prisma } from "@/lib/prisma";

/**
 * Premier écran du BO admin ("Console staff : vue restaurants") — donne
 * enfin une raison d'être à l'auth staff. Lecture ouverte à tout le staff
 * connecté, pas de permissions par rôle pour l'instant.
 */
export default async function ConsoleAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const { q } = await searchParams;

  const restaurants = await prisma.restaurant.findMany({
    where: q
      ? {
          OR: [
            { nom: { contains: q, mode: "insensitive" } },
            { ville: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { nom: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
            Console staff
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            {restaurants.length} restaurant{restaurants.length > 1 ? "s" : ""} partenaire
            {restaurants.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
          <span>Bonjour {session.user.name}</span>
          <Link href="/admin/factures" className={BOUTON_SECONDAIRE}>
            Facturation
          </Link>
          <Link href="/admin/contestation" className={BOUTON_SECONDAIRE}>
            Contestations
          </Link>
          <DeconnexionAdminBouton />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Nom ou ville…"
            className={`w-64 ${CHAMP}`}
          />
          <button type="submit" className={BOUTON_SECONDAIRE}>
            Chercher
          </button>
        </form>

        <Link href="/admin/restaurants/nouveau" className={BOUTON_PRIMAIRE}>
          + Nouveau restaurant
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {restaurants.map((restaurant) => (
          <Link
            key={restaurant.id}
            href={`/admin/restaurants/${restaurant.id}`}
            className={`${CARTE} flex items-center justify-between p-5 transition-colors hover:border-[var(--color-ink)]`}
          >
            <div>
              <p className="font-semibold text-[var(--color-ink)]">{restaurant.nom}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">
                {restaurant.cuisine} · {restaurant.ville}
              </p>
            </div>
          </Link>
        ))}

        {restaurants.length === 0 && (
          <p className="text-sm text-[var(--color-ink-muted)]">Aucun restaurant pour cette recherche.</p>
        )}
      </div>
    </main>
  );
}

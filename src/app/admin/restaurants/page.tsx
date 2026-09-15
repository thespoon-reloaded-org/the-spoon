import type { Metadata } from "next";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { IconeChevron, IconeRecherche } from "@/components/Icones";
import { NoteCuilleres } from "@/components/NoteCuilleres";
import { PhotoCouverture } from "@/components/PhotoCouverture";
import { photoRestaurant } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { BOUTON_PRIMAIRE, CHAMP, ETAT_VIDE, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Restaurants" };

/**
 * Vue restaurants de la console staff. Lecture ouverte à tout le staff
 * connecté, pas de permissions par rôle pour l'instant. La garde d'accès est
 * faite une fois dans le layout parent.
 */
export default async function RestaurantsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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
    include: { _count: { select: { contacts: true, bookings: true } } },
    orderBy: { nom: "asc" },
  });

  return (
    <>
      <EnteteEspace
        titre="Restaurants partenaires"
        description={`${restaurants.length} établissement${restaurants.length > 1 ? "s" : ""}${
          q ? ` pour « ${q} »` : " référencé" + (restaurants.length > 1 ? "s" : "")
        }.`}
        actions={
          <Link href="/admin/restaurants/nouveau" className={BOUTON_PRIMAIRE}>
            + Nouveau restaurant
          </Link>
        }
      />

      <form className="mb-6 flex flex-wrap gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]">
            <IconeRecherche taille={18} />
          </span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nom ou ville…"
            aria-label="Chercher un restaurant par nom ou ville"
            className={`${CHAMP} pl-11`}
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-[var(--color-staff)] px-5 py-2.5 text-sm font-semibold text-[var(--color-cream)] transition-colors hover:bg-[var(--color-staff-deep)]"
        >
          Chercher
        </button>
        {q && (
          <Link
            href="/admin/restaurants"
            className="inline-flex items-center px-3 text-sm font-semibold text-[var(--color-staff)] hover:underline"
          >
            Effacer
          </Link>
        )}
      </form>

      {restaurants.length === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Aucun restaurant pour cette recherche
          </p>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Essayez un autre nom ou une autre ville.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <Link
                href={`/admin/restaurants/${restaurant.id}`}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-line-strong)] bg-white p-3 transition-colors hover:border-[var(--color-staff)]"
              >
                <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl">
                  <PhotoCouverture
                    photo={photoRestaurant(restaurant)}
                    alt={restaurant.nom}
                    sizes="80px"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                    {restaurant.nom}
                  </p>
                  <p className="text-sm text-[var(--color-ink-muted)]">
                    {restaurant.cuisine} · {restaurant.ville}
                  </p>
                  <span className="mt-1.5 inline-block">
                    <NoteCuilleres
                      note={restaurant.noteCuilleres}
                      nombreAvis={restaurant.nombreAvis}
                      taille="petit"
                    />
                  </span>
                </div>

                <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                  <span className={pastilleEtat(restaurant._count.contacts > 0 ? "succes" : "attention")}>
                    {restaurant._count.contacts} contact
                    {restaurant._count.contacts > 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-[var(--color-ink-muted)]">
                    {restaurant._count.bookings} réservation
                    {restaurant._count.bookings > 1 ? "s" : ""}
                  </span>
                </div>

                <span className="shrink-0 text-[var(--color-ink-muted)]">
                  <IconeChevron taille={18} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { creerPlat } from "./actions";
import { DeconnexionRestaurantBouton } from "@/components/DeconnexionRestaurantBouton";
import { PlatForm } from "@/components/PlatForm";
import { SupprimerPlatBouton } from "@/components/SupprimerPlatBouton";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LIBELLE_CATEGORIE: Record<"ENTREE" | "PLAT" | "DESSERT", string> = {
  ENTREE: "Entrée",
  PLAT: "Plat",
  DESSERT: "Dessert",
};

/**
 * Écran "Mon menu" côté partenaire — voir le ticket Notion "Mon menu (plats,
 * photos, prix)". Même garde d'accès que /reservations : réservé au contact
 * connecté de CE restaurant.
 */
export default async function MenuRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");

  const { id } = await params;
  if (session.user.restaurantId !== id) redirect(`/restaurants/${session.user.restaurantId}/menu`);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { platsCuillere: { orderBy: { createdAt: "asc" } } },
  });
  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <Link
          href={`/restaurants/${id}/reservations`}
          className="text-sm text-[var(--color-ink-muted)] hover:underline"
        >
          ← Réservations
        </Link>
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
          <span>Bonjour {session.user.name}</span>
          <DeconnexionRestaurantBouton />
        </div>
      </div>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Mon menu · {restaurant.nom}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
        Visible immédiatement sur ta fiche publique.
      </p>

      {restaurant.platsCuillere.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
          Pas encore de plat sur la carte.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {restaurant.platsCuillere.map((plat) => (
            <li
              key={plat.id}
              className="flex items-center gap-4 rounded-2xl border border-[var(--color-line)] bg-white p-4"
            >
              {plat.photoMisAJourLe ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/plats/${plat.id}/photo?v=${plat.photoMisAJourLe.getTime()}`}
                  alt={plat.nom}
                  className="h-16 w-16 shrink-0 rounded-[14px] object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-accent-soft)] text-2xl">
                  🥣
                </span>
              )}

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--color-ink)]">{plat.nom}</span>
                  <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
                    {LIBELLE_CATEGORIE[plat.categorie]}
                  </span>
                </div>
                {plat.description && (
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{plat.description}</p>
                )}
                <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">
                  {(plat.prixCentimes / 100).toFixed(2)} €
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <Link
                  href={`/restaurants/${id}/menu/${plat.id}`}
                  className="rounded-full border-[1.5px] border-[var(--color-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]"
                >
                  Modifier
                </Link>
                <SupprimerPlatBouton restaurantId={id} platId={plat.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
        Ajouter un plat
      </h2>
      <div className="mt-4">
        <PlatForm action={creerPlat.bind(null, id)} libelleSoumission="Ajouter à la carte" />
      </div>
    </main>
  );
}

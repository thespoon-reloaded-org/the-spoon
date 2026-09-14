import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { DeconnexionRestaurantBouton } from "@/components/DeconnexionRestaurantBouton";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Vue provisoire : la vraie « espace restaurant » (tableau de bord complet)
 * est un Epic séparé, pas encore démarré — mais l'accès, lui, est réel :
 * réservé au contact connecté de CE restaurant (voir "Auth restaurant
 * partenaire"). Un contact d'un autre établissement qui changerait l'id
 * dans l'URL est renvoyé vers son propre restaurant, jamais vers celui-ci.
 */
export default async function ReservationsRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");

  const { id } = await params;
  if (session.user.restaurantId !== id)
    redirect(`/restaurants/${session.user.restaurantId}/reservations`);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { bookings: { include: { user: true }, orderBy: { date: "asc" } } },
  });

  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <Link
          href={`/restaurants/${id}`}
          className="text-sm text-[var(--color-ink-muted)] hover:underline"
        >
          ← Retour à la fiche
        </Link>
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--color-ink)]">
          <span>Bonjour {session.user.name}</span>
          <DeconnexionRestaurantBouton />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
          Réservations · {restaurant.nom}
        </h1>
        <Link
          href={`/restaurants/${id}/menu`}
          className="rounded-full border-[1.5px] border-[var(--color-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)]"
        >
          Mon menu
        </Link>
      </div>

      {restaurant.bookings.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
          Aucune réservation pour l&apos;instant.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {restaurant.bookings.map((reservation) => (
            <li
              key={reservation.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-white px-5 py-4"
            >
              <div>
                <p className="font-semibold text-[var(--color-ink)]">
                  {reservation.user.name.split(" ")[0]}
                </p>
                <p className="text-sm text-[var(--color-ink-muted)]">
                  {reservation.date.toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  à{" "}
                  {reservation.date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span className="text-sm font-semibold text-[var(--color-ink)]">
                {reservation.couverts} couvert{reservation.couverts > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

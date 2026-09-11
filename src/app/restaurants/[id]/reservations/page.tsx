import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Vue provisoire : la vraie « espace restaurant » (auth partenaire, tableau
 * de bord) est un Epic séparé, pas encore démarré. Sert uniquement à
 * vérifier qu'une réservation créée par un dîneur apparaît bien côté
 * restaurant, comme demandé par le ticket — pas un vrai back-office.
 * En attendant cette auth partenaire, on exige au moins une session dîneur
 * (n'importe laquelle) plutôt que de laisser la page en accès libre, et on
 * n'affiche que le prénom pour limiter l'exposition de données.
 */
export default async function ReservationsRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: { bookings: { include: { user: true }, orderBy: { date: "asc" } } },
  });

  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/restaurants/${id}`} className="text-sm text-[var(--color-ink-muted)] hover:underline">
        ← Retour à la fiche
      </Link>

      <p className="mt-4 rounded-2xl bg-[var(--color-accent-tint)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
        Vue provisoire, sans auth restaurant partenaire (pas encore développée) — sert seulement à vérifier
        que les réservations arrivent côté restaurant.
      </p>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Réservations · {restaurant.nom}
      </h1>

      {restaurant.bookings.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">Aucune réservation pour l&apos;instant.</p>
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
                  {reservation.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
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

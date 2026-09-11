import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AnnulerReservationBouton } from "@/components/AnnulerReservationBouton";
import type { Booking, Restaurant } from "@/generated/prisma";

type ReservationAvecRestaurant = Booking & { restaurant: Restaurant };

/** Fonction utilitaire (pas un composant) : Date.now() y est autorisé. */
function separerReservations(reservations: ReservationAvecRestaurant[]) {
  const maintenant = Date.now();
  return {
    aVenir: reservations.filter((r) => r.date.getTime() > maintenant),
    passees: reservations.filter((r) => r.date.getTime() <= maintenant).reverse(),
  };
}

function ligneReservation(reservation: ReservationAvecRestaurant, avecAction: boolean) {
  return (
    <li
      key={reservation.id}
      className="flex items-center justify-between rounded-2xl border border-[var(--color-line)] bg-white px-5 py-4"
    >
      <div>
        <p className="font-semibold text-[var(--color-ink)]">{reservation.restaurant.nom}</p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {reservation.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à{" "}
          {reservation.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
          {reservation.couverts} couvert{reservation.couverts > 1 ? "s" : ""}
        </p>
      </div>
      {reservation.statut === "ANNULEE" ? (
        <span className="text-sm font-semibold text-[var(--color-ink-muted)]">Annulée</span>
      ) : avecAction ? (
        <AnnulerReservationBouton bookingId={reservation.id} />
      ) : null}
    </li>
  );
}

export default async function MesReservationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const reservations = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: { restaurant: true },
    orderBy: { date: "asc" },
  });

  const { aVenir, passees } = separerReservations(reservations);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:underline">
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Mes réservations
      </h1>

      <section className="mt-8">
        <h2 className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">À venir</h2>
        {aVenir.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucune réservation à venir.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {aVenir.map((reservation) => ligneReservation(reservation, true))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">Passées</h2>
        {passees.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucune réservation passée.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3 opacity-70">
            {passees.map((reservation) => ligneReservation(reservation, false))}
          </ul>
        )}
      </section>
    </main>
  );
}

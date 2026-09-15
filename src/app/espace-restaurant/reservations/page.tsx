import { headers } from "next/headers";

import { SignalerReservationBoutons } from "@/components/SignalerReservationBoutons";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW } from "@/lib/ui";
import type { Booking, User } from "@/generated/prisma";

type ReservationAvecClient = Booking & { user: User };

const STATUT: Record<ReservationAvecClient["statut"], { label: string; classe: string }> = {
  CONFIRMEE: { label: "Confirmée", classe: "text-[var(--color-ink-muted)]" },
  ANNULEE: { label: "Annulée", classe: "text-[var(--color-ink-muted)] line-through" },
  HONOREE: { label: "Honorée", classe: "text-green-700" },
  NO_SHOW: { label: "No-show", classe: "text-[var(--color-accent)]" },
};

/** Fonction utilitaire (pas un composant) : Date.now() y est autorisé. */
function separerReservations(reservations: ReservationAvecClient[]) {
  const maintenant = Date.now();
  return {
    aVenir: reservations.filter((r) => r.date.getTime() > maintenant),
    passees: reservations.filter((r) => r.date.getTime() <= maintenant).reverse(),
  };
}

function ligneReservation(reservation: ReservationAvecClient, estPassee: boolean) {
  const aSignaler = estPassee && reservation.statut === "CONFIRMEE";
  const statut = STATUT[reservation.statut];
  return (
    <li key={reservation.id} className={`${CARTE} flex items-center justify-between`}>
      <div>
        <p className="font-semibold text-[var(--color-ink)]">{reservation.user.name}</p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {reservation.date.toLocaleDateString("fr-FR", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}{" "}
          à {reservation.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
          {reservation.couverts} couvert{reservation.couverts > 1 ? "s" : ""}
        </p>
      </div>
      {aSignaler ? (
        <SignalerReservationBoutons bookingId={reservation.id} couvertsPrevus={reservation.couverts} />
      ) : (
        <span className={`text-sm font-semibold ${statut.classe}`}>{statut.label}</span>
      )}
    </li>
  );
}

/**
 * Premier écran du vrai espace partenaire — remplace la vue de secours
 * `/restaurants/[id]/reservations`. Le contrôle d'accès (session +
 * restaurant du contact) est fait une fois dans le layout parent.
 */
export default async function ReservationsRecuesPage() {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null; // garde déjà faite par le layout, satisfait TypeScript

  const reservations = await prisma.booking.findMany({
    where: { restaurantId: session.user.restaurantId },
    include: { user: true },
    orderBy: { date: "asc" },
  });

  const { aVenir, passees } = separerReservations(reservations);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className={EYEBROW}>À venir</h2>
        {aVenir.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucune réservation à venir.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {aVenir.map((reservation) => ligneReservation(reservation, false))}
          </ul>
        )}
      </section>

      <section>
        <h2 className={EYEBROW}>Passées</h2>
        {passees.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucune réservation passée.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {passees.map((reservation) => ligneReservation(reservation, true))}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";

import { EnteteEspace } from "@/components/EnteteEspace";
import { SignalerReservationBoutons } from "@/components/SignalerReservationBoutons";
import { authRestaurant } from "@/lib/auth";
import { formaterHeure, formaterJourLong } from "@/lib/fuseau";
import { prisma } from "@/lib/prisma";
import { ETAT_VIDE, TITRE_SECTION, pastilleEtat, type EtatPastille } from "@/lib/ui";
import type { Booking, User } from "@/generated/prisma";

export const metadata: Metadata = { title: "Réservations" };

type ReservationAvecClient = Booking & { user: User };

const STATUT: Record<ReservationAvecClient["statut"], { label: string; etat: EtatPastille }> = {
  CONFIRMEE: { label: "Confirmée", etat: "neutre" },
  ANNULEE: { label: "Annulée", etat: "neutre" },
  HONOREE: { label: "Honorée", etat: "succes" },
  NO_SHOW: { label: "No-show", etat: "danger" },
};

/** Fonction utilitaire (pas un composant) : Date.now() y est autorisé. */
function separerReservations(reservations: ReservationAvecClient[]) {
  const maintenant = Date.now();
  return {
    aVenir: reservations.filter((r) => r.date.getTime() > maintenant),
    passees: reservations.filter((r) => r.date.getTime() <= maintenant).reverse(),
  };
}

/** Initiale du dîneur — un repère visuel dans une liste de noms. */
function Pastille({ nom }: { nom: string }) {
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-pro-tint)] font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-pro)]"
    >
      {(nom.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

function LigneReservation({
  reservation,
  estPassee,
}: {
  reservation: ReservationAvecClient;
  estPassee: boolean;
}) {
  const aSignaler = estPassee && reservation.statut === "CONFIRMEE";
  const statut = STATUT[reservation.statut];

  return (
    <li
      className={`flex flex-wrap items-center gap-4 rounded-2xl border bg-white px-5 py-4 ${
        aSignaler
          ? "border-[var(--color-warning)]/35 bg-[var(--color-warning-tint)]"
          : "border-[var(--color-line-strong)]"
      }`}
    >
      <Pastille nom={reservation.user.name} />

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--color-ink)]">{reservation.user.name}</p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {formaterJourLong(reservation.date)} à {formaterHeure(reservation.date)} ·{" "}
          {reservation.couverts} couvert{reservation.couverts > 1 ? "s" : ""}
          {reservation.couvertsServis !== null &&
            ` · ${reservation.couvertsServis} servi${reservation.couvertsServis > 1 ? "s" : ""}`}
        </p>
      </div>

      {aSignaler ? (
        <SignalerReservationBoutons
          bookingId={reservation.id}
          couvertsPrevus={reservation.couverts}
        />
      ) : (
        <span className={pastilleEtat(statut.etat)}>{statut.label}</span>
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
  const aPointer = passees.filter((r) => r.statut === "CONFIRMEE").length;
  // Une réservation annulée reste dans la liste, avec son statut (cf. README),
  // mais elle ne compte pas comme une table à préparer : la compter ici
  // donnait un nombre différent de l'indicateur « À venir » du tableau de bord.
  const aVenirActives = aVenir.filter((r) => r.statut !== "ANNULEE").length;

  return (
    <>
      <EnteteEspace
        titre="Réservations reçues"
        description="Les créneaux passés se pointent honorés ou no-show — c'est ce geste qui alimente la facturation mensuelle."
      />

      <section>
        <h2 className={`${TITRE_SECTION} mb-4`}>
          À venir{" "}
          <span className="font-body text-base font-medium text-[var(--color-ink-muted)]">
            · {aVenirActives}
            {aVenir.length > aVenirActives && `, ${aVenir.length - aVenirActives} annulée${
              aVenir.length - aVenirActives > 1 ? "s" : ""
            }`}
          </span>
        </h2>
        {aVenir.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="font-semibold text-[var(--color-ink)]">Aucune réservation à venir</p>
            <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
              Vérifiez dans « Disponibilités » que vos créneaux des cinq prochains jours sont
              ouverts.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {aVenir.map((reservation) => (
              <LigneReservation key={reservation.id} reservation={reservation} estPassee={false} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-4`}>
          Passées{" "}
          <span className="font-body text-base font-medium text-[var(--color-ink-muted)]">
            · {passees.length}
            {aPointer > 0 && `, dont ${aPointer} à pointer`}
          </span>
        </h2>
        {passees.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="font-semibold text-[var(--color-ink)]">Aucune réservation passée</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {passees.map((reservation) => (
              <LigneReservation key={reservation.id} reservation={reservation} estPassee />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

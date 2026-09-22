import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { AnnulerReservationBouton } from "@/components/AnnulerReservationBouton";
import { PrevenirAbsenceBouton } from "@/components/PrevenirAbsenceBouton";
import { IconeCalendrier, IconeLieu } from "@/components/Icones";
import { PhotoCouverture } from "@/components/PhotoCouverture";
import {
  annulabilite,
  limiteAnnulation,
  MESSAGES_REFUS_ANNULATION,
  peutPrevenirAbsence,
} from "@/lib/annulation";
import { auth } from "@/lib/auth";
import { formaterHeure, formaterJourLong } from "@/lib/fuseau";
import { photoRestaurant } from "@/lib/images";
import { prisma } from "@/lib/prisma";
import { pastilleEtat, type EtatPastille } from "@/lib/ui";
import type { Booking, Restaurant } from "@/generated/prisma";

export const metadata: Metadata = { title: "Mes réservations" };

type ReservationAvecRestaurant = Booking & { restaurant: Restaurant };

const STATUT: Record<Booking["statut"], { label: string; etat: EtatPastille }> = {
  CONFIRMEE: { label: "Confirmée", etat: "succes" },
  ANNULEE: { label: "Annulée", etat: "neutre" },
  HONOREE: { label: "Honorée", etat: "succes" },
  NO_SHOW: { label: "Non honorée", etat: "danger" },
};

/** Fonction utilitaire (pas un composant) : Date.now() y est autorisé. */
function separerReservations(reservations: ReservationAvecRestaurant[]) {
  const maintenant = Date.now();
  return {
    aVenir: reservations.filter((r) => r.date.getTime() > maintenant),
    passees: reservations.filter((r) => r.date.getTime() <= maintenant).reverse(),
  };
}

/**
 * Ce que le dîneur peut encore faire de cette réservation. La même règle
 * qu'applique `annulerReservation` côté serveur : l'écran ne propose jamais
 * un bouton que le serveur refuserait, et n'en retire jamais un qu'il
 * accepterait.
 */
function CarteReservation({ reservation }: { reservation: ReservationAvecRestaurant }) {
  const statut = STATUT[reservation.statut];
  const delaiHeures = reservation.restaurant.delaiAnnulationHeures;
  const verdict = annulabilite(reservation, delaiHeures);
  const limite = limiteAnnulation(reservation.date, delaiHeures);
  const aPrevenu = reservation.absencePrevenueLe !== null;

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-[22px] border border-[var(--color-line-strong)] bg-white p-4">
      <Link
        href={`/restaurants/${reservation.restaurant.id}`}
        className="relative h-[72px] w-[92px] shrink-0 overflow-hidden rounded-xl"
      >
        <PhotoCouverture
          photo={photoRestaurant(reservation.restaurant)}
          alt={reservation.restaurant.nom}
          sizes="92px"
        />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/restaurants/${reservation.restaurant.id}`}
          className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--color-ink)] hover:underline"
        >
          {reservation.restaurant.nom}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-ink-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <IconeCalendrier taille={15} />
            {formaterJourLong(reservation.date)} à {formaterHeure(reservation.date)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconeLieu taille={15} />
            {reservation.restaurant.ville}
          </span>
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-ink-soft)]">
          {reservation.couverts} couvert{reservation.couverts > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          <span className={pastilleEtat(statut.etat)}>{statut.label}</span>
          {verdict.annulable && <AnnulerReservationBouton bookingId={reservation.id} />}
          {/* Le signal reste affiché une fois le service passé : c'est là que
              le dîneur a besoin de pouvoir dire qu'il avait prévenu. */}
          {aPrevenu && (
            <span className="text-sm font-semibold text-[var(--color-ink-muted)]">
              Le restaurant est prévenu
            </span>
          )}
          {!aPrevenu && peutPrevenirAbsence(reservation, delaiHeures) && (
            <PrevenirAbsenceBouton bookingId={reservation.id} />
          )}
        </div>

        {verdict.annulable && (
          <p className="text-xs text-[var(--color-ink-muted)]">
            {limite
              ? `Annulable jusqu'au ${formaterJourLong(limite)} à ${formaterHeure(limite)}`
              : "Annulable jusqu'à l'heure du repas"}
          </p>
        )}
        {!verdict.annulable && verdict.raison === "delai-depasse" && (
          <p className="max-w-[16rem] text-right text-xs text-[var(--color-ink-muted)]">
            {MESSAGES_REFUS_ANNULATION["delai-depasse"]}
          </p>
        )}
      </div>
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
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-4xl">
        Mes réservations
      </h1>
      <p className="mt-2 text-[var(--color-ink-muted)]">
        Annule gratuitement une table à venir, retrouve tes anciennes sorties pour y déposer un
        avis.
      </p>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          À venir · {aVenir.length}
        </h2>
        {aVenir.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-[24px] border border-dashed border-[var(--color-line-strong)] bg-white px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
              <IconeCalendrier taille={22} />
            </span>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
              Aucune table réservée
            </p>
            <p className="max-w-xs text-sm text-[var(--color-ink-muted)]">
              Il est encore temps de trouver une adresse pour ce soir.
            </p>
            <Link
              href="/"
              className="mt-1 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Trouver un restaurant
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {aVenir.map((reservation) => (
              <CarteReservation key={reservation.id} reservation={reservation} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Passées · {passees.length}
        </h2>
        {passees.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-ink-muted)]">Aucune réservation passée.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {passees.map((reservation) => (
              <CarteReservation key={reservation.id} reservation={reservation} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

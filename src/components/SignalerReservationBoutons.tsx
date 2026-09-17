"use client";

import { useActionState } from "react";

import {
  marquerReservation,
  type EtatSignalement,
} from "@/app/espace-restaurant/reservations/actions";

const BOUTON_HONOREE =
  "rounded-full bg-[var(--color-success)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const BOUTON_NO_SHOW =
  "rounded-full border-[1.5px] border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-tint)] disabled:cursor-not-allowed disabled:opacity-60";

const ETAT_INITIAL: EtatSignalement = {};

/** Boutons "Honorée" / "No-show" pour un créneau CONFIRMEE déjà passé. */
export function SignalerReservationBoutons({
  bookingId,
  couvertsPrevus,
}: {
  bookingId: string;
  couvertsPrevus: number;
}) {
  const [etatHonoree, actionHonoree, honoreeEnCours] = useActionState(
    marquerReservation.bind(null, bookingId, "HONOREE"),
    ETAT_INITIAL,
  );
  const [etatNoShow, actionNoShow, noShowEnCours] = useActionState(
    marquerReservation.bind(null, bookingId, "NO_SHOW"),
    ETAT_INITIAL,
  );

  const enCours = honoreeEnCours || noShowEnCours;
  const erreur = etatHonoree.erreur ?? etatNoShow.erreur;
  const idCouverts = `couverts-servis-${bookingId}`;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <form action={actionHonoree} className="flex items-center gap-2">
          <label
            htmlFor={idCouverts}
            className="text-xs font-medium text-[var(--color-ink-muted)]"
          >
            Couverts servis
          </label>
          <input
            id={idCouverts}
            type="number"
            name="couvertsServis"
            defaultValue={couvertsPrevus}
            min={1}
            disabled={enCours}
            className="w-16 rounded-lg border-[1.5px] border-[var(--color-line-strong)] px-2 py-1.5 text-sm font-semibold text-[var(--color-ink)]"
          />
          <button type="submit" disabled={enCours} className={BOUTON_HONOREE}>
            Honorée
          </button>
        </form>
        <form action={actionNoShow}>
          <button type="submit" disabled={enCours} className={BOUTON_NO_SHOW}>
            No-show
          </button>
        </form>
      </div>
      {erreur && (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {erreur}
        </p>
      )}
    </div>
  );
}

"use client";

import { useActionState } from "react";

import {
  marquerReservation,
  type EtatSignalement,
} from "@/app/espace-restaurant/reservations/actions";

const BOUTON_HONOREE =
  "rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60";
const BOUTON_NO_SHOW =
  "rounded-full border-[1.5px] border-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-tint)] disabled:opacity-60";

const ETAT_INITIAL: EtatSignalement = {};

/** Boutons "Honorée" / "No-show" pour un créneau CONFIRMEE déjà passé. */
export function SignalerReservationBoutons({ bookingId }: { bookingId: string }) {
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

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={actionHonoree}>
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
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  );
}

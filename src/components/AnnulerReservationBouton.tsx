"use client";

import { useActionState } from "react";

import { annulerReservation, type EtatAnnulation } from "@/app/mes-reservations/actions";

const ETAT_INITIAL: EtatAnnulation = {};

export function AnnulerReservationBouton({ bookingId }: { bookingId: string }) {
  const [etat, action, enCours] = useActionState(annulerReservation.bind(null, bookingId), ETAT_INITIAL);

  if (etat.ok) {
    return <span className="text-sm font-semibold text-[var(--color-ink-muted)]">Annulée</span>;
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={enCours}
        className="rounded-full border-[1.5px] border-[var(--color-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] disabled:opacity-60"
      >
        {enCours ? "Annulation…" : "Annuler"}
      </button>
      {etat.erreur && <p className="text-xs text-red-600">{etat.erreur}</p>}
    </form>
  );
}

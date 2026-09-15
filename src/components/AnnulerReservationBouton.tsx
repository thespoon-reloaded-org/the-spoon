"use client";

import { useActionState } from "react";

import { annulerReservation, type EtatAnnulation } from "@/app/(site)/mes-reservations/actions";
import { BOUTON_DANGER_DISCRET } from "@/lib/ui";

const ETAT_INITIAL: EtatAnnulation = {};

export function AnnulerReservationBouton({ bookingId }: { bookingId: string }) {
  const [etat, action, enCours] = useActionState(annulerReservation.bind(null, bookingId), ETAT_INITIAL);

  if (etat.ok) {
    return <span className="text-sm font-semibold text-[var(--color-ink-muted)]">Annulée</span>;
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={enCours} className={BOUTON_DANGER_DISCRET}>
        {enCours ? "Annulation…" : "Annuler"}
      </button>
      {etat.erreur && (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}

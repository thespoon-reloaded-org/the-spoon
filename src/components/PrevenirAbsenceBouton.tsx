"use client";

import { useActionState } from "react";

import { signalerAbsence, type EtatAbsence } from "@/app/(site)/mes-reservations/actions";
import { BOUTON_SECONDAIRE } from "@/lib/ui";

const ETAT_INITIAL: EtatAbsence = {};

/**
 * La porte de sortie quand le délai d'annulation est dépassé. Elle n'annule
 * rien — le restaurant garde la main sur honoré/no-show — mais elle lui
 * permet de libérer la table, et elle évite au dîneur empêché de n'avoir
 * d'autre choix que de ne pas venir sans rien dire.
 */
export function PrevenirAbsenceBouton({ bookingId }: { bookingId: string }) {
  const [etat, action, enCours] = useActionState(
    signalerAbsence.bind(null, bookingId),
    ETAT_INITIAL,
  );

  if (etat.ok) {
    return (
      <span className="text-sm font-semibold text-[var(--color-ink-muted)]">
        Le restaurant est prévenu
      </span>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
        {enCours ? "Envoi…" : "Je ne viendrai pas"}
      </button>
      {etat.erreur && (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { supprimerPlat, type EtatPlat } from "@/app/espace-restaurant/menu/actions";
import { BOUTON_DANGER_DISCRET } from "@/lib/ui";

const ETAT_INITIAL: EtatPlat = {};

export function SupprimerPlatBouton({ platId }: { platId: string }) {
  const [etat, action, enCours] = useActionState(supprimerPlat.bind(null, platId), ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={enCours} className={`${BOUTON_DANGER_DISCRET} disabled:opacity-60`}>
        {enCours ? "Suppression…" : "Supprimer"}
      </button>
      {etat.erreur && (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {etat.erreur}
        </p>
      )}
    </form>
  );
}

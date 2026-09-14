"use client";

import { useActionState } from "react";

import { supprimerPlat, type EtatPlat } from "@/app/restaurants/[id]/menu/actions";

const ETAT_INITIAL: EtatPlat = {};

export function SupprimerPlatBouton({
  restaurantId,
  platId,
}: {
  restaurantId: string;
  platId: string;
}) {
  const [etat, action, enCours] = useActionState(
    supprimerPlat.bind(null, restaurantId, platId),
    ETAT_INITIAL,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={enCours}
        className="rounded-full border-[1.5px] border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
      >
        {enCours ? "Suppression…" : "Supprimer"}
      </button>
      {etat.erreur && <p className="text-xs text-red-600">{etat.erreur}</p>}
    </form>
  );
}

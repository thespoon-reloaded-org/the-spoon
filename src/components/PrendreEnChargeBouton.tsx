"use client";

import { useActionState } from "react";

import { prendreEnChargeDossier, type EtatPriseEnCharge } from "@/app/admin/litiges/actions";
import { BOUTON_SECONDAIRE } from "@/lib/ui";

const ETAT_INITIAL: EtatPriseEnCharge = {};

/** Bouton "Prendre en charge" d'un dossier non assigné, dans la file des litiges à instruire. */
export function PrendreEnChargeBouton({ dossierId }: { dossierId: string }) {
  const [etat, action, enCours] = useActionState(
    prendreEnChargeDossier.bind(null, dossierId),
    ETAT_INITIAL,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
        Prendre en charge
      </button>
      {etat.erreur && <p className="text-xs text-red-600">{etat.erreur}</p>}
    </form>
  );
}

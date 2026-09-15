"use client";

import { useActionState } from "react";

import { mettreAJourSeuilContestation, type EtatSeuilContestation } from "@/app/admin/contestation/actions";
import { BOUTON_PRIMAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatSeuilContestation = {};

/** Formulaire à un champ pour éditer le seuil de crédit d'office (en euros, converti en centimes côté serveur). */
export function SeuilContestationForm({ seuilActuelEuros }: { seuilActuelEuros: number }) {
  const [etat, action, enCours] = useActionState(mettreAJourSeuilContestation, ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className={LABEL_CHAMP}>
        Seuil de crédit d&apos;office (€)
        <input
          type="number"
          name="seuilEuros"
          required
          min="0.01"
          step="0.01"
          defaultValue={seuilActuelEuros.toFixed(2)}
          className={CHAMP}
        />
      </label>
      <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
        Enregistrer
      </button>
      {etat.ok && <p className="text-sm text-green-700">Seuil mis à jour.</p>}
      {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
    </form>
  );
}

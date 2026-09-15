"use client";

import { useActionState } from "react";

import {
  genererFacturesDuMois,
  type EtatGenerationFactures,
} from "@/app/admin/factures/actions";
import { BOUTON_PRIMAIRE, CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatGenerationFactures = {};

/** Sélectionne un mois et déclenche la génération des factures de ce mois. */
export function GenererFacturesForm({ moisParDefaut }: { moisParDefaut: string }) {
  const [etat, action, enCours] = useActionState(genererFacturesDuMois, ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--color-ink-soft)]">
        Mois à facturer
        <input type="month" name="mois" defaultValue={moisParDefaut} className={CHAMP} />
      </label>
      <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
        Générer les factures
      </button>
      {etat.resume && <p className="text-sm text-green-700">{etat.resume}</p>}
      {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
    </form>
  );
}

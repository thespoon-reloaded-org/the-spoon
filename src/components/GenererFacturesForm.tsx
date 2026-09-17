"use client";

import { useActionState } from "react";

import {
  genererFacturesDuMois,
  type EtatGenerationFactures,
} from "@/app/admin/factures/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { BOUTON_PRIMAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatGenerationFactures = {};

/** Sélectionne un mois et déclenche la génération des factures de ce mois. */
export function GenererFacturesForm({ moisParDefaut }: { moisParDefaut: string }) {
  const [etat, action, enCours] = useActionState(genererFacturesDuMois, ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className={`${LABEL_CHAMP} w-full sm:w-56`}>
        Mois à facturer
        <input type="month" name="mois" defaultValue={moisParDefaut} className={CHAMP} />
      </label>
      <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
        {enCours ? "Génération…" : "Générer les factures"}
      </button>
      <MessageFormulaire type="succes" message={etat.resume} />
      <MessageFormulaire type="erreur" message={etat.erreur} />
    </form>
  );
}

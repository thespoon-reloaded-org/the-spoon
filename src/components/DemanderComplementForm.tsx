"use client";

import { useActionState } from "react";

import { demanderComplementDossier, type EtatDemandeComplement } from "@/app/admin/litiges/actions";
import { BOUTON_SECONDAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatDemandeComplement = {};

/** Formulaire "Demander un complément" — n'importe où dans l'instruction, ne clôture pas le dossier. */
export function DemanderComplementForm({ dossierId }: { dossierId: string }) {
  const [etat, action, enCours] = useActionState(
    demanderComplementDossier.bind(null, dossierId),
    ETAT_INITIAL,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className={LABEL_CHAMP}>
        Demander un complément au restaurant
        <textarea
          name="message"
          required
          rows={3}
          placeholder="Ce qui manque pour instruire ce dossier…"
          className={CHAMP}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
          Envoyer la demande
        </button>
        {etat.ok && <p className="text-sm text-green-700">Demande enregistrée.</p>}
        {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
      </div>
    </form>
  );
}

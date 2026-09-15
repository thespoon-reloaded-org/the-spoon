"use client";

import { useActionState } from "react";

import { demanderComplementDossier, type EtatDemandeComplement } from "@/app/admin/litiges/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
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
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
          {enCours ? "Envoi…" : "Envoyer la demande"}
        </button>
        {etat.ok && <MessageFormulaire type="succes">Demande enregistrée.</MessageFormulaire>}
        {etat.erreur && <MessageFormulaire type="erreur">{etat.erreur}</MessageFormulaire>}
      </div>
    </form>
  );
}

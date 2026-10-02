"use client";

import { useActionState } from "react";

import {
  demanderComplementDemandeRestaurateur,
  type EtatComplementDemande,
} from "@/app/admin/contacts-restaurateurs/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { BOUTON_SECONDAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatComplementDemande = {};

/**
 * Formulaire « Demander des informations » d'une demande de partenariat :
 * envoie un message au restaurateur sans trancher la demande. Toujours
 * affiché tant que la demande n'est pas décidée (voir la fiche) — le serveur
 * le revalide de toute façon (`demanderComplementDemandeRestaurateur`).
 */
export function DemanderComplementDemandeForm({ demandeId }: { demandeId: string }) {
  const [etat, action, enCours] = useActionState(
    demanderComplementDemandeRestaurateur.bind(null, demandeId),
    ETAT_INITIAL,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className={LABEL_CHAMP}>
        Message au restaurateur
        <textarea
          name="message"
          required
          rows={3}
          maxLength={2000}
          placeholder="Ce qu'il faut préciser pour instruire cette demande…"
          className={CHAMP}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enCours} className={BOUTON_SECONDAIRE}>
          {enCours ? "Envoi…" : "Envoyer la demande"}
        </button>
        <MessageFormulaire type="succes" message={etat.message} />
        <MessageFormulaire type="erreur" message={etat.erreur} />
      </div>
    </form>
  );
}

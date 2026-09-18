"use client";

import { useActionState } from "react";

import type { EtatFormulaireContact } from "@/app/admin/restaurants/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { BOUTON_PRIMAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatFormulaireContact = {};

/**
 * Formulaire "Ajouter un contact" de la fiche restaurant admin — voir
 * `creerContactRestaurant`. Le mot de passe temporaire généré n'est jamais
 * dans un champ du formulaire : il n'existe que dans le message de succès,
 * une fois, après soumission.
 */
export function ContactRestaurantForm({
  action,
}: {
  action: (etat: EtatFormulaireContact, formData: FormData) => Promise<EtatFormulaireContact>;
}) {
  const [etat, soumettre, enCours] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={soumettre} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={LABEL_CHAMP}>
          Nom
          <input type="text" name="nom" required maxLength={80} className={CHAMP} />
        </label>

        <label className={LABEL_CHAMP}>
          Email
          <input type="email" name="email" required className={CHAMP} />
        </label>
      </div>

      <label className={LABEL_CHAMP}>
        Rôle
        <select name="role" defaultValue="GERANT" className={CHAMP}>
          <option value="GERANT">Gérant</option>
          <option value="CHEF_DE_SALLE">Chef de salle</option>
        </select>
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
            {enCours ? "Création…" : "Ajouter le contact"}
          </button>
          <MessageFormulaire type="erreur" message={etat.erreur} />
        </div>
        <MessageFormulaire
          type="succes"
          message={
            etat.ok && etat.motDePasseGenere ? (
              <span>
                Contact créé. Mot de passe temporaire à lui transmettre :{" "}
                <strong className="font-mono">{etat.motDePasseGenere}</strong> — affiché une seule
                fois, note-le maintenant.
              </span>
            ) : null
          }
        />
      </div>
    </form>
  );
}

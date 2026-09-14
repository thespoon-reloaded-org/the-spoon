"use client";

import { useActionState } from "react";

import type { EtatFormulaireRestaurant } from "@/app/admin/restaurants/actions";
import { BOUTON_PRIMAIRE, CARTE, CHAMP, EYEBROW, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatFormulaireRestaurant = {};

export function RestaurantForm({
  action,
  libelleBouton,
  valeursInitiales,
}: {
  action: (etat: EtatFormulaireRestaurant, formData: FormData) => Promise<EtatFormulaireRestaurant>;
  libelleBouton: string;
  valeursInitiales?: {
    nom: string;
    ville: string;
    cuisine: string;
    adresse: string;
    horaires: string | null;
    description: string | null;
    capacite: number | null;
  };
}) {
  const [etat, soumettre, enCours] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={soumettre} className="flex max-w-xl flex-col gap-6">
      <div className={`${CARTE} flex flex-col gap-4`}>
        <h2 className={EYEBROW}>Identité</h2>

        <label className={LABEL_CHAMP}>
          Nom
          <input
            type="text"
            name="nom"
            required
            defaultValue={valeursInitiales?.nom}
            className={CHAMP}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={LABEL_CHAMP}>
            Ville
            <input
              type="text"
              name="ville"
              required
              defaultValue={valeursInitiales?.ville}
              className={CHAMP}
            />
          </label>

          <label className={LABEL_CHAMP}>
            Cuisine
            <input
              type="text"
              name="cuisine"
              required
              defaultValue={valeursInitiales?.cuisine}
              className={CHAMP}
            />
          </label>
        </div>

        <label className={LABEL_CHAMP}>
          Adresse
          <input
            type="text"
            name="adresse"
            required
            defaultValue={valeursInitiales?.adresse}
            className={CHAMP}
          />
        </label>
      </div>

      <div className={`${CARTE} flex flex-col gap-4`}>
        <h2 className={EYEBROW}>Fonctionnement</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={LABEL_CHAMP}>
            Horaires (texte affiché aux dîneurs)
            <input
              type="text"
              name="horaires"
              defaultValue={valeursInitiales?.horaires ?? ""}
              placeholder="Mar-Sam 12h-14h, 19h-22h30"
              className={CHAMP}
            />
          </label>

          <label className={LABEL_CHAMP}>
            Capacité (couverts)
            <input
              type="number"
              name="capacite"
              min={1}
              defaultValue={valeursInitiales?.capacite ?? ""}
              className={CHAMP}
            />
          </label>
        </div>

        <label className={LABEL_CHAMP}>
          Description
          <textarea
            name="description"
            rows={3}
            defaultValue={valeursInitiales?.description ?? ""}
            className={CHAMP}
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
          {enCours ? "Enregistrement…" : libelleBouton}
        </button>
        {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
      </div>
    </form>
  );
}

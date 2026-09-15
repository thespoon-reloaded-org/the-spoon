"use client";

import { useActionState } from "react";

import { mettreAJourFiche, type EtatFiche } from "@/app/espace-restaurant/fiche/actions";
import { BOUTON_PRIMAIRE, CARTE, CHAMP, EYEBROW, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatFiche = {};

export function FicheEtablissementForm({
  fiche,
}: {
  fiche: {
    id: string;
    nom: string;
    ville: string;
    cuisine: string;
    adresse: string;
    horaires: string | null;
    description: string | null;
    capacite: number | null;
    delaiAnnulationHeures: number | null;
    photoMisAJourLe: Date | null;
  };
}) {
  const [etat, action, enCours] = useActionState(mettreAJourFiche, ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className={`${CARTE} flex flex-col gap-4`}>
        <h2 className={EYEBROW}>Identité</h2>

        <label className={LABEL_CHAMP}>
          Nom
          <input type="text" name="nom" required defaultValue={fiche.nom} className={CHAMP} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={LABEL_CHAMP}>
            Ville
            <input type="text" name="ville" required defaultValue={fiche.ville} className={CHAMP} />
          </label>
          <label className={LABEL_CHAMP}>
            Cuisine
            <input
              type="text"
              name="cuisine"
              required
              defaultValue={fiche.cuisine}
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
            defaultValue={fiche.adresse}
            className={CHAMP}
          />
        </label>

        <label className={LABEL_CHAMP}>
          Photo
          {fiche.photoMisAJourLe && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/restaurants/${fiche.id}/photo?v=${fiche.photoMisAJourLe.getTime()}`}
              alt={`Photo de ${fiche.nom}`}
              className="h-32 w-full rounded-xl object-cover"
            />
          )}
          <input type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/gif" className="text-sm text-[var(--color-ink)]" />
          <span className="text-xs font-normal text-[var(--color-ink-muted)]">
            {fiche.photoMisAJourLe
              ? "Laisse vide pour garder la photo actuelle."
              : "Facultatif — JPG/PNG, 5 Mo max."}
          </span>
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
              defaultValue={fiche.horaires ?? ""}
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
              defaultValue={fiche.capacite ?? ""}
              className={CHAMP}
            />
          </label>
        </div>

        <label className={LABEL_CHAMP}>
          Description
          <textarea
            name="description"
            defaultValue={fiche.description ?? ""}
            maxLength={1000}
            rows={4}
            className={CHAMP}
          />
        </label>
      </div>

      <div className={`${CARTE} flex flex-col gap-4`}>
        <div>
          <h2 className={EYEBROW}>Politique d&apos;annulation</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Prépare le délai minimal d&apos;annulation côté dîneur — pas encore appliqué.
          </p>
        </div>

        <label className={LABEL_CHAMP}>
          Délai avant annulation tardive (heures)
          <input
            type="number"
            name="delaiAnnulationHeures"
            min={1}
            defaultValue={fiche.delaiAnnulationHeures ?? ""}
            placeholder="Pas de politique définie"
            className={CHAMP}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
          {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}
          {etat.ok && !etat.avertissement && (
            <p className="text-sm text-green-700">Fiche mise à jour.</p>
          )}
        </div>
        {etat.avertissement && <p className="text-sm text-amber-700">{etat.avertissement}</p>}
      </div>
    </form>
  );
}

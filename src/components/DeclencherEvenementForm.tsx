"use client";

import { startTransition, useActionState } from "react";

import { declencherEvenement, type EtatEvenement } from "@/app/formateur/evenements/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import type { EvenementFormation } from "@/generated/prisma";
import { BOUTON_PRIMAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatEvenement = {};

/** Combien, où, et pour les avis quelle note — puis on déclenche. */
export function DeclencherEvenementForm({
  evenement,
  quantiteMax,
  restaurants,
  avecNote = false,
}: {
  evenement: EvenementFormation;
  quantiteMax: number;
  /** Absent : l'événement ne vise pas de restaurant. */
  restaurants?: { id: string; nom: string; ville: string }[];
  avecNote?: boolean;
}) {
  const [etat, declencher, enCours] = useActionState(declencherEvenement, ETAT_INITIAL);

  // Envoyé à la main plutôt que par `action` : React vide un formulaire après
  // une action, et un formateur qui relance le même lot n'a pas à tout
  // ressaisir.
  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    startTransition(() => declencher(donnees));
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-4">
      <input type="hidden" name="evenement" value={evenement} />

      <div className="flex flex-wrap gap-3">
        <label className={`${LABEL_CHAMP} w-28`}>
          Combien
          <input
            type="number"
            name="quantite"
            required
            min={1}
            max={quantiteMax}
            defaultValue={Math.min(5, quantiteMax)}
            className={CHAMP}
          />
        </label>

        {restaurants && (
          <label className={`${LABEL_CHAMP} min-w-0 flex-1 basis-56`}>
            Où
            <select name="restaurantId" defaultValue="" className={CHAMP}>
              <option value="">Tous les restaurants</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom} — {r.ville}
                </option>
              ))}
            </select>
          </label>
        )}

        {avecNote && (
          <label className={`${LABEL_CHAMP} min-w-0 flex-1 basis-44`}>
            Note
            <select name="note" defaultValue="realiste" className={CHAMP}>
              <option value="realiste">Comme sur la plateforme</option>
              <option value="5">5 cuillères</option>
              <option value="4">4 cuillères</option>
              <option value="3">3 cuillères</option>
              <option value="2">2 cuillères</option>
              <option value="1">1 cuillère</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
          {enCours ? "En cours…" : "Déclencher"}
        </button>
        <span className="text-xs text-[var(--color-ink-muted)]">
          {quantiteMax} au plus par envoi
        </span>
      </div>

      <MessageFormulaire type="succes" message={etat.message} />
      <MessageFormulaire type="erreur" message={etat.erreur} />
    </form>
  );
}

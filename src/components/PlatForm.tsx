"use client";

import { useActionState, useState } from "react";

import type { EtatPlat } from "@/app/espace-restaurant/menu/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import type { Allergene, PlatCuillere } from "@/generated/prisma";
import { ALLERGENES, LIBELLE_ALLERGENE, PRECISION_ALLERGENE } from "@/lib/allergenes";
import { CATEGORIES } from "@/lib/plats";
import { BOUTON_PRIMAIRE, CHAMP, CHAMP_FICHIER, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatPlat = {};

type PlatExistant = Pick<
  PlatCuillere,
  | "id"
  | "nom"
  | "description"
  | "categorie"
  | "prixCentimes"
  | "photoMisAJourLe"
  | "allergenes"
  | "allergenesDeclaresLe"
>;

export function PlatForm({
  action,
  plat,
  libelleSoumission,
}: {
  action: (etatPrecedent: EtatPlat, formData: FormData) => Promise<EtatPlat>;
  plat?: PlatExistant;
  libelleSoumission: string;
}) {
  const [etat, formAction, enCours] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className={LABEL_CHAMP}>
        Nom du plat
        <input
          type="text"
          name="nom"
          required
          maxLength={80}
          defaultValue={plat?.nom ?? ""}
          placeholder="Ex. Risotto aux cèpes"
          className={CHAMP}
        />
      </label>

      <label className={LABEL_CHAMP}>
        Description (ingrédients, etc.)
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={plat?.description ?? ""}
          placeholder="Riz carnaroli, cèpes séchés, parmesan 24 mois…"
          className={CHAMP}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={LABEL_CHAMP}>
          Catégorie
          <select name="categorie" defaultValue={plat?.categorie ?? "PLAT"} className={CHAMP}>
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.libelle}
              </option>
            ))}
          </select>
        </label>

        <label className={LABEL_CHAMP}>
          Prix (€)
          <input
            type="number"
            name="prixEuros"
            required
            min="0.01"
            step="0.01"
            defaultValue={plat ? (plat.prixCentimes / 100).toFixed(2) : undefined}
            placeholder="14.50"
            className={CHAMP}
          />
        </label>
      </div>

      {/* `key` sur la déclaration enregistrée : après un enregistrement, la
          page se revalide et `plat` revient à jour, mais un `useState` ignore
          sa valeur initiale une fois monté — les cases seraient restées sur
          l'ancienne saisie, à mentir sur ce qui est en base. Remonter ce seul
          bloc les resynchronise sans effacer le message de `useActionState`,
          qui vit dans le composant parent. */}
      <ChampsAllergenes key={cleDeclaration(plat)} plat={plat} />

      <label className={LABEL_CHAMP}>
        Photo
        {plat?.photoMisAJourLe && (
          /* Photo servie par la route API avec un cache-bust `?v=…` : pas
             d'optimisation `next/image` possible, voir `PhotoCouverture`. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/plats/${plat.id}/photo?v=${plat.photoMisAJourLe.getTime()}`}
            alt={`Photo actuelle de ${plat.nom}`}
            className="h-32 w-32 rounded-[16px] object-cover"
          />
        )}
        <input
          type="file"
          name="photo"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className={CHAMP_FICHIER}
        />
        <span className="text-xs font-normal text-[var(--color-ink-muted)]">
          {plat
            ? "Laissez vide pour garder la photo actuelle."
            : "Facultatif — JPG/PNG, 5 Mo max. Sans photo, un visuel générique est affiché."}
        </span>
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
            {enCours ? "Enregistrement…" : libelleSoumission}
          </button>
          <MessageFormulaire type="erreur" message={etat.erreur} />
          <MessageFormulaire
            type="succes"
            message={etat.ok && !etat.avertissement ? "Enregistré." : null}
          />
        </div>
        <MessageFormulaire type="avertissement" message={etat.avertissement} />
      </div>
    </form>
  );
}

/** Identifie la déclaration enregistrée : elle change, les cases se resynchronisent. */
function cleDeclaration(plat?: PlatExistant) {
  if (!plat?.allergenesDeclaresLe) return "non-declare";
  return `${plat.allergenesDeclaresLe.getTime()}:${plat.allergenes.join(",")}`;
}

/**
 * Les 14 cases réglementaires, plus celle qui affirme qu'il n'y en a aucune.
 * Les deux s'excluent, et on le rend impossible à l'écran plutôt que de le
 * refuser après coup : cocher « aucun » désactive la grille, et cocher un
 * allergène désactive « aucun ». Le serveur retranche quand même
 * (cf. `declarationDepuisFormulaire`) — un formulaire n'est pas une garde.
 */
function ChampsAllergenes({ plat }: { plat?: PlatExistant }) {
  const [allergenes, setAllergenes] = useState<Allergene[]>(plat?.allergenes ?? []);
  const [aucunAllergene, setAucunAllergene] = useState(
    plat ? plat.allergenesDeclaresLe !== null && plat.allergenes.length === 0 : false,
  );

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-[var(--color-line-strong)] p-4">
      <legend className="px-1 text-sm font-semibold text-[var(--color-ink-soft)]">
        Allergènes
      </legend>
      <p className="text-xs text-[var(--color-ink-muted)]">
        Les 14 allergènes à déclaration obligatoire. Tant que rien n&apos;est coché, la fiche
        publique affiche « non renseignés » — elle ne dira jamais qu&apos;il n&apos;y en a pas à
        votre place.
      </p>

      <label className="mt-1 flex items-center gap-2.5 text-sm font-semibold text-[var(--color-ink)]">
        <input
          type="checkbox"
          name="aucunAllergene"
          checked={aucunAllergene}
          disabled={allergenes.length > 0}
          onChange={(e) => setAucunAllergene(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-pro)]"
        />
        Aucun de ces allergènes dans ce plat
      </label>

      <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {ALLERGENES.map((allergene) => (
          <label
            key={allergene}
            className={`flex items-center gap-2.5 text-sm ${
              aucunAllergene ? "text-[var(--color-ink-muted)]" : "text-[var(--color-ink)]"
            }`}
          >
            <input
              type="checkbox"
              name="allergenes"
              value={allergene}
              checked={allergenes.includes(allergene)}
              disabled={aucunAllergene}
              onChange={(e) =>
                setAllergenes((actuels) =>
                  e.target.checked
                    ? [...actuels, allergene]
                    : actuels.filter((a) => a !== allergene),
                )
              }
              className="h-4 w-4 shrink-0 accent-[var(--color-pro)]"
            />
            <span>
              {LIBELLE_ALLERGENE[allergene]}
              {PRECISION_ALLERGENE[allergene] && (
                <span className="text-[var(--color-ink-muted)]">
                  {" "}
                  ({PRECISION_ALLERGENE[allergene]})
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

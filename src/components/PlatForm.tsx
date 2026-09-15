"use client";

import { useActionState } from "react";

import type { EtatPlat } from "@/app/espace-restaurant/menu/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import type { PlatCuillere } from "@/generated/prisma";
import { CATEGORIES } from "@/lib/plats";
import { BOUTON_PRIMAIRE, CHAMP, CHAMP_FICHIER, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatPlat = {};

type PlatExistant = Pick<
  PlatCuillere,
  "id" | "nom" | "description" | "categorie" | "prixCentimes" | "photoMisAJourLe"
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
          {etat.erreur && <MessageFormulaire type="erreur">{etat.erreur}</MessageFormulaire>}
          {etat.ok && !etat.avertissement && (
            <MessageFormulaire type="succes">Enregistré.</MessageFormulaire>
          )}
        </div>
        {etat.avertissement && (
          <MessageFormulaire type="avertissement">{etat.avertissement}</MessageFormulaire>
        )}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import type { EtatPlat } from "@/app/restaurants/[id]/menu/actions";

const CATEGORIES: { valeur: "ENTREE" | "PLAT" | "DESSERT"; libelle: string }[] = [
  { valeur: "ENTREE", libelle: "Entrée" },
  { valeur: "PLAT", libelle: "Plat" },
  { valeur: "DESSERT", libelle: "Dessert" },
];

const CHAMP =
  "rounded-[16px] border-[1.5px] border-[var(--color-line-strong)] px-4 py-3 text-sm text-[var(--color-ink)]";
const LABEL = "font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]";
const BOUTON =
  "rounded-full bg-[var(--color-accent)] px-7 py-4 text-center font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] disabled:opacity-60";

const ETAT_INITIAL: EtatPlat = {};

type PlatExistant = {
  id: string;
  nom: string;
  description: string | null;
  categorie: "ENTREE" | "PLAT" | "DESSERT";
  prixCentimes: number;
  photoMisAJourLe: Date | null;
};

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
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-[30px] border border-[var(--color-line)] bg-white p-7"
    >
      <div className="flex flex-col gap-2">
        <span className={LABEL}>NOM DU PLAT</span>
        <input
          type="text"
          name="nom"
          required
          maxLength={80}
          defaultValue={plat?.nom ?? ""}
          placeholder="Ex. Risotto aux cèpes"
          className={CHAMP}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={LABEL}>DESCRIPTION (INGRÉDIENTS, ETC.)</span>
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={plat?.description ?? ""}
          placeholder="Riz carnaroli, cèpes séchés, parmesan 24 mois…"
          className={CHAMP}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <span className={LABEL}>CATÉGORIE</span>
          <select name="categorie" defaultValue={plat?.categorie ?? "PLAT"} className={CHAMP}>
            {CATEGORIES.map((c) => (
              <option key={c.valeur} value={c.valeur}>
                {c.libelle}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <span className={LABEL}>PRIX (€)</span>
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
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={LABEL}>PHOTO</span>
        {plat?.photoMisAJourLe && (
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
          accept="image/*"
          className="text-sm text-[var(--color-ink)]"
        />
        <span className="text-xs text-[var(--color-ink-muted)]">
          {plat ? "Laisse vide pour garder la photo actuelle." : "Facultatif — JPG/PNG, 5 Mo max."}
        </span>
      </div>

      {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}

      <button type="submit" disabled={enCours} className={BOUTON}>
        {enCours ? "Enregistrement…" : libelleSoumission}
      </button>
    </form>
  );
}

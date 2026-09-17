"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { deposerAvis, type EtatAvis } from "@/app/(site)/restaurants/[id]/actions";
import { IconeValide } from "@/components/Icones";
import { Cuillere } from "@/components/NoteCuilleres";

const BOUTON =
  "w-full rounded-full bg-[var(--color-accent)] px-7 py-3.5 text-center font-[family-name:var(--font-display)] text-[15px] font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60";

const CARTE_AVIS =
  "rounded-[28px] border border-[var(--color-line-strong)] bg-white p-6 shadow-[var(--shadow-carte)]";

const ETAT_INITIAL: EtatAvis = {};

const LIBELLE_NOTE = ["", "Décevant", "Moyen", "Bien", "Très bien", "Excellent"] as const;

/**
 * Sélecteur de note : cinq cuillères cliquables plutôt que cinq pastilles
 * « 1 🥄 » … « 5 🥄 ». On note en survolant puis en cliquant, comme partout
 * ailleurs — et la note choisie reste lisible au clavier grâce aux boutons.
 */
function SelecteurCuilleres({
  note,
  onChange,
}: {
  note: number;
  onChange: (n: number) => void;
}) {
  const [survolee, setSurvolee] = useState<number | null>(null);
  const affichee = survolee ?? note;

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Note en cuillères"
        onMouseLeave={() => setSurvolee(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={note === n}
            aria-label={`${n} cuillère${n > 1 ? "s" : ""} sur 5`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setSurvolee(n)}
            onFocus={() => setSurvolee(n)}
            onBlur={() => setSurvolee(null)}
            className="rounded-lg p-0.5 text-[var(--color-accent)] transition-transform hover:scale-110"
          >
            <Cuillere pleine={n <= affichee} taille={30} opaciteVide="opacity-30" />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-[var(--color-ink-soft)]">
        {LIBELLE_NOTE[affichee]}
      </span>
    </div>
  );
}

export function AvisForm({
  restaurantId,
  estConnecte,
  peutDeposer,
  avisExistant,
}: {
  restaurantId: string;
  estConnecte: boolean;
  peutDeposer: boolean;
  avisExistant: { noteCuilleres: number; commentaire: string | null } | null;
}) {
  const [note, setNote] = useState(avisExistant?.noteCuilleres ?? 5);
  const [etat, action, enCours] = useActionState(deposerAvis.bind(null, restaurantId), ETAT_INITIAL);

  if (!estConnecte) {
    return (
      <div className={`${CARTE_AVIS} flex flex-col gap-3 text-center`}>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Connecte-toi pour déposer un avis sur ce restaurant.
        </p>
        <Link href="/connexion" className={BOUTON}>
          Se connecter
        </Link>
      </div>
    );
  }

  if (!peutDeposer) {
    return (
      <div className={`${CARTE_AVIS} text-center`}>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Seuls les dîneurs venus sur place peuvent noter : réserve une table et reviens après
          ton repas.
        </p>
      </div>
    );
  }

  if (etat.ok) {
    return (
      <div className={`${CARTE_AVIS} flex flex-col items-center gap-2 text-center`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-success-tint)] text-[var(--color-success)]">
          <IconeValide taille={24} />
        </span>
        <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
          Merci pour ton avis
        </p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Il est déjà visible sur la fiche du restaurant.
        </p>
      </div>
    );
  }

  return (
    <div className={`${CARTE_AVIS} flex flex-col gap-5`}>
      <h3 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--color-ink)]">
        {avisExistant ? "Modifier mon avis" : "Laisser un avis"}
      </h3>

      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="noteCuilleres" value={note} />

        <SelecteurCuilleres note={note} onChange={setNote} />

        <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--color-ink-soft)]">
          Commentaire <span className="font-normal text-[var(--color-ink-muted)]">(facultatif)</span>
          <textarea
            name="commentaire"
            defaultValue={avisExistant?.commentaire ?? ""}
            maxLength={500}
            rows={4}
            placeholder="Ce que tu as aimé, ce qui peut être amélioré…"
            className="rounded-[16px] border-[1.5px] border-[var(--color-line-strong)] px-4 py-3 text-sm font-normal text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-muted)] hover:border-[var(--color-ink-muted)] focus:border-[var(--color-ink)]"
          />
        </label>

        {etat.erreur && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]"
          >
            {etat.erreur}
          </p>
        )}

        <button type="submit" disabled={enCours} className={BOUTON}>
          {enCours ? "Envoi…" : avisExistant ? "Modifier mon avis" : "Déposer mon avis"}
        </button>
      </form>
    </div>
  );
}

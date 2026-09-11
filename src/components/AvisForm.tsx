"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { deposerAvis, type EtatAvis } from "@/app/restaurants/[id]/actions";

const CHIP =
  "flex-1 rounded-[13px] border-[1.5px] px-3 py-2.5 text-center text-sm font-semibold cursor-pointer select-none transition-colors";
const CHIP_INACTIF = `${CHIP} border-[var(--color-line-strong)] text-[var(--color-ink)]`;
const CHIP_ACTIF = `${CHIP} border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]`;
const BOUTON =
  "rounded-full bg-[var(--color-accent)] px-7 py-4 text-center font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] disabled:opacity-60";

const ETAT_INITIAL: EtatAvis = {};

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
      <div className="flex flex-col gap-3 rounded-[30px] border border-[var(--color-line)] bg-white p-7 text-center">
        <p className="text-sm text-[var(--color-ink-muted)]">Connecte-toi pour déposer un avis.</p>
        <Link href="/connexion" className={BOUTON}>
          Se connecter
        </Link>
      </div>
    );
  }

  if (!peutDeposer) {
    return (
      <div className="rounded-[30px] border border-[var(--color-line)] bg-white p-7 text-center">
        <p className="text-sm text-[var(--color-ink-muted)]">
          Réserve une table et reviens après ton repas pour laisser un avis.
        </p>
      </div>
    );
  }

  if (etat.ok) {
    return (
      <div className="flex flex-col gap-2 rounded-[30px] border border-[var(--color-line)] bg-white p-7 text-center">
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
          Merci pour ton avis 🥄
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-[30px] border border-[var(--color-line)] bg-white p-7">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
        {avisExistant ? "Modifier mon avis" : "Laisser un avis"}
      </h2>

      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="noteCuilleres" value={note} />

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
            NOTE
          </span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote(n)}
                className={note === n ? CHIP_ACTIF : CHIP_INACTIF}
              >
                {n} 🥄
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
            COMMENTAIRE
          </span>
          <textarea
            name="commentaire"
            defaultValue={avisExistant?.commentaire ?? ""}
            maxLength={500}
            rows={4}
            placeholder="Ton expérience dans ce restaurant (facultatif)"
            className="rounded-[16px] border-[1.5px] border-[var(--color-line-strong)] px-4 py-3 text-sm text-[var(--color-ink)]"
          />
        </div>

        {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}

        <button type="submit" disabled={enCours} className={BOUTON}>
          {enCours ? "Envoi…" : avisExistant ? "Modifier mon avis" : "Déposer mon avis"}
        </button>
      </form>
    </div>
  );
}

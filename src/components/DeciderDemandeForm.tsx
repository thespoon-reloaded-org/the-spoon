"use client";

import { useActionState, useState } from "react";

import {
  deciderDemandeRestaurateur,
  type EtatDecisionDemande,
} from "@/app/admin/contacts-restaurateurs/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import type { IssueDemande } from "@/lib/demande-labels";
import { BOUTON_PRIMAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatDecisionDemande = {};

/**
 * Ce que chaque issue veut dire, en une phrase — le staff choisit une
 * conséquence, pas un mot d'énumération.
 */
const ISSUES: { valeur: IssueDemande; libelle: string; consequence: string }[] = [
  {
    valeur: "ACCEPTEE",
    libelle: "Accepter",
    consequence: "La demande passe en « Acceptée ». Le référencement reste manuel.",
  },
  {
    valeur: "REJETEE",
    libelle: "Rejeter",
    consequence: "La demande passe en « Rejetée ». Le motif est conservé au journal.",
  },
];

/**
 * Formulaire de décision d'une demande restaurateur : accepter ou rejeter,
 * avec un motif obligatoire. Une fois la décision prise, la fiche ne
 * l'affiche plus (voir la page détail) — le serveur le revalide de toute
 * façon (`deciderDemandeRestaurateur`).
 */
export function DeciderDemandeForm({ demandeId }: { demandeId: string }) {
  const [etat, action, enCours] = useActionState(
    deciderDemandeRestaurateur.bind(null, demandeId),
    ETAT_INITIAL,
  );
  const [issue, setIssue] = useState<IssueDemande>("ACCEPTEE");

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-[var(--color-ink-soft)]">
          Issue de la demande
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ISSUES.map((option) => (
            <label
              key={option.valeur}
              className={`flex cursor-pointer gap-3 rounded-xl border-[1.5px] p-3.5 transition-colors ${
                issue === option.valeur
                  ? "border-[var(--color-staff)] bg-[var(--color-staff-tint)]"
                  : "border-[var(--color-line-strong)] hover:border-[var(--color-ink-muted)]"
              }`}
            >
              <input
                type="radio"
                name="issue"
                value={option.valeur}
                checked={issue === option.valeur}
                onChange={() => setIssue(option.valeur)}
                className="mt-0.5 accent-[var(--color-staff)]"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-[var(--color-ink)]">
                  {option.libelle}
                </span>
                <span className="text-xs leading-snug text-[var(--color-ink-muted)]">
                  {option.consequence}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className={LABEL_CHAMP}>
        Motif de la décision
        <textarea
          name="motif"
          required
          rows={3}
          maxLength={2000}
          placeholder="Pourquoi cette décision ? C'est ce que gardera le journal…"
          className={CHAMP}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
          {enCours ? "Enregistrement…" : "Enregistrer la décision"}
        </button>
        <MessageFormulaire type="succes" message={etat.message} />
        <MessageFormulaire type="erreur" message={etat.erreur} />
      </div>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";

import { deciderDossier, type EtatDecision } from "@/app/admin/litiges/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { BOUTON_PRIMAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";
import type { IssueDecision } from "@/generated/prisma";

const ETAT_INITIAL: EtatDecision = {};

/**
 * Ce que chaque issue veut dire, en une phrase — l'instructeur choisit une
 * conséquence, pas un mot d'énumération.
 */
const ISSUES: { valeur: IssueDecision; libelle: string; consequence: (montant: string) => string }[] = [
  {
    valeur: "ACCORDE",
    libelle: "Accorder",
    consequence: (montant) => `Un avoir de ${montant} est émis sur la facture.`,
  },
  {
    valeur: "PARTIEL",
    libelle: "Accorder en partie",
    consequence: () => "Un avoir est émis pour le montant retenu, pas pour la totalité.",
  },
  {
    valeur: "REFUSE",
    libelle: "Refuser",
    consequence: () => "Aucun avoir : la facture reste due telle quelle.",
  },
  {
    valeur: "ESCALADE",
    libelle: "Escalader",
    consequence: () => "Rien n'est tranché : le dossier sort de la file et attend une reprise.",
  },
];

/**
 * Formulaire de décision d'un dossier de contestation. Les champs dépendent
 * de l'issue : un refus ne demande pas d'imputation (le coût reste au
 * restaurant par définition), une escalade ne demande rien d'autre qu'un
 * motif. Le serveur revalide tout (`deciderDossier` dans
 * src/lib/contestation.ts) — ce masquage est un confort de saisie, pas une
 * garantie.
 */
export function DeciderDossierForm({
  dossierId,
  montantContesteCentimes,
  montantConteste,
}: {
  dossierId: string;
  montantContesteCentimes: number;
  /** Déjà formaté côté serveur : `formaterMontant` vit dans un module qui importe Prisma. */
  montantConteste: string;
}) {
  const [etat, action, enCours] = useActionState(deciderDossier.bind(null, dossierId), ETAT_INITIAL);
  const [issue, setIssue] = useState<IssueDecision>("ACCORDE");

  const creditQuelqueChose = issue === "ACCORDE" || issue === "PARTIEL";

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-[var(--color-ink-soft)]">
          Issue de l&apos;instruction
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
                <span className="text-sm font-semibold text-[var(--color-ink)]">{option.libelle}</span>
                <span className="text-xs leading-snug text-[var(--color-ink-muted)]">
                  {option.consequence(montantConteste)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {issue === "PARTIEL" && (
        <label className={`${LABEL_CHAMP} sm:max-w-xs`}>
          Montant accordé (€)
          <input
            type="number"
            name="montantAccordeEuros"
            step="0.01"
            min="0.01"
            max={(montantContesteCentimes - 1) / 100}
            required
            className={CHAMP}
          />
          <span className="text-xs font-normal text-[var(--color-ink-muted)]">
            Strictement sous {montantConteste} — au-delà, c&apos;est un accord total.
          </span>
        </label>
      )}

      {creditQuelqueChose && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-[var(--color-ink-soft)]">
            Qui porte le coût
          </legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input
                type="radio"
                name="imputation"
                value="THESPOON"
                defaultChecked
                className="accent-[var(--color-staff)]"
              />
              TheSpoon
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input type="radio" name="imputation" value="CLIENT" className="accent-[var(--color-staff)]" />
              Le client
            </label>
          </div>
          <p className="text-xs leading-snug text-[var(--color-ink-muted)]">
            Le restaurant est crédité dans les deux cas. « Le client » ouvre la voie à des frais de
            no-show au dîneur — une facturation séparée, qui n&apos;est pas encore construite.
          </p>
        </fieldset>
      )}

      <label className={LABEL_CHAMP}>
        Motif de la décision
        <textarea
          name="motif"
          required
          rows={3}
          placeholder="Ce que le restaurant lira en réponse à son dossier…"
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

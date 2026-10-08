import { formaterJourEtHeure } from "@/lib/fuseau";

export type LigneJournalFormateur = {
  id: string;
  resume: string;
  createdAt: Date;
  formateur: { nom: string };
};

/**
 * Ce que les formateurs ont déclenché, du plus récent au plus ancien — même
 * frise que les journaux de la Console staff.
 */
export function JournalConsoleFormateur({ lignes }: { lignes: LigneJournalFormateur[] }) {
  return (
    <ol className="flex flex-col gap-5 border-l-2 border-[var(--color-line)] pl-5">
      {lignes.map((ligne) => (
        <li key={ligne.id} className="relative">
          <span
            aria-hidden
            className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--color-line-strong)]"
          />
          <p className="text-[15px] text-[var(--color-ink)]">{ligne.resume}</p>
          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
            {formaterJourEtHeure(ligne.createdAt)} · {ligne.formateur.nom}
          </p>
        </li>
      ))}
    </ol>
  );
}

import {
  decrireEvenementDemande,
  type EvenementDemandeAvecAuteur,
} from "@/lib/evenements-demande";

/**
 * Le journal d'une demande de contact restaurateur, du plus récent au plus
 * ancien — même frise que `JournalDossier`, un seul type d'événement visible
 * ici : tout ce que le staff a fait sur la demande, plus son dépôt.
 */
export function JournalDemande({ evenements }: { evenements: EvenementDemandeAvecAuteur[] }) {
  return (
    <ol className="flex flex-col gap-5 border-l-2 border-[var(--color-line)] pl-5">
      {evenements.map((evenement) => {
        const ligne = decrireEvenementDemande(evenement);
        return (
          <li key={evenement.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--color-line-strong)]"
            />
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-[var(--color-ink)]">{ligne.titre}</span>
              <span className="text-xs text-[var(--color-ink-muted)]">
                {ligne.horodatage} · {ligne.auteur}
              </span>
            </p>
            {ligne.detail && (
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                {ligne.detail}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

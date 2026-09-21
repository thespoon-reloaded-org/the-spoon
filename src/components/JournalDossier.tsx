import { decrireEvenement, type EvenementAvecAuteur } from "@/lib/evenements-dossier";

/**
 * Le journal d'un dossier de contestation, du plus ancien au plus récent —
 * même frise des deux côtés, seul son contenu change : le partenaire ne reçoit
 * que les événements qui le concernent (voir `decrireEvenement` et le drapeau
 * `interne` sur `EvenementDossier`), et c'est à l'appelant de les filtrer.
 */
export function JournalDossier({
  evenements,
  pourLePartenaire = false,
}: {
  evenements: EvenementAvecAuteur[];
  pourLePartenaire?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-5 border-l-2 border-[var(--color-line)] pl-5">
      {evenements.map((evenement) => {
        const ligne = decrireEvenement(evenement, { pourLePartenaire });
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

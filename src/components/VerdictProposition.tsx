import { IconeCoeur, IconeCoeurBrise } from "@/components/Icones";
import type { VerdictProposition as Verdict } from "@/generated/prisma";

/**
 * Le vote d'un dîneur sur une proposition de l'assistant, tel que le staff le
 * lit dans la console : le même cœur que côté dîneur, plus un mot — une
 * icône seule ne se lit pas dans un tableau.
 */
export function VerdictProposition({ verdict }: { verdict: Verdict | null }) {
  if (verdict === "AIME") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)]">
        <IconeCoeur pleine taille={16} />
        Aimée
      </span>
    );
  }
  if (verdict === "AIME_PAS") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]">
        <IconeCoeurBrise pleine taille={16} />
        Pas aimée
      </span>
    );
  }
  return <span className="text-sm text-[var(--color-ink-muted)]">Sans avis</span>;
}

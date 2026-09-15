/**
 * La note d'un restaurant, en cuillères plutôt qu'en étoiles — signature de
 * TheSpoon.
 *
 * Les cuillères sont dessinées plutôt qu'écrites en emoji : 🥄 ne se colore
 * pas, ne s'aligne pas sur la ligne de base du texte et change de dessin d'un
 * système à l'autre. Une cuillère pleine est remplie de la couleur courante,
 * une cuillère manquante n'est que son contour — l'écart se voit, ce qui
 * n'était pas le cas avec deux emojis identiques différenciés par l'opacité.
 */

const TAILLES = {
  petit: { cuillere: 14, texte: "text-[13px]" },
  moyen: { cuillere: 17, texte: "text-sm" },
  grand: { cuillere: 21, texte: "text-[15px]" },
} as const;

function Cuillere({ pleine, taille }: { pleine: boolean; taille: number }) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill={pleine ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={pleine ? undefined : "opacity-35"}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="7.2" rx="4.2" ry="5" />
      <path d="M12 12.2V21" />
    </svg>
  );
}

export function NoteCuilleres({
  note,
  nombreAvis,
  taille = "moyen",
  ton = "clair",
}: {
  note: number | null;
  /**
   * Nombre d'avis agrégés derrière la note. Omis pour la note d'un avis
   * isolé : afficher « (1) » à côté d'une note individuelle se lit comme un
   * compteur d'avis, alors que c'est l'avis lui-même qu'on regarde.
   */
  nombreAvis?: number;
  taille?: keyof typeof TAILLES;
  /** `sombre` : posé sur un fond foncé (hero d'une fiche, panneau de connexion). */
  ton?: "clair" | "sombre";
}) {
  const { cuillere, texte } = TAILLES[taille];
  const couleurTexte = ton === "sombre" ? "text-white/70" : "text-[var(--color-ink-muted)]";

  if (note === null || nombreAvis === 0) {
    return <span className={`${texte} ${couleurTexte}`}>Pas encore d&apos;avis</span>;
  }

  const pleines = Math.round(note);

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${texte}`}
      aria-label={
        nombreAvis === undefined
          ? `${note.toFixed(1)} sur 5 cuillères`
          : `${note.toFixed(1)} sur 5 cuillères, ${nombreAvis} avis`
      }
    >
      <span
        className={`inline-flex items-center gap-0.5 ${
          ton === "sombre" ? "text-[var(--color-yellow)]" : "text-[var(--color-accent)]"
        }`}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Cuillere key={i} pleine={i < pleines} taille={cuillere} />
        ))}
      </span>
      <span className={`font-semibold ${ton === "sombre" ? "text-white" : "text-[var(--color-ink)]"}`}>
        {note.toFixed(1)}
      </span>
      {nombreAvis !== undefined && <span className={couleurTexte}>({nombreAvis})</span>}
    </span>
  );
}

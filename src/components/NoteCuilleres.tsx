const CUILLERE_PLEINE = "🥄";
const CUILLERE_VIDE = "🥄";

/** La note d'un restaurant, en cuillères plutôt qu'en étoiles — signature de TheSpoon. */
export function NoteCuilleres({ note, nombreAvis }: { note: number | null; nombreAvis: number }) {
  if (note === null || nombreAvis === 0) {
    return <span className="text-sm text-[var(--color-ink-muted)]">Pas encore d&apos;avis</span>;
  }

  const pleines = Math.round(note);

  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden style={{ opacity: 1 }}>
        {CUILLERE_PLEINE.repeat(pleines)}
        <span className="opacity-25">{CUILLERE_VIDE.repeat(Math.max(0, 5 - pleines))}</span>
      </span>
      <span className="text-[var(--color-ink-muted)]">
        {note.toFixed(1)} ({nombreAvis})
      </span>
    </span>
  );
}

import { IconeValide } from "@/components/Icones";

/**
 * Retour d'un formulaire après soumission.
 *
 * Les quatre formulaires de l'app annonçaient leur résultat chacun à sa
 * façon — `text-red-600`, `text-green-700`, `text-amber-700` écrits en dur,
 * sans rôle ARIA : un lecteur d'écran ne signalait ni l'échec ni le succès.
 * Un seul composant ici, avec le bon `role` selon la nature du message.
 *
 * Le conteneur est toujours dans le DOM, vide tant qu'il n'y a rien à dire :
 * une région live insérée en même temps que son contenu n'est pas annoncée de
 * façon fiable (le lecteur d'écran doit l'observer *avant* qu'elle change).
 * D'où `message` en propriété plutôt qu'en `children` conditionnels, et le
 * rendu systématique.
 */
const STYLES = {
  succes: {
    conteneur: "bg-[var(--color-success-tint)] text-[var(--color-success)]",
    role: "status" as const,
  },
  erreur: {
    conteneur: "bg-[var(--color-danger-tint)] text-[var(--color-danger)]",
    role: "alert" as const,
  },
  avertissement: {
    conteneur: "bg-[var(--color-warning-tint)] text-[var(--color-warning)]",
    role: "status" as const,
  },
} as const;

export function MessageFormulaire({
  type,
  message,
}: {
  type: keyof typeof STYLES;
  /** `null` / `undefined` : la région reste présente mais vide et invisible. */
  message: React.ReactNode;
}) {
  const { conteneur, role } = STYLES[type];
  const vide = message === null || message === undefined || message === false;

  return (
    <p
      role={role}
      className={
        vide
          ? "sr-only"
          : `flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ${conteneur}`
      }
    >
      {!vide && type === "succes" && <IconeValide taille={16} />}
      {message}
    </p>
  );
}

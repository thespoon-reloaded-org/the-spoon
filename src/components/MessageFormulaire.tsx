import { IconeValide } from "@/components/Icones";

/**
 * Retour d'un formulaire après soumission.
 *
 * Les quatre formulaires de l'app annonçaient leur résultat chacun à sa
 * façon — `text-red-600`, `text-green-700`, `text-amber-700` écrits en dur,
 * sans rôle ARIA : un lecteur d'écran ne signalait ni l'échec ni le succès.
 * Un seul composant ici, avec le bon `role` selon la nature du message.
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
  children,
}: {
  type: keyof typeof STYLES;
  children: React.ReactNode;
}) {
  const { conteneur, role } = STYLES[type];
  return (
    <p
      role={role}
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium ${conteneur}`}
    >
      {type === "succes" && <IconeValide taille={16} />}
      {children}
    </p>
  );
}

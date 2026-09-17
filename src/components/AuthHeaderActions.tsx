"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconeCalendrier, IconeDeconnexion } from "@/components/Icones";
import { authClient } from "@/lib/auth-client";

const LIEN_DISCRET =
  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-line)]";

/** Première lettre du prénom — un avatar sans photo, mais qui identifie. */
function initiale(nom: string): string {
  return (nom.trim()[0] ?? "?").toUpperCase();
}

/** Bascule Connexion / session active — remplace le bouton statique du header. */
export function AuthHeaderActions() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  // Pendant la résolution de session, un espace réservé de la bonne taille :
  // renvoyer `null` faisait sauter le header au chargement de chaque page.
  if (isPending) {
    return (
      <span
        aria-hidden
        className="block h-10 w-24 rounded-full bg-[var(--color-line)]"
      />
    );
  }

  if (!session) {
    return (
      <Link
        href="/connexion"
        className="rounded-full border-[1.5px] border-[var(--color-ink)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-cream)] sm:px-5"
      >
        Connexion
      </Link>
    );
  }

  async function seDeconnecter() {
    setDeconnexionEnCours(true);
    try {
      await authClient.signOut();
      router.refresh();
    } finally {
      setDeconnexionEnCours(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Link href="/mes-reservations" className={LIEN_DISCRET}>
        <IconeCalendrier taille={17} />
        <span className="hidden sm:inline">Mes réservations</span>
      </Link>

      <span className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 sm:pr-3">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] font-[family-name:var(--font-display)] text-sm font-bold text-white"
        >
          {initiale(session.user.name)}
        </span>
        <span className="hidden text-sm font-semibold text-[var(--color-ink)] lg:inline">
          {session.user.name}
        </span>
      </span>

      <button
        type="button"
        onClick={seDeconnecter}
        disabled={deconnexionEnCours}
        title="Se déconnecter"
        className={`${LIEN_DISCRET} disabled:opacity-60`}
      >
        <IconeDeconnexion taille={17} />
        <span className="sr-only">Se déconnecter</span>
      </button>
    </div>
  );
}

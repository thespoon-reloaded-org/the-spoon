"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

const BOUTON_PILL =
  "rounded-full border-[1.5px] border-[var(--color-ink)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)]";

/** Bascule Connexion / session active — remplace le bouton statique du header. */
export function AuthHeaderActions() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  if (isPending) return null;

  if (!session) {
    return (
      <Link href="/connexion" className={BOUTON_PILL}>
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
    <div className="flex items-center gap-3">
      <Link href="/mes-reservations" className="text-sm font-medium text-[var(--color-ink)] hover:underline">
        Mes réservations
      </Link>
      <span className="text-sm font-medium text-[var(--color-ink)]">
        Bonjour {session.user.name}
      </span>
      <button
        type="button"
        onClick={seDeconnecter}
        disabled={deconnexionEnCours}
        className={`${BOUTON_PILL} disabled:opacity-60`}
      >
        Se déconnecter
      </button>
    </div>
  );
}

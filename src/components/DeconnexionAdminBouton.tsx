"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authAdminClient } from "@/lib/auth-admin-client";

/** Déconnexion du staff connecté — session `Staff`, distincte de celle des dîneurs et des contacts restaurant. */
export function DeconnexionAdminBouton() {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  async function seDeconnecter() {
    setEnCours(true);
    try {
      await authAdminClient.signOut();
      router.push("/connexion-admin");
      router.refresh();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <button
      type="button"
      onClick={seDeconnecter}
      disabled={enCours}
      className="rounded-full border-[1.5px] border-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] disabled:opacity-60"
    >
      Se déconnecter
    </button>
  );
}

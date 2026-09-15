"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconeDeconnexion } from "@/components/Icones";
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
      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold text-[var(--color-cream)] transition-colors hover:bg-white/10 disabled:opacity-60"
    >
      <IconeDeconnexion taille={17} />
      Se déconnecter
    </button>
  );
}

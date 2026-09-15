"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconeDeconnexion } from "@/components/Icones";
import { authRestaurantClient } from "@/lib/auth-restaurant-client";

/** Déconnexion du contact restaurant connecté — session `RestaurantContact`, distincte de celle des dîneurs. */
export function DeconnexionRestaurantBouton() {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);

  async function seDeconnecter() {
    setEnCours(true);
    try {
      await authRestaurantClient.signOut();
      router.push("/connexion-restaurant");
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

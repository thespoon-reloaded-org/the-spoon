"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      className="rounded-full border-[1.5px] border-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] disabled:opacity-60"
    >
      Se déconnecter
    </button>
  );
}

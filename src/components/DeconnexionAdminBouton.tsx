"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authAdminClient } from "@/lib/auth-admin-client";
import { BOUTON_SECONDAIRE } from "@/lib/ui";

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
      className={BOUTON_SECONDAIRE}
    >
      Se déconnecter
    </button>
  );
}

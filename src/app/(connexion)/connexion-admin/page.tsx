"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EcranConnexion } from "@/components/EcranConnexion";
import {
  BoutonConnexion,
  ChampConnexion,
  ErreurConnexion,
} from "@/components/FormulaireConnexion";
import { authAdminClient } from "@/lib/auth-admin-client";
import { UNIVERS } from "@/lib/univers";

const UNIVERS_STAFF = UNIVERS.staff;

/**
 * Connexion du staff TheSpoon — pas d'inscription ici, les comptes sont
 * créés côté TheSpoon (cf. seed-dev.ts). Instance better-auth séparée de
 * celle des dîneurs et des contacts restaurant : ce formulaire pose une
 * session `Staff`, pas une session `User` ni `RestaurantContact`.
 */
export default function ConnexionAdminPage() {
  const router = useRouter();
  const { data: session, isPending: sessionEnCoursDeChargement } = authAdminClient.useSession();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (session) router.replace("/admin");
  }, [session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      const { data, error } = await authAdminClient.signIn.email({
        email,
        password: motDePasse,
      });

      if (error || !data) {
        setErreur("Email ou mot de passe incorrect.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur — vérifie ta connexion et réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  if (sessionEnCoursDeChargement || session) return null;

  return (
    <EcranConnexion univers={UNIVERS_STAFF}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ChampConnexion
          libelle="Email TheSpoon"
          univers={UNIVERS_STAFF}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <ChampConnexion
          libelle="Mot de passe"
          univers={UNIVERS_STAFF}
          type="password"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />

        {erreur && <ErreurConnexion message={erreur} />}

        <BoutonConnexion univers={UNIVERS_STAFF} enCours={enCours}>
          Ouvrir la console
        </BoutonConnexion>
      </form>
    </EcranConnexion>
  );
}

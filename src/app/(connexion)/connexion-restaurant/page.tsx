"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EcranConnexion } from "@/components/EcranConnexion";
import {
  BoutonConnexion,
  ChampConnexion,
  ErreurConnexion,
} from "@/components/FormulaireConnexion";
import { authRestaurantClient } from "@/lib/auth-restaurant-client";
import { UNIVERS } from "@/lib/univers";

const UNIVERS_RESTAURANT = UNIVERS.restaurant;

/**
 * Connexion des contacts restaurant (gérant / chef de salle) — pas
 * d'inscription ici, les comptes sont créés côté TheSpoon (cf. seed-dev.ts).
 * Instance better-auth séparée de celle des dîneurs : ce formulaire pose une
 * session `RestaurantContact`, pas une session `User`.
 */
export default function ConnexionRestaurantPage() {
  const router = useRouter();
  const { data: session, isPending: sessionEnCoursDeChargement } =
    authRestaurantClient.useSession();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (session) router.replace("/espace-restaurant");
  }, [session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      const { data, error } = await authRestaurantClient.signIn.email({
        email,
        password: motDePasse,
      });

      if (error || !data) {
        setErreur("Email ou mot de passe incorrect.");
        return;
      }

      router.push("/espace-restaurant");
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur — vérifie ta connexion et réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  if (sessionEnCoursDeChargement || session) return null;

  return (
    <EcranConnexion
      univers={UNIVERS_RESTAURANT}
      pied={
        <p>
          Pas encore partenaire ? Les comptes sont ouverts par TheSpoon lors du référencement de
          votre établissement — il n&apos;y a pas d&apos;inscription en ligne.
        </p>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ChampConnexion
          libelle="Email professionnel"
          univers={UNIVERS_RESTAURANT}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <ChampConnexion
          libelle="Mot de passe"
          univers={UNIVERS_RESTAURANT}
          type="password"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />

        {erreur && <ErreurConnexion message={erreur} />}

        <BoutonConnexion univers={UNIVERS_RESTAURANT} enCours={enCours}>
          Ouvrir mon espace
        </BoutonConnexion>
      </form>
    </EcranConnexion>
  );
}

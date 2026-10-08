"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EcranConnexion } from "@/components/EcranConnexion";
import { BoutonConnexion, ChampConnexion, ErreurConnexion } from "@/components/FormulaireConnexion";
import { authFormateurClient } from "@/lib/auth-formateur-client";
import { UNIVERS } from "@/lib/univers";

const UNIVERS_FORMATEUR = UNIVERS.formateur;

/**
 * Connexion des formateurs Hymaia — pas d'inscription ici, les comptes sont
 * créés avec `pnpm creer-compte`, réservés aux adresses @hymaia.com. Pose une
 * session `Formateur`, distincte de celle du staff : un formateur n'ouvre pas
 * la Console staff, et l'inverse.
 */
export default function ConnexionFormateurPage() {
  const router = useRouter();
  const { data: session, isPending: sessionEnCoursDeChargement } = authFormateurClient.useSession();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (session) router.replace("/formateur");
  }, [session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      const { data, error } = await authFormateurClient.signIn.email({
        email,
        password: motDePasse,
      });

      if (error || !data) {
        setErreur("Email ou mot de passe incorrect.");
        return;
      }

      router.push("/formateur");
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
      univers={UNIVERS_FORMATEUR}
      pied="Réservé aux adresses @hymaia.com. Pas de compte ? Demandez-le à l'équipe Hymaia."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ChampConnexion
          libelle="Email Hymaia"
          univers={UNIVERS_FORMATEUR}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <ChampConnexion
          libelle="Mot de passe"
          univers={UNIVERS_FORMATEUR}
          type="password"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />

        {erreur && <ErreurConnexion message={erreur} />}

        <BoutonConnexion univers={UNIVERS_FORMATEUR} enCours={enCours}>
          Ouvrir la console
        </BoutonConnexion>
      </form>
    </EcranConnexion>
  );
}

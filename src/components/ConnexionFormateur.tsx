"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { EcranConnexion } from "@/components/EcranConnexion";
import { BoutonConnexion, ChampConnexion, ErreurConnexion } from "@/components/FormulaireConnexion";
import { authFormateurClient } from "@/lib/auth-formateur-client";
import { UNIVERS } from "@/lib/univers";

const UNIVERS_FORMATEUR = UNIVERS.formateur;

/**
 * Connexion des formateurs Hymaia : avec Google d'abord, limité au Workspace
 * hymaia.com — le compte se crée à la première connexion. Le mot de passe
 * reste pour les comptes créés avec `pnpm creer-compte` (développement local,
 * secours). Pose une session `Formateur`, distincte de celle du staff : un
 * formateur n'ouvre pas la Console staff, et l'inverse.
 */
export function ConnexionFormateur({
  googleDisponible,
  erreurGoogle,
}: {
  googleDisponible: boolean;
  /** Message à afficher quand Google a renvoyé ici après un échec. */
  erreurGoogle: string | null;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionEnCoursDeChargement } = authFormateurClient.useSession();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurAvecGoogle, setErreurAvecGoogle] = useState<string | null>(erreurGoogle);
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

  async function avecGoogle() {
    setErreurAvecGoogle(null);
    setEnCours(true);
    // Adresses absolues : sur une Deploy Preview, Google revient par la
    // production (voir `oAuthProxy` dans src/lib/auth.ts), qui doit savoir
    // vers quelle preview renvoyer.
    const { error } = await authFormateurClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/formateur`,
      errorCallbackURL: `${window.location.origin}/connexion-formateur`,
    });
    // Sans erreur, le navigateur part déjà chez Google : le bouton reste inactif.
    if (error) {
      setErreurAvecGoogle("Impossible de joindre Google — réessaie dans un instant.");
      setEnCours(false);
    }
  }

  if (sessionEnCoursDeChargement || session) return null;

  return (
    <EcranConnexion
      univers={UNIVERS_FORMATEUR}
      pied={
        googleDisponible
          ? "Réservé aux comptes Google @hymaia.com : le vôtre suffit, le compte se crée à la première connexion."
          : "Réservé aux adresses @hymaia.com. Pas de compte ? Demandez-le à l'équipe Hymaia."
      }
    >
      {googleDisponible && (
        <>
          {erreurAvecGoogle && (
            <div className="mb-4">
              <ErreurConnexion message={erreurAvecGoogle} />
            </div>
          )}
          <button
            type="button"
            onClick={avecGoogle}
            disabled={enCours}
            className="w-full rounded-full px-6 py-3.5 font-[family-name:var(--font-display)] text-[15px] font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: UNIVERS_FORMATEUR.accent, color: UNIVERS_FORMATEUR.surAccent }}
          >
            Continuer avec Google
          </button>
          <p
            className="my-6 flex items-center gap-3 text-xs before:h-px before:flex-1 before:bg-black/10 after:h-px after:flex-1 after:bg-black/10"
            style={{ color: UNIVERS_FORMATEUR.encreDouce }}
          >
            ou avec un mot de passe
          </p>
        </>
      )}

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

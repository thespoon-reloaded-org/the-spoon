"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { EcranConnexion } from "@/components/EcranConnexion";
import {
  BoutonConnexion,
  ChampConnexion,
  ErreurConnexion,
} from "@/components/FormulaireConnexion";
import { authClient } from "@/lib/auth-client";
import { cheminRetour } from "@/lib/retour";
import { UNIVERS } from "@/lib/univers";

type Mode = "connexion" | "inscription";

const MODES: { value: Mode; label: string }[] = [
  { value: "connexion", label: "Se connecter" },
  { value: "inscription", label: "Créer un compte" },
];

const UNIVERS_CLIENT = UNIVERS.client;

export default function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string | string[] }>;
}) {
  const router = useRouter();
  // D'où vient le dîneur : une fiche restaurant avec sa réservation en cours,
  // le plus souvent. On l'y ramène plutôt que sur l'accueil — sinon il perd
  // sa sélection et recommence tout.
  const retour = cheminRetour(use(searchParams).retour) ?? "/";
  const { data: session, isPending: sessionEnCoursDeChargement } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("connexion");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Un dîneur déjà connecté n'a rien à faire sur ce formulaire.
  useEffect(() => {
    if (session) router.replace(retour);
  }, [session, retour, router]);

  function changerDeMode(nouveauMode: Mode) {
    setMode(nouveauMode);
    setErreur(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);

    try {
      const { error } =
        mode === "connexion"
          ? await authClient.signIn.email({ email, password: motDePasse })
          : await authClient.signUp.email({ email, password: motDePasse, name: nom });

      if (error) {
        setErreur(error.message ?? "Une erreur est survenue.");
        return;
      }

      router.push(retour);
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur — vérifie ta connexion et réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  if (sessionEnCoursDeChargement || session) return null;

  return (
    <EcranConnexion univers={UNIVERS_CLIENT}>
      <div className="flex gap-1 rounded-full bg-black/5 p-1 text-sm font-semibold">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => changerDeMode(value)}
            aria-pressed={mode === value}
            className="flex-1 rounded-full px-4 py-2 transition-colors"
            style={
              mode === value
                ? { background: "#ffffff", color: "var(--color-ink)" }
                : { color: UNIVERS_CLIENT.encreDouce }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
        {mode === "inscription" && (
          <ChampConnexion
            libelle="Nom"
            univers={UNIVERS_CLIENT}
            type="text"
            autoComplete="name"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        )}

        <ChampConnexion
          libelle="Email"
          univers={UNIVERS_CLIENT}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <ChampConnexion
          libelle="Mot de passe"
          univers={UNIVERS_CLIENT}
          type="password"
          autoComplete={mode === "connexion" ? "current-password" : "new-password"}
          required
          minLength={8}
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />
        {mode === "inscription" && (
          <p className="-mt-2 text-xs" style={{ color: UNIVERS_CLIENT.encreDouce }}>
            Huit caractères minimum.
          </p>
        )}

        {erreur && <ErreurConnexion message={erreur} />}

        <BoutonConnexion univers={UNIVERS_CLIENT} enCours={enCours}>
          {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
        </BoutonConnexion>
      </form>
    </EcranConnexion>
  );
}

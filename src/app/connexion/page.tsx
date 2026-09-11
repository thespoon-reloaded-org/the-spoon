"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

type Mode = "connexion" | "inscription";

const MODES: { value: Mode; label: string }[] = [
  { value: "connexion", label: "Se connecter" },
  { value: "inscription", label: "Créer un compte" },
];

export default function ConnexionPage() {
  const router = useRouter();
  const { data: session, isPending: sessionEnCoursDeChargement } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("connexion");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Un dîneur déjà connecté n'a rien à faire sur ce formulaire.
  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

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

      router.push("/");
      router.refresh();
    } catch {
      setErreur("Impossible de contacter le serveur — vérifie ta connexion et réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  if (sessionEnCoursDeChargement || session) return null;

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:underline">
        ← Retour à la recherche
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">
        {mode === "connexion" ? "Connexion" : "Créer un compte"}
      </h1>

      <div className="mt-4 flex gap-2 text-sm font-semibold">
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => changerDeMode(value)}
            className={`rounded-full px-4 py-2 ${
              mode === value ? "bg-[var(--color-ink)] text-[var(--color-cream)]" : "text-[var(--color-ink-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {mode === "inscription" && (
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--color-ink)]">
            Nom
            <input
              type="text"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="rounded-xl border border-[var(--color-line)] px-3 py-2 outline-none"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--color-ink)]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2 outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--color-ink)]">
          Mot de passe
          <input
            type="password"
            required
            minLength={8}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2 outline-none"
          />
        </label>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={enCours}
          className="mt-2 rounded-full bg-[var(--color-ink)] px-7 py-3 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] disabled:opacity-60"
        >
          {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authRestaurantClient } from "@/lib/auth-restaurant-client";

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
    if (session) router.replace(`/restaurants/${session.user.restaurantId}/reservations`);
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

      router.push(`/restaurants/${data.user.restaurantId}/reservations`);
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

      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">Espace restaurant</h1>
      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
        Réservé aux contacts des restaurants partenaires TheSpoon.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
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
          Se connecter
        </button>
      </form>
    </main>
  );
}

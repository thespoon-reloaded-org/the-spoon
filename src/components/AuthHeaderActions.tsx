"use client";

import Link from "next/link";

import { authClient } from "@/lib/auth-client";

/** Bascule Connexion / session active — remplace le bouton statique du header. */
export function AuthHeaderActions() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!session) {
    return (
      <Link
        href="/connexion"
        className="rounded-full border-[1.5px] border-[var(--color-ink)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)]"
      >
        Connexion
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-[var(--color-ink)]">
        Bonjour {session.user.name}
      </span>
      <button
        type="button"
        onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => location.reload() } })}
        className="rounded-full border-[1.5px] border-[var(--color-ink)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)]"
      >
        Se déconnecter
      </button>
    </div>
  );
}

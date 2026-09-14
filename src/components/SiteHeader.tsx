import Link from "next/link";

import { AuthHeaderActions } from "@/components/AuthHeaderActions";

/** Header partagé par toutes les pages, pour que l'état de connexion soit visible partout. */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between px-8 py-5 md:px-14">
      <Link href="/" className="flex items-center gap-2">
        <span className="h-[30px] w-[30px] rounded-[50%_50%_50%_4px] bg-[var(--color-accent)]" />
        <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--color-ink)]">
          TheSpoon
        </span>
      </Link>
      <div className="hidden items-center gap-2 md:flex">
        <AuthHeaderActions />
        {/* Pointe vers la connexion restaurant — pas d'inscription en ligne pour
            l'instant, un contact existant se connecte, un nouveau partenaire
            reste onboardé côté TheSpoon (cf. "Auth restaurant partenaire"). */}
        <Link
          href="/connexion-restaurant"
          className="rounded-full bg-[var(--color-ink)] px-5 py-2.5 text-sm font-semibold text-[var(--color-cream)]"
        >
          Ajouter mon resto
        </Link>
      </div>
    </header>
  );
}

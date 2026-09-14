"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ONGLETS = [
  { href: "/espace-restaurant/reservations", label: "Réservations reçues" },
  { href: "/espace-restaurant/fiche", label: "Ma fiche établissement" },
  { href: "/espace-restaurant/disponibilites", label: "Mes disponibilités" },
] as const;

const ONGLET_INACTIF =
  "rounded-full px-4 py-2 text-sm font-semibold text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]";
const ONGLET_ACTIF =
  "rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-cream)]";

/** Onglet actif mis en avant — nécessite le chemin courant, donc un client component. */
export function EspaceRestaurantNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {ONGLETS.map((onglet) => (
        <Link
          key={onglet.href}
          href={onglet.href}
          className={pathname.startsWith(onglet.href) ? ONGLET_ACTIF : ONGLET_INACTIF}
        >
          {onglet.label}
        </Link>
      ))}
    </nav>
  );
}

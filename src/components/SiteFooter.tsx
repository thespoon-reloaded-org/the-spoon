import Link from "next/link";

import { IconeFleche } from "@/components/Icones";
import { LogoTheSpoon } from "@/components/LogoTheSpoon";

/**
 * Pied de page du site public.
 *
 * Il remplace l'ancien bloc « inscris-toi à la newsletter », dont le champ
 * e-mail et le bouton étaient deux `<span>` : rien n'était cliquable et rien
 * n'était envoyé nulle part. Promettre un service inexistant coûte plus cher
 * que ne pas le proposer — on ne garde ici que des liens qui mènent vraiment
 * quelque part.
 */
export function SiteFooter() {
  return (
    <footer className="mt-14 bg-[var(--color-ink)] text-[var(--color-cream)] md:mt-20">
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <LogoTheSpoon ton="sombre" />
            <p className="mt-4 text-[15px] leading-relaxed text-[#b9afb3]">
              Le resto parfait, sans scroller pendant vingt minutes. Réserve en deux tapes, note en
              cuillères.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <nav aria-label="Dîneurs" className="flex flex-col gap-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#8a7f85]">
                Dîneurs
              </p>
              <Link href="/" className="text-sm text-[#e3d9dc] hover:text-white hover:underline">
                Rechercher un restaurant
              </Link>
              <Link
                href="/mes-reservations"
                className="text-sm text-[#e3d9dc] hover:text-white hover:underline"
              >
                Mes réservations
              </Link>
              <Link
                href="/connexion"
                className="text-sm text-[#e3d9dc] hover:text-white hover:underline"
              >
                Créer un compte
              </Link>
            </nav>

            <nav aria-label="Restaurateurs" className="flex flex-col gap-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#8a7f85]">
                Restaurateurs
              </p>
              <Link
                href="/connexion-restaurant"
                className="text-sm text-[#e3d9dc] hover:text-white hover:underline"
              >
                Espace restaurateur
              </Link>
              <Link
                href="/espace-restaurant/reservations"
                className="text-sm text-[#e3d9dc] hover:text-white hover:underline"
              >
                Réservations reçues
              </Link>
              <Link
                href="/espace-restaurant/factures"
                className="text-sm text-[#e3d9dc] hover:text-white hover:underline"
              >
                Mes factures
              </Link>
            </nav>

            <nav aria-label="TheSpoon" className="flex flex-col gap-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#8a7f85]">
                TheSpoon
              </p>
              <Link
                href="/connexion-admin"
                className="text-sm text-[#e3d9dc] hover:text-white hover:underline"
              >
                Console staff
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#8a7f85]">
            © {new Date().getFullYear()} TheSpoon — la note s&apos;affiche en cuillères.
          </p>
          <Link
            href="/connexion-restaurant"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-yellow)] hover:underline"
          >
            Référencer mon restaurant
            <IconeFleche taille={16} />
          </Link>
        </div>
      </div>
    </footer>
  );
}

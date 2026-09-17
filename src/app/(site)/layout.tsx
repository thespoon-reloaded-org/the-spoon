import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Cadre du site public (recherche, fiche établissement, mes réservations) :
 * header collant + pied de page. Les écrans de connexion et les espaces
 * connectés ont leur propre cadre, d'où le groupe de routes.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

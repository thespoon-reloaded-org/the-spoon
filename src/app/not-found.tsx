import { PageIntrouvable } from "@/components/PageIntrouvable";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * 404 de toute l'application : c'est le `not-found` **racine** qui traite les
 * URLs ne correspondant à aucune route (voir
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`),
 * pas celui d'un groupe de routes. Il est rendu dans le layout racine, qui ne
 * pose plus d'en-tête depuis que chaque univers pose le sien : on remet ici le
 * cadre public, faute de quoi l'écran n'offre aucun moyen de revenir.
 */
export default function NonTrouve() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        <PageIntrouvable />
      </div>
      <SiteFooter />
    </div>
  );
}

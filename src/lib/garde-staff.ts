import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authAdmin } from "@/lib/auth";

/**
 * Session staff, ou redirection vers la connexion.
 *
 * À appeler dans **chaque** page de `/admin`, et pas seulement dans le layout.
 * Un layout n'est pas une frontière d'autorisation sous Next.js, pour deux
 * raisons documentées (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) :
 *
 * - il n'est pas ré-exécuté lors d'une navigation côté client (rendu partiel),
 *   donc une session expirée en cours de route n'est jamais revérifiée ;
 * - il ne décide pas du rendu des segments qu'il encadre : ceux-ci s'exécutent
 *   et repartent dans la charge RSC même si le layout redirige.
 *
 * Le layout garde malgré tout son propre appel — il lui faut le nom affiché
 * dans la barre latérale, et la redirection sur une requête directe reste utile.
 */
export async function exigerSessionStaff() {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");
  return session;
}

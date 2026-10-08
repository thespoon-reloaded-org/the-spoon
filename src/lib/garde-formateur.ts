import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { authFormateur } from "@/lib/auth";
import { estEmailFormateur } from "@/lib/formateurs";

/**
 * Session formateur, ou redirection vers la connexion.
 *
 * À appeler dans **chaque** page et chaque action de `/formateur`, pas
 * seulement dans le layout — même raison que `exigerSessionStaff`
 * (src/lib/garde-staff.ts).
 *
 * Le domaine est revérifié ici alors que la connexion le refuse déjà : une
 * adresse corrigée en base après coup laisserait sinon vivre une session
 * ouverte avant. Pas de redirection dans ce cas — l'écran de connexion
 * renverrait aussitôt vers la console, puisqu'une session existe.
 */
export async function exigerSessionFormateur() {
  const session = await authFormateur.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-formateur");
  if (!estEmailFormateur(session.user.email)) notFound();
  return session;
}

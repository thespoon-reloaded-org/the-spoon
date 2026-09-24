import { deposerDossier } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaDossier } from "@/lib/api-admin/schemas";

/**
 * Un dossier à la fois, pas de liste : le dépôt dépend de ce qui a déjà été
 * contesté sur la facture (cumul, seuil de crédit d'office), l'ordre compte.
 */
export const POST = routeAdmin(async (requete) => {
  const saisie = await lireCorps(requete, schemaDossier);
  return repondre({ cree: await deposerDossier(saisie) }, 201);
});

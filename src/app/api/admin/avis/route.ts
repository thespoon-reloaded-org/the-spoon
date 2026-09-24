import { creerAvis } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaAvis, unOuPlusieurs } from "@/lib/api-admin/schemas";

export const POST = routeAdmin(async (requete) => {
  const saisies = await lireCorps(requete, unOuPlusieurs(schemaAvis, 1000));
  return repondre(await creerAvis(saisies), 201);
});

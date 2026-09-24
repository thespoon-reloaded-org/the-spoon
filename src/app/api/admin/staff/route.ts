import { creerStaff } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaStaff, unOuPlusieurs } from "@/lib/api-admin/schemas";

export const POST = routeAdmin(async (requete) => {
  const saisies = await lireCorps(requete, unOuPlusieurs(schemaStaff, 20));
  return repondre({ crees: await creerStaff(saisies) }, 201);
});

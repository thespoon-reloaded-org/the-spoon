import { creerReservations } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaReservation, unOuPlusieurs } from "@/lib/api-admin/schemas";

export const POST = routeAdmin(async (requete) => {
  const saisies = await lireCorps(requete, unOuPlusieurs(schemaReservation, 1000));
  return repondre({ crees: await creerReservations(saisies) }, 201);
});

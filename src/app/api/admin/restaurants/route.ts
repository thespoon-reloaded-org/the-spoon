import { creerRestaurants } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaRestaurant, unOuPlusieurs } from "@/lib/api-admin/schemas";
import { prisma } from "@/lib/prisma";

export const GET = routeAdmin(async () => {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: [{ ville: "asc" }, { nom: "asc" }],
    select: {
      id: true,
      nom: true,
      ville: true,
      cuisine: true,
      capacite: true,
      contacts: { select: { id: true, nom: true, email: true, role: true } },
    },
  });
  return repondre({ restaurants });
});

export const POST = routeAdmin(async (requete, { staffId }) => {
  const saisies = await lireCorps(requete, unOuPlusieurs(schemaRestaurant, 20));
  return repondre({ crees: await creerRestaurants(saisies, staffId) }, 201);
});

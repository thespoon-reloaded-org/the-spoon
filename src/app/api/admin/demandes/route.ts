import { creerDemandesReferencement } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaDemandeReferencement, unOuPlusieurs } from "@/lib/api-admin/schemas";
import { prisma } from "@/lib/prisma";

export const GET = routeAdmin(async () => {
  const demandes = await prisma.demandeContactRestaurateur.findMany({
    orderBy: { createdAt: "desc" },
  });
  return repondre({ demandes });
});

export const POST = routeAdmin(async (requete) => {
  const saisies = await lireCorps(requete, unOuPlusieurs(schemaDemandeReferencement, 50));
  return repondre({ crees: await creerDemandesReferencement(saisies) }, 201);
});

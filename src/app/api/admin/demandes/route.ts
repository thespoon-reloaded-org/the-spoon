import { creerDemandesReferencement } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaDemandeReferencement, unOuPlusieurs } from "@/lib/api-admin/schemas";
import { StatutDemande } from "@/generated/prisma";
import { ErreurApi } from "@/lib/api-admin/erreurs";
import { prisma } from "@/lib/prisma";

/** `?statut=A_ANALYSER` : seulement les demandes de ce statut. */
export const GET = routeAdmin(async (requete) => {
  const statut = new URL(requete.url).searchParams.get("statut");
  if (statut !== null && !(statut in StatutDemande))
    throw new ErreurApi(400, "Statut inconnu.", { valeurs: Object.keys(StatutDemande) });
  const demandes = await prisma.demandeContactRestaurateur.findMany({
    where: statut ? { statut: statut as StatutDemande } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return repondre({ demandes });
});

export const POST = routeAdmin(async (requete) => {
  const saisies = await lireCorps(requete, unOuPlusieurs(schemaDemandeReferencement, 50));
  return repondre({ crees: await creerDemandesReferencement(saisies) }, 201);
});

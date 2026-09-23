import { ajouterContacts } from "@/lib/api-admin/creations";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaContact, unOuPlusieurs } from "@/lib/api-admin/schemas";

export const POST = routeAdmin<{ params: Promise<{ id: string }> }>(
  async (requete, { staffId }, { params }) => {
    const { id } = await params;
    const saisies = await lireCorps(requete, unOuPlusieurs(schemaContact, 10));
    return repondre({ crees: await ajouterContacts(id, saisies, staffId) }, 201);
  },
);

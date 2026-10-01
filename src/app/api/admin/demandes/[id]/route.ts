import { ErreurApi } from "@/lib/api-admin/erreurs";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { prisma } from "@/lib/prisma";
import { deciderStatut, schemaAnalyseDemande, verifierLocalisation } from "@/lib/qualification";

/**
 * Enregistre l'analyse de l'agent de qualification. Le statut n'est pas lu
 * dans le corps : il est recalculé ici par `deciderStatut`.
 */
export const PATCH = routeAdmin<{ params: Promise<{ id: string }> }>(
  async (requete, _contexte, { params }) => {
    const { id } = await params;
    const saisie = await lireCorps(requete, schemaAnalyseDemande);
    const demande = await prisma.demandeContactRestaurateur.findUnique({ where: { id } });
    if (!demande) throw new ErreurApi(404, "Demande introuvable.");

    const criteres = verifierLocalisation(saisie.criteres, demande.adresse);
    const misAJour = await prisma.demandeContactRestaurateur.update({
      where: { id },
      data: {
        statut: deciderStatut(criteres),
        analyse: criteres,
        brouillonObjet: saisie.brouillonObjet,
        brouillonCorps: saisie.brouillonCorps,
        analyseeLe: new Date(),
      },
    });
    return repondre({ demande: misAJour });
  },
);

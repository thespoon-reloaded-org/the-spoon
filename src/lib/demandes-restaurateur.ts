import type { IssueDemande } from "./demande-labels";
import { prisma } from "./prisma";

/** Longueur maximale du motif d'une décision — même borne que le formulaire public. */
export const LONGUEUR_MAX_MOTIF_DECISION = 2000;

export type ResultatDecisionDemande = { ok: true } | { ok: false; erreur: string };

/**
 * Accepte ou rejette une demande de contact restaurateur depuis la Console
 * staff. Le statut bascule et une ligne `DECISION` est ajoutée au journal dans
 * la même transaction : un journal qui rate un geste ne prouve plus rien.
 *
 * Rejouer la décision n'écrit pas de deuxième ligne : la transition est un
 * `updateMany` filtré sur `statut: A_QUALIFIER`, donc atomique (même mécanique
 * que `deciderDossier` dans src/lib/contestation.ts). Un premier envoi a déjà
 * changé le statut ; le second trouve 0 ligne et repart sans écrire.
 *
 * Pas de rôles ni de permissions fines : tout membre du staff connecté peut
 * décider, comme ailleurs dans la Console.
 */
export async function deciderDemandeRestaurateur(
  demandeId: string,
  staffId: string,
  issue: IssueDemande,
  motif: string,
  /** Absent : maintenant, et la base horodate. */
  le?: Date,
): Promise<ResultatDecisionDemande> {
  const motifNettoye = motif.trim();
  if (motifNettoye.length === 0) {
    return { ok: false, erreur: "Le motif est obligatoire." };
  }
  if (motifNettoye.length > LONGUEUR_MAX_MOTIF_DECISION) {
    return {
      ok: false,
      erreur: `Motif trop long (${LONGUEUR_MAX_MOTIF_DECISION} caractères max).`,
    };
  }

  const demande = await prisma.demandeContactRestaurateur.findUnique({ where: { id: demandeId } });
  if (!demande) return { ok: false, erreur: "Demande introuvable." };
  if (demande.statut !== "A_QUALIFIER") {
    return { ok: false, erreur: "Cette demande a déjà été traitée." };
  }

  const transition = await prisma.$transaction(async (tx) => {
    const resultat = await tx.demandeContactRestaurateur.updateMany({
      where: { id: demandeId, statut: "A_QUALIFIER" },
      data: { statut: issue },
    });
    if (resultat.count === 0) return false;

    await tx.evenementDemandeRestaurateur.create({
      data: {
        demandeId,
        type: "DECISION",
        details: { issue, motif: motifNettoye },
        auteurStaffId: staffId,
        createdAt: le,
      },
    });
    return true;
  });

  if (!transition) {
    return { ok: false, erreur: "Cette demande vient d'être traitée par quelqu'un d'autre." };
  }
  return { ok: true };
}

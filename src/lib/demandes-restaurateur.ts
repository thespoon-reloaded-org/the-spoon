import { demandeEstOuverte, STATUTS_DEMANDE_OUVERTE, type IssueDemande } from "./demande-labels";
import { prisma } from "./prisma";

/** Longueur maximale du motif d'une décision — même borne que le formulaire public. */
export const LONGUEUR_MAX_MOTIF_DECISION = 2000;

/** Longueur maximale du message demandant un complément au restaurateur. */
export const LONGUEUR_MAX_MESSAGE_COMPLEMENT = 2000;

export type ResultatDecisionDemande = { ok: true } | { ok: false; erreur: string };

/**
 * Accepte ou rejette une demande de contact restaurateur depuis la Console
 * staff. Le statut bascule et une ligne `DECISION` est ajoutée au journal dans
 * la même transaction : un journal qui rate un geste ne prouve plus rien.
 *
 * Rejouer la décision n'écrit pas de deuxième ligne : la transition est un
 * `updateMany` filtré sur les statuts encore ouverts (`A_QUALIFIER` ou
 * `INFOS_DEMANDEES`), donc atomique (même mécanique que `deciderDossier` dans
 * src/lib/contestation.ts). Un premier envoi a déjà changé le statut ; le
 * second trouve 0 ligne et repart sans écrire.
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
  if (!demandeEstOuverte(demande.statut)) {
    return { ok: false, erreur: "Cette demande a déjà été traitée." };
  }

  const transition = await prisma.$transaction(async (tx) => {
    const resultat = await tx.demandeContactRestaurateur.updateMany({
      where: { id: demandeId, statut: { in: [...STATUTS_DEMANDE_OUVERTE] } },
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

export type ResultatDemandeComplement = { ok: true } | { ok: false; erreur: string };

/**
 * Demande un complément d'informations au restaurateur depuis la fiche d'une
 * demande de partenariat. Le statut passe à `INFOS_DEMANDEES` et une ligne
 * `COMPLEMENT_DEMANDE` est ajoutée au journal dans la même transaction.
 *
 * Une demande peut être relancée plusieurs fois tant qu'elle n'est pas
 * décidée : la demande ne retient que son statut courant, le journal garde
 * toutes les relances. `updateMany` filtré sur les statuts encore ouverts
 * rend la transition atomique face à une décision concurrente — si quelqu'un
 * a tranché entre la lecture et l'écriture, 0 ligne est mise à jour et rien
 * n'est écrit.
 *
 * Pas d'envoi d'email : le message est enregistré et affiché, le contact part
 * à la main.
 */
export async function demanderComplementDemandeRestaurateur(
  demandeId: string,
  staffId: string,
  message: string,
  /** Absent : maintenant, et la base horodate. */
  le?: Date,
): Promise<ResultatDemandeComplement> {
  const messageNettoye = message.trim();
  if (messageNettoye.length === 0) {
    return { ok: false, erreur: "Le message est obligatoire." };
  }
  if (messageNettoye.length > LONGUEUR_MAX_MESSAGE_COMPLEMENT) {
    return {
      ok: false,
      erreur: `Message trop long (${LONGUEUR_MAX_MESSAGE_COMPLEMENT} caractères max).`,
    };
  }

  const demande = await prisma.demandeContactRestaurateur.findUnique({ where: { id: demandeId } });
  if (!demande) return { ok: false, erreur: "Demande introuvable." };
  if (!demandeEstOuverte(demande.statut)) {
    return { ok: false, erreur: "Cette demande a déjà été traitée." };
  }

  const transition = await prisma.$transaction(async (tx) => {
    const resultat = await tx.demandeContactRestaurateur.updateMany({
      where: { id: demandeId, statut: { in: [...STATUTS_DEMANDE_OUVERTE] } },
      data: { statut: "INFOS_DEMANDEES" },
    });
    if (resultat.count === 0) return false;

    await tx.evenementDemandeRestaurateur.create({
      data: {
        demandeId,
        type: "COMPLEMENT_DEMANDE",
        details: { message: messageNettoye },
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

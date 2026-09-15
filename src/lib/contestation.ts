import type { LigneFacture, MotifContestation, StatutDossier } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";

import { joursRestantsContestation } from "./facturation";
import { prisma } from "./prisma";

export { LABELS_MOTIF_CONTESTATION, LABELS_STATUT_DOSSIER } from "./contestation-labels";

/**
 * Valeur de départ du seuil de crédit d'office si ConfigContestation n'a
 * jamais été édité — aucun ticket ne fixait ce chiffre, même situation que
 * DELAI_CONTESTATION_JOURS dans facturation.ts en son temps. Modifiable
 * ensuite depuis /admin/contestation.
 */
export const SEUIL_CREDIT_OFFICE_PAR_DEFAUT_CENTIMES = 2000; // 20 €

/** Toujours la somme des lignes contestées — jamais saisi côté client. */
export function calculerMontantConteste(lignes: Pick<LigneFacture, "montantCentimes">[]): number {
  return lignes.reduce((total, ligne) => total + ligne.montantCentimes, 0);
}

/**
 * En-dessous du seuil (strictement) : crédit d'office, le dossier n'entre
 * pas dans la file d'instruction. Au seuil ou au-dessus : instruction
 * manuelle (pas encore outillée — "Décision & émission d'avoir").
 */
export function decisionStatutDossier(montantContesteCentimes: number, seuilCentimes: number): StatutDossier {
  return montantContesteCentimes < seuilCentimes ? "CREDITE_OFFICE" : "EN_ATTENTE_INSTRUCTION";
}

/** Le délai de contestation de la facture est-il dépassé ? */
export function delaiContestationExpire(genereeLe: Date, maintenant = new Date()): boolean {
  return joursRestantsContestation(genereeLe, maintenant) === 0;
}

/** Lit la config du seuil de crédit d'office, en créant la ligne singleton si elle n'existe pas encore. */
export async function getConfigContestation() {
  return prisma.configContestation.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", seuilCreditOfficeCentimes: SEUIL_CREDIT_OFFICE_PAR_DEFAUT_CENTIMES },
  });
}

export type LigneASelectionner = { ligneFactureId: string; motif: MotifContestation };

export type ResultatCreationDossier =
  | { ok: true; dossierId: string }
  | { ok: false; erreur: string };

/**
 * Orchestration du dépôt d'un dossier de contestation, appelée par la
 * Server Action. Revalide tout côté serveur : la facture appartient bien au
 * restaurant, le délai n'est pas dépassé, les lignes appartiennent bien à
 * cette facture, et aucune n'est déjà contestée — cette dernière règle est
 * capturée via la contrainte unique de LigneContestee.ligneFactureId (P2002)
 * plutôt qu'un check-then-act non atomique, même raisonnement que
 * genererOuCompleterFacture dans facturation.ts.
 */
export async function creerDossierContestation(params: {
  factureId: string;
  restaurantId: string;
  restaurantContactId: string;
  lignes: LigneASelectionner[];
  commentaire: string | null;
}): Promise<ResultatCreationDossier> {
  const facture = await prisma.facture.findFirst({
    where: { id: params.factureId, restaurantId: params.restaurantId },
  });
  if (!facture) return { ok: false, erreur: "Facture introuvable." };
  if (delaiContestationExpire(facture.genereeLe)) {
    return { ok: false, erreur: "Le délai de contestation de cette facture est dépassé." };
  }

  // Les deux lectures ci-dessous ne dépendent l'une de l'autre que pour le
  // calcul final (statut) : lancées en parallèle plutôt qu'en série, une
  // fois la facture validée.
  const [lignesFacture, config] = await Promise.all([
    prisma.ligneFacture.findMany({
      where: { id: { in: params.lignes.map((l) => l.ligneFactureId) }, factureId: params.factureId },
    }),
    getConfigContestation(),
  ]);
  if (lignesFacture.length !== params.lignes.length) {
    return { ok: false, erreur: "Une des lignes sélectionnées est introuvable sur cette facture." };
  }

  const montantContesteCentimes = calculerMontantConteste(lignesFacture);
  const statut = decisionStatutDossier(montantContesteCentimes, config.seuilCreditOfficeCentimes);
  const motifParLigne = new Map(params.lignes.map((l) => [l.ligneFactureId, l.motif]));

  try {
    const dossier = await prisma.dossier.create({
      data: {
        factureId: params.factureId,
        restaurantContactId: params.restaurantContactId,
        commentaire: params.commentaire,
        montantContesteCentimes,
        seuilAppliqueCentimes: config.seuilCreditOfficeCentimes,
        statut,
        lignes: {
          create: lignesFacture.map((ligne) => ({
            ligneFactureId: ligne.id,
            motif: motifParLigne.get(ligne.id)!,
          })),
        },
      },
    });
    return { ok: true, dossierId: dossier.id };
  } catch (erreur) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
      return { ok: false, erreur: "Une des lignes sélectionnées est déjà contestée dans un autre dossier." };
    }
    throw erreur;
  }
}

import type {
  ImputationLitige,
  IssueDecision,
  LigneFacture,
  MotifContestation,
  StatutDossier,
} from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";

import { formaterMontant, joursRestantsContestation } from "./facturation";
import { prisma } from "./prisma";

export {
  ETAT_ISSUE_DECISION,
  ETAT_STATUT_DOSSIER,
  LABELS_IMPUTATION_LITIGE,
  LABELS_ISSUE_DECISION,
  LABELS_MOTIF_CONTESTATION,
  LABELS_STATUT_DOSSIER,
  STATUT_DOSSIER_COTE_RESTAURANT,
} from "./contestation-labels";

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
 * En-dessous du seuil (strictement) : crédit d'office, le dossier n'entre pas
 * dans la file d'instruction et son avoir est émis dès le dépôt. Au seuil ou
 * au-dessus : instruction manuelle, tranchée par `deciderDossier`.
 */
export function decisionStatutDossier(montantContesteCentimes: number, seuilCentimes: number): StatutDossier {
  return montantContesteCentimes < seuilCentimes ? "CREDITE_OFFICE" : "EN_ATTENTE_INSTRUCTION";
}

/** Le délai de contestation de la facture est-il dépassé ? */
export function delaiContestationExpire(genereeLe: Date, maintenant = new Date()): boolean {
  return joursRestantsContestation(genereeLe, maintenant) === 0;
}

const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * Ancienneté d'un dossier depuis son dépôt, affichée dans "File des litiges
 * à instruire" — c'est ce qui permet de voir la queue grossir avant qu'elle
 * ne devienne un problème. Phrase complète (pas juste une durée) pour
 * s'enchaîner directement après "déposé".
 */
export function formaterAnciennete(depuis: Date, maintenant = new Date()): string {
  const jours = Math.floor((maintenant.getTime() - depuis.getTime()) / MILLISECONDES_PAR_JOUR);
  if (jours <= 0) return "aujourd'hui";
  return `il y a ${jours} jour${jours > 1 ? "s" : ""}`;
}

/**
 * Délai entre le service (date de la réservation) et son signalement
 * (honoré/no-show) — c'est ce qui permet à l'instructeur de juger un
 * signalement tardif, en particulier sur un motif NO_SHOW ("Instruction d'un
 * dossier"). Toujours positif ou nul : `marquerReservation` n'accepte de
 * signaler qu'un créneau déjà passé.
 */
export function formaterDelaiSignalement(dateService: Date, signaleeLe: Date): string {
  const jours = Math.floor((signaleeLe.getTime() - dateService.getTime()) / MILLISECONDES_PAR_JOUR);
  if (jours <= 0) return "signalé le jour même";
  return `signalé ${jours} jour${jours > 1 ? "s" : ""} après le service`;
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
        // Un crédit d'office est une décision comme une autre — prise par la
        // règle de seuil plutôt que par une personne (`decideParId` reste
        // null). Sans elle, "crédité d'office" ne créditait rien : le dossier
        // changeait de statut et s'arrêtait là, sans avoir en déduction de la
        // facture.
        ...(statut === "CREDITE_OFFICE" && {
          decisions: {
            create: {
              issue: "ACCORDE",
              montantAccordeCentimes: montantContesteCentimes,
              imputation: "THESPOON",
              motif: `Crédit d'office : ${formaterMontant(
                montantContesteCentimes,
              )} contestés, sous le seuil d'instruction de ${formaterMontant(
                config.seuilCreditOfficeCentimes,
              )}.`,
              avoir: {
                create: { factureId: params.factureId, montantCentimes: montantContesteCentimes },
              },
            },
          },
        }),
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

export type ResultatPriseEnCharge = { ok: true } | { ok: false; erreur: string };

/**
 * Prise en charge d'un dossier depuis "File des litiges à instruire". Pas de
 * rôle "instructeur" dédié : n'importe quel membre du staff connecté peut
 * prendre en charge. `updateMany` avec `instructeurId: null` dans le WHERE
 * rend le check-then-act atomique : si deux membres du staff cliquent en
 * même temps sur le même dossier, un seul le prend (`count === 1`) — même
 * raisonnement que `marquerReservation` dans
 * espace-restaurant/reservations/actions.ts.
 */
export async function prendreEnChargeDossier(
  dossierId: string,
  instructeurId: string,
): Promise<ResultatPriseEnCharge> {
  const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier || dossier.statut !== "EN_ATTENTE_INSTRUCTION") {
    return { ok: false, erreur: "Dossier introuvable." };
  }

  const resultat = await prisma.dossier.updateMany({
    where: { id: dossierId, instructeurId: null },
    data: { instructeurId, priseEnChargeLe: new Date() },
  });
  if (resultat.count === 0) {
    return { ok: false, erreur: "Ce dossier a déjà été pris en charge." };
  }
  return { ok: true };
}

export type ResultatDemandeComplement = { ok: true } | { ok: false; erreur: string };

/**
 * Demande de complément de l'instructeur au restaurant, depuis "Instruction
 * d'un dossier" — ne clôture pas le dossier (reste EN_ATTENTE_INSTRUCTION),
 * juste un message et un horodatage. Réservé à l'instructeur assigné : il
 * faut avoir pris en charge le dossier avant de pouvoir l'instruire, même
 * logique que le reste de l'epic.
 */
export async function demanderComplementDossier(
  dossierId: string,
  staffId: string,
  message: string,
): Promise<ResultatDemandeComplement> {
  const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier || dossier.statut !== "EN_ATTENTE_INSTRUCTION") {
    return { ok: false, erreur: "Dossier introuvable." };
  }
  if (dossier.instructeurId !== staffId) {
    return { ok: false, erreur: "Seul l'instructeur assigné à ce dossier peut demander un complément." };
  }

  await prisma.dossier.update({
    where: { id: dossierId },
    data: { complementDemandeLe: new Date(), complementDemandeMessage: message },
  });
  return { ok: true };
}

/** Les deux statuts depuis lesquels un dossier peut encore être tranché. */
export const STATUTS_A_TRANCHER = ["EN_ATTENTE_INSTRUCTION", "ESCALADE"] as const;

export function dossierATrancher(statut: StatutDossier): boolean {
  return (STATUTS_A_TRANCHER as readonly StatutDossier[]).includes(statut);
}

/** Ce que l'instructeur saisit ; ce qui est enregistré passe par `normaliserDecision`. */
export type SaisieDecision = {
  issue: IssueDecision;
  /** Seulement pour un accord partiel — ignoré (et non requis) sur les autres issues. */
  montantAccordeCentimes?: number | null;
  /** Seulement pour un accord (total ou partiel) — forcée sur un refus, absente sur une escalade. */
  imputation?: ImputationLitige | null;
  motif: string;
};

export type DecisionNormalisee = {
  issue: IssueDecision;
  montantAccordeCentimes: number;
  imputation: ImputationLitige | null;
  /** Statut dans lequel le dossier bascule une fois la décision enregistrée. */
  statutDossier: StatutDossier;
};

export type ResultatNormalisation =
  | { ok: true; decision: DecisionNormalisee }
  | { ok: false; erreur: string };

/**
 * Traduit une saisie d'instructeur en décision enregistrable, et refuse les
 * combinaisons qui n'ont pas de sens métier. Pure (pas de base) : c'est ici
 * que vivent les règles, pas dans le formulaire, qui peut être contourné.
 *
 * - accordé : le montant est celui du dossier, jamais un chiffre saisi ;
 * - partiel : strictement entre 0 et le montant contesté (sinon c'est un
 *   accord ou un refus, qui ont chacun leur issue) ;
 * - refusé : rien n'est crédité, donc le coût reste au restaurant — imputation
 *   forcée plutôt que demandée ;
 * - escaladé : rien n'est tranché, donc ni montant ni imputation.
 */
export function normaliserDecision(
  montantContesteCentimes: number,
  saisie: SaisieDecision,
): ResultatNormalisation {
  if (!saisie.motif.trim()) {
    return { ok: false, erreur: "La décision doit être motivée : c'est la réponse envoyée au restaurant." };
  }

  switch (saisie.issue) {
    case "ACCORDE":
    case "PARTIEL": {
      const montantAccordeCentimes =
        saisie.issue === "ACCORDE" ? montantContesteCentimes : Math.round(saisie.montantAccordeCentimes ?? 0);
      if (saisie.issue === "PARTIEL") {
        if (!Number.isFinite(montantAccordeCentimes) || montantAccordeCentimes <= 0) {
          return { ok: false, erreur: "Un accord partiel doit créditer un montant supérieur à 0 — sinon c'est un refus." };
        }
        if (montantAccordeCentimes >= montantContesteCentimes) {
          return {
            ok: false,
            erreur: `Un accord partiel doit rester sous ${formaterMontant(
              montantContesteCentimes,
            )} — au-delà, c'est un accord total.`,
          };
        }
      }
      if (saisie.imputation !== "THESPOON" && saisie.imputation !== "CLIENT") {
        return {
          ok: false,
          erreur: "Un accord doit dire qui porte le coût : TheSpoon ou le client.",
        };
      }
      return {
        ok: true,
        decision: {
          issue: saisie.issue,
          montantAccordeCentimes,
          imputation: saisie.imputation,
          statutDossier: "CLOTURE",
        },
      };
    }
    case "REFUSE":
      return {
        ok: true,
        decision: {
          issue: "REFUSE",
          montantAccordeCentimes: 0,
          imputation: "RESTAURANT",
          statutDossier: "CLOTURE",
        },
      };
    case "ESCALADE":
      return {
        ok: true,
        decision: {
          issue: "ESCALADE",
          montantAccordeCentimes: 0,
          imputation: null,
          statutDossier: "ESCALADE",
        },
      };
  }
}

/** Le dossier a changé de statut entre la lecture et l'écriture de la décision. */
export class DossierDejaTrancheError extends Error {
  constructor() {
    super("Ce dossier vient d'être tranché par quelqu'un d'autre.");
    this.name = "DossierDejaTrancheError";
  }
}

export type ResultatDecision = { ok: true; avoirEmis: boolean } | { ok: false; erreur: string };

/**
 * "Décision & émission d'avoir" — la seule sortie d'un dossier en attente.
 * Enregistre l'issue, l'imputation et le motif, émet l'avoir correspondant
 * s'il y a quelque chose à créditer, et fait basculer le dossier hors de la
 * file d'instruction.
 *
 * Rejouer l'opération ne crédite pas deux fois : la transition de statut est
 * une transition atomique (`updateMany` filtré sur le statut lu, même
 * mécanique que `prendreEnChargeDossier`), et c'est elle qui autorise
 * l'écriture de la décision. Un deuxième envoi — double clic, retour arrière,
 * deux instructeurs sur le même dossier — trouve le dossier dans un autre
 * statut et repart sans rien écrire. Deuxième verrou en base : `decisionId`
 * est unique sur Avoir, donc une décision ne peut pas porter deux avoirs.
 *
 * Qui peut trancher : l'instructeur qui a pris le dossier en charge, et lui
 * seul, tant que le dossier est EN_ATTENTE_INSTRUCTION. Un dossier escaladé
 * est ouvert à tout le staff — c'est le sens de l'escalade, passer la main —
 * faute de rôles (la double validation d'un responsable au-dessus d'un seuil
 * est le ticket "Validation des avoirs au-dessus du seuil", qui attend
 * "Auth staff TheSpoon & permissions").
 */
export async function deciderDossier(
  dossierId: string,
  staffId: string,
  saisie: SaisieDecision,
): Promise<ResultatDecision> {
  const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
  if (!dossier) return { ok: false, erreur: "Dossier introuvable." };
  if (!dossierATrancher(dossier.statut)) {
    return { ok: false, erreur: "Ce dossier est déjà tranché." };
  }
  if (dossier.statut === "EN_ATTENTE_INSTRUCTION" && dossier.instructeurId !== staffId) {
    return { ok: false, erreur: "Seul l'instructeur assigné à ce dossier peut le trancher." };
  }

  const normalisee = normaliserDecision(dossier.montantContesteCentimes, saisie);
  if (!normalisee.ok) return normalisee;
  const { issue, montantAccordeCentimes, imputation, statutDossier } = normalisee.decision;

  try {
    await prisma.$transaction(async (tx) => {
      const transition = await tx.dossier.updateMany({
        where: { id: dossierId, statut: dossier.statut },
        data: { statut: statutDossier },
      });
      if (transition.count === 0) throw new DossierDejaTrancheError();

      await tx.decisionDossier.create({
        data: {
          dossierId,
          issue,
          montantAccordeCentimes,
          imputation,
          motif: saisie.motif.trim(),
          decideParId: staffId,
          ...(montantAccordeCentimes > 0 && {
            avoir: {
              create: { factureId: dossier.factureId, montantCentimes: montantAccordeCentimes },
            },
          }),
        },
      });
    });
  } catch (erreur) {
    if (erreur instanceof DossierDejaTrancheError) return { ok: false, erreur: erreur.message };
    throw erreur;
  }

  return { ok: true, avoirEmis: montantAccordeCentimes > 0 };
}

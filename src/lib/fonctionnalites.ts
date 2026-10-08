/**
 * Les fonctionnalités qu'un formateur peut couper pendant une session.
 *
 * Globales : la production et les Deploy Previews partagent la même base,
 * une fonctionnalité coupée l'est pour tout TheSpoon. Pas de ligne en base =
 * active — un déploiement ne coupe rien tant qu'aucun formateur n'y a touché.
 *
 * Une fonctionnalité n'entre dans `FONCTIONNALITES` qu'avec l'interrupteur
 * qui la coupe réellement, côté écran **et** côté serveur : l'écran ne
 * propose jamais ce que le serveur refuserait.
 */
import type { CleFonctionnalite } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type FicheFonctionnalite = {
  libelle: string;
  /** Ce qu'elle fait, vu de ceux qui s'en servent. */
  description: string;
  /** Ce que voient les utilisateurs quand elle est coupée — dit avant de couper. */
  quandCoupee: string;
};

export const FONCTIONNALITES: Record<CleFonctionnalite, FicheFonctionnalite> = {
  ASSISTANT_RECHERCHE: {
    libelle: "Assistant de recherche",
    description:
      "Le widget de l'accueil : un dîneur décrit ce qu'il cherche, l'assistant lui propose dix restaurants.",
    quandCoupee:
      "Le widget disparaît de l'accueil et l'assistant refuse les demandes des conversations déjà ouvertes. La recherche classique n'en dépend pas.",
  },
};

export async function estActive(cle: CleFonctionnalite): Promise<boolean> {
  const ligne = await prisma.fonctionnalite.findUnique({
    where: { cle },
    select: { active: true },
  });
  return ligne?.active ?? true;
}

/** Chaque fonctionnalité du catalogue, avec son état et son dernier changement. */
export async function lireFonctionnalites() {
  const lignes = await prisma.fonctionnalite.findMany({
    include: { modifieePar: { select: { nom: true } } },
  });
  const parCle = new Map(lignes.map((ligne) => [ligne.cle, ligne]));

  return (Object.keys(FONCTIONNALITES) as CleFonctionnalite[]).map((cle) => {
    const ligne = parCle.get(cle);
    return {
      cle,
      ...FONCTIONNALITES[cle],
      active: ligne?.active ?? true,
      modifiee: ligne ? { le: ligne.modifieeLe, par: ligne.modifieePar.nom } : null,
    };
  });
}

/**
 * Coupe ou rallume une fonctionnalité, et l'inscrit au journal dans la même
 * transaction. On envoie l'état voulu, pas « inverser » : un double clic, ou
 * deux formateurs qui coupent en même temps, ne la rallument pas — et une
 * demande sans effet n'écrit rien. Le verrou consultatif sérialise les
 * bascules d'une même fonctionnalité : sans lui, deux coupures simultanées
 * liraient toutes deux « active » et laisseraient deux lignes au journal (la
 * ligne n'existe pas toujours, `FOR UPDATE` n'aurait rien à verrouiller).
 */
export async function changerFonctionnalite(
  cle: CleFonctionnalite,
  active: boolean,
  formateurId: string,
): Promise<{ change: boolean }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`fonctionnalite:${cle}`}))`;
    const avant = await tx.fonctionnalite.findUnique({ where: { cle }, select: { active: true } });
    if ((avant?.active ?? true) === active) return { change: false };

    await tx.fonctionnalite.upsert({
      where: { cle },
      update: { active, modifieeParId: formateurId },
      create: { cle, active, modifieeParId: formateurId },
    });
    await tx.journalFormateur.create({
      data: {
        formateurId,
        fonctionnalite: cle,
        active,
        resume: `${FONCTIONNALITES[cle].libelle} : ${active ? "rallumée" : "coupée"} pour tout TheSpoon.`,
      },
    });
    return { change: true };
  });
}

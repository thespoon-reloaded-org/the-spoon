import type { Booking, Facture } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";

import { prisma } from "./prisma";

/**
 * TheSpoon ne facture pas la réservation, elle facture le couvert servi (voir
 * le ticket Notion "Génération de la facture mensuelle") — taux unique pour
 * tous les partenaires, pas de négociation par restaurant pour l'instant.
 */
export const COMMISSION_CENTIMES_PAR_COUVERT = 250;

/**
 * Couverts pris en compte pour la commission : `couvertsServis` si le
 * signalement l'a renseigné, sinon repli sur `couverts` (le nombre réservé) —
 * pour ne jamais ignorer silencieusement une réservation honorée qui n'aurait
 * pas ce champ (données historiques, ou signalement incomplet).
 */
export function couvertsAFacturer(booking: Pick<Booking, "couverts" | "couvertsServis">): number {
  return booking.couvertsServis ?? booking.couverts;
}

/**
 * Délai de contestation d'une facture, en jours à partir de sa génération —
 * aucun ticket ne fixait ce chiffre, décision prise en conversation avec Elsa
 * (30 jours, délai B2B standard). Utilisé côté "Mes factures" pour afficher
 * le temps restant ; le dépôt de contestation lui-même (epic "Contestations
 * & litiges") n'est pas encore construit.
 */
export const DELAI_CONTESTATION_JOURS = 30;

const MILLISECONDES_PAR_JOUR = 24 * 60 * 60 * 1000;

/** Jours restants avant expiration du délai de contestation — 0 si expiré. */
export function joursRestantsContestation(genereeLe: Date, maintenant = new Date()): number {
  const joursEcoules = Math.floor((maintenant.getTime() - genereeLe.getTime()) / MILLISECONDES_PAR_JOUR);
  return Math.max(0, DELAI_CONTESTATION_JOURS - joursEcoules);
}

/** Référence lisible d'une facture — pas stockée en base, dérivée du mois + de l'id. */
export function referenceFacture(facture: Pick<Facture, "id" | "mois">): string {
  const annee = facture.mois.getUTCFullYear();
  const moisIndex = String(facture.mois.getUTCMonth() + 1).padStart(2, "0");
  return `FA-${annee}${moisIndex}-${facture.id.slice(-6).toUpperCase()}`;
}

export function formaterMontant(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formaterMoisFacture(mois: Date): string {
  return mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type ResultatGenerationFactures = {
  facturesCreees: number;
  dejaExistantes: number;
};

/**
 * Génère, pour chaque restaurant ayant au moins une réservation honorée dans
 * le mois donné, une facture et ses lignes. Idempotent : relancer le
 * traitement sur un mois déjà facturé ne crée rien de plus — voir
 * `@@unique([restaurantId, mois])` sur `Facture`, qui est la vraie garantie
 * (y compris sous double déclenchement concurrent), pas une simple
 * vérification applicative avant écriture.
 */
export async function genererFacturesMois(mois: Date): Promise<ResultatGenerationFactures> {
  const debutMois = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth(), 1));
  const finMois = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 1));

  const restaurantsAFacturer = await prisma.booking.findMany({
    where: { statut: "HONOREE", date: { gte: debutMois, lt: finMois } },
    select: { restaurantId: true },
    distinct: ["restaurantId"],
  });

  let facturesCreees = 0;
  let dejaExistantes = 0;

  for (const { restaurantId } of restaurantsAFacturer) {
    const creee = await genererFactureRestaurant(restaurantId, debutMois, finMois);
    if (creee) {
      facturesCreees++;
    } else {
      dejaExistantes++;
    }
  }

  return { facturesCreees, dejaExistantes };
}

async function genererFactureRestaurant(
  restaurantId: string,
  debutMois: Date,
  finMois: Date,
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({
        where: { restaurantId, statut: "HONOREE", date: { gte: debutMois, lt: finMois } },
      });

      const lignes = bookings.map((booking) => {
        const couvertsFactures = couvertsAFacturer(booking);
        return {
          bookingId: booking.id,
          couvertsFactures,
          montantCentimes: couvertsFactures * COMMISSION_CENTIMES_PAR_COUVERT,
        };
      });
      const montantTotalCentimes = lignes.reduce((total, ligne) => total + ligne.montantCentimes, 0);

      await tx.facture.create({
        data: {
          restaurantId,
          mois: debutMois,
          montantTotalCentimes,
          lignes: { create: lignes },
        },
      });
    });
    return true;
  } catch (erreur) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
      return false; // déjà générée : relance du traitement, ou course concurrente
    }
    throw erreur;
  }
}

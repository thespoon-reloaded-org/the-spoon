import type { Avoir, Booking, Facture } from "@/generated/prisma";
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
 * (30 jours, délai B2B standard). Affiché côté "Mes factures", et revérifié
 * côté serveur au dépôt d'un dossier (voir `delaiContestationExpire`).
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

/**
 * Référence lisible d'un avoir — même forme que `referenceFacture`, préfixe
 * distinct : un avoir et la facture qu'il corrige ne doivent jamais se
 * confondre dans un échange avec un restaurateur.
 */
export function referenceAvoir(avoir: Pick<Avoir, "id" | "emisLe">): string {
  const annee = avoir.emisLe.getUTCFullYear();
  const moisIndex = String(avoir.emisLe.getUTCMonth() + 1).padStart(2, "0");
  return `AV-${annee}${moisIndex}-${avoir.id.slice(-6).toUpperCase()}`;
}

/** Somme des avoirs émis sur une facture. */
export function montantAvoirsCentimes(avoirs: Pick<Avoir, "montantCentimes">[]): number {
  return avoirs.reduce((total, avoir) => total + avoir.montantCentimes, 0);
}

/**
 * Ce qui reste dû après déduction des avoirs. Une facture émise ne se réécrit
 * pas (`montantTotalCentimes` ne bouge jamais) : elle se corrige par un
 * avoir, et c'est la soustraction des deux qui donne le net. Borné à 0 — un
 * avoir plus gros que la facture ne crée pas une dette de TheSpoon envers le
 * restaurant, situation qu'aucun écran ne saurait traiter aujourd'hui.
 */
export function netAPayerCentimes(
  montantTotalCentimes: number,
  avoirs: Pick<Avoir, "montantCentimes">[],
): number {
  return Math.max(0, montantTotalCentimes - montantAvoirsCentimes(avoirs));
}

export function formaterMontant(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formaterMoisFacture(mois: Date): string {
  return mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Date (et heure, optionnelle) d'une réservation facturée — même format
 * partout où une ligne de facture est listée (facture, dépôt de
 * contestation, récapitulatif de dossier), pour ne pas le retaper à chaque
 * écran.
 */
export function formaterDateReservation(date: Date, { avecHeure = true }: { avecHeure?: boolean } = {}): string {
  const jour = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  if (!avecHeure) return jour;
  return `${jour} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

export type ResultatGenerationFactures = {
  facturesCreees: number;
  lignesAjoutees: number;
};

/**
 * Génère, pour chaque restaurant ayant au moins une réservation honorée dans
 * le mois donné, une facture et ses lignes — et complète une facture déjà
 * générée avec les réservations honorées *depuis*, plutôt que de les ignorer.
 *
 * L'idempotence est au niveau de la ligne (`LigneFacture.bookingId` unique),
 * pas au niveau de la facture : une facture existante n'est jamais un signal
 * pour tout ignorer. Une réservation signalée honorée après coup (signalement
 * tardif, correction d'un no-show) doit pouvoir rejoindre la facture déjà
 * émise plutôt que de ne jamais être facturée — voir le commentaire sur
 * `LigneFacture` dans le schéma.
 */
export async function genererFacturesMois(mois: Date): Promise<ResultatGenerationFactures> {
  const debutMois = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth(), 1));
  const finMois = new Date(Date.UTC(mois.getUTCFullYear(), mois.getUTCMonth() + 1, 1));

  const bookings = await prisma.booking.findMany({
    where: { statut: "HONOREE", date: { gte: debutMois, lt: finMois } },
  });

  const bookingsParRestaurant = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const bookingsExistants = bookingsParRestaurant.get(booking.restaurantId);
    if (bookingsExistants) {
      bookingsExistants.push(booking);
    } else {
      bookingsParRestaurant.set(booking.restaurantId, [booking]);
    }
  }

  let facturesCreees = 0;
  let lignesAjoutees = 0;

  for (const [restaurantId, bookingsRestaurant] of bookingsParRestaurant) {
    const resultat = await genererOuCompleterFacture(restaurantId, debutMois, bookingsRestaurant);
    if (resultat.factureCreee) facturesCreees++;
    lignesAjoutees += resultat.lignesAjoutees;
  }

  return { facturesCreees, lignesAjoutees };
}

async function genererOuCompleterFacture(
  restaurantId: string,
  mois: Date,
  bookings: Booking[],
): Promise<{ factureCreee: boolean; lignesAjoutees: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      let facture = await tx.facture.findUnique({ where: { restaurantId_mois: { restaurantId, mois } } });
      const factureCreee = !facture;
      if (!facture) {
        facture = await tx.facture.create({ data: { restaurantId, mois, montantTotalCentimes: 0 } });
      }

      // Réservations déjà présentes sur UNE facture, peu importe laquelle —
      // `bookingId` est unique tous mois confondus, donc ce filtre suffit à
      // ne jamais recréer une ligne déjà émise.
      const dejaFacturees = await tx.ligneFacture.findMany({
        where: { bookingId: { in: bookings.map((b) => b.id) } },
        select: { bookingId: true },
      });
      const idsDejaFactures = new Set(dejaFacturees.map((l) => l.bookingId));
      const aFacturer = bookings.filter((b) => !idsDejaFactures.has(b.id));

      if (aFacturer.length === 0) {
        return { factureCreee, lignesAjoutees: 0 };
      }

      const lignes = aFacturer.map((booking) => {
        const couvertsFactures = couvertsAFacturer(booking);
        return {
          factureId: facture.id,
          bookingId: booking.id,
          couvertsFactures,
          montantCentimes: couvertsFactures * COMMISSION_CENTIMES_PAR_COUVERT,
        };
      });
      const montantAjoute = lignes.reduce((total, ligne) => total + ligne.montantCentimes, 0);

      await tx.ligneFacture.createMany({ data: lignes });
      await tx.facture.update({
        where: { id: facture.id },
        data: { montantTotalCentimes: { increment: montantAjoute } },
      });

      return { factureCreee, lignesAjoutees: lignes.length };
    });
  } catch (erreur) {
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
      // Deux déclenchements concurrents sur le même restaurant/mois : celui-ci
      // a perdu la course, la transaction est annulée en bloc (rien de
      // partiellement commité) — un prochain passage reprendra ce qui manque.
      return { factureCreee: false, lignesAjoutees: 0 };
    }
    throw erreur;
  }
}

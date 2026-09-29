import type { Avoir, Booking, Facture } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";

import { formaterHeure, formaterJourCourt } from "./fuseau";
import { prisma } from "./prisma";

// Réexporté pour que les écrans continuent d'importer leur formatage de
// montant depuis le module de facturation, là où ils le cherchent.
export { formaterMontant } from "./montants";

/**
 * TheSpoon ne facture pas la réservation, elle facture le couvert servi (voir
 * le ticket Notion "Génération de la facture mensuelle"), taux unique pour
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
  const joursEcoules = Math.floor(
    (maintenant.getTime() - genereeLe.getTime()) / MILLISECONDES_PAR_JOUR,
  );
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
  // Mois local, pas UTC : `emisLe` est un instant, et la référence doit
  // désigner le même mois que la date affichée à côté d'elle. En UTC, un avoir
  // émis le 1er octobre à 00h30 à Paris s'appellerait AV-202609.
  const annee = avoir.emisLe.getFullYear();
  const moisIndex = String(avoir.emisLe.getMonth() + 1).padStart(2, "0");
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

/**
 * `timeZone: "UTC"` et pas Europe/Paris, contrairement au reste : le mois
 * d'une facture est stocké à minuit UTC le 1er (voir `moisFacture`), c'est un
 * repère de calendrier, pas un instant. Le lire à Paris ramènerait au mois
 * précédent.
 */
export function formaterMoisFacture(mois: Date): string {
  return mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Date (et heure, optionnelle) d'une réservation facturée — même format
 * partout où une ligne de facture est listée (facture, dépôt de
 * contestation, récapitulatif de dossier), pour ne pas le retaper à chaque
 * écran.
 */
export function formaterDateReservation(
  date: Date,
  { avecHeure = true }: { avecHeure?: boolean } = {},
): string {
  const jour = formaterJourCourt(date);
  return avecHeure ? `${jour} à ${formaterHeure(date)}` : jour;
}

/**
 * Le repère de mois d'une facture : minuit UTC le 1er, depuis "AAAA-MM"
 * (déjà validé, voir `moisIsoValide`). Un repère de calendrier, pas un
 * instant — voir `formaterMoisFacture`.
 */
export function moisFacture(moisIso: string): Date {
  const [annee, index] = moisIso.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(annee, index - 1, 1));
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
export async function genererFacturesMois(
  mois: Date,
  {
    genereeLe,
  }: {
    /**
     * Date d'émission des factures *créées* par cet appel — une facture déjà
     * émise garde la sienne. Absente : maintenant, comme depuis la Console.
     * L'API d'administration la fixe pour reconstituer un mois passé tel
     * qu'il aurait été facturé (le délai de contestation en dépend).
     */
    genereeLe?: Date;
  } = {},
): Promise<ResultatGenerationFactures> {
  // Bornes en UTC, alors que `Booking.date` porte un instant parisien : les
  // deux ne coïncident qu'aussi longtemps qu'aucun service ne tombe entre
  // minuit et 2h du matin. C'est le cas — le dernier créneau réservable est
  // 22h à Paris, soit 20h UTC (voir CRENEAUX_SOIR). Un créneau de nuit
  // rattacherait le 1er du mois au mois précédent : découper le mois en heure
  // de Paris deviendrait alors nécessaire.
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
    const resultat = await genererOuCompleterFacture(
      restaurantId,
      debutMois,
      bookingsRestaurant,
      genereeLe,
    );
    if (resultat.factureCreee) facturesCreees++;
    lignesAjoutees += resultat.lignesAjoutees;
  }

  return { facturesCreees, lignesAjoutees };
}

async function genererOuCompleterFacture(
  restaurantId: string,
  mois: Date,
  bookings: Booking[],
  genereeLe: Date | undefined,
): Promise<{ factureCreee: boolean; lignesAjoutees: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      let facture = await tx.facture.findUnique({
        where: { restaurantId_mois: { restaurantId, mois } },
      });
      const factureCreee = !facture;
      if (!facture) {
        facture = await tx.facture.create({
          data: { restaurantId, mois, montantTotalCentimes: 0, genereeLe },
        });
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

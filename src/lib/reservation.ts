import type { Booking } from "@/generated/prisma";

import { prisma } from "./prisma";

/**
 * Capacité retenue pour un restaurant qui n'a pas encore renseigné la
 * sienne (31 % des fiches, voir le ticket Notion "Capacité & conflits de
 * réservation") — un plafond de sécurité plutôt que de laisser passer sans
 * aucun contrôle.
 */
export const CAPACITE_PAR_DEFAUT = 100;

export function capaciteEffective(capacite: number | null): number {
  return capacite ?? CAPACITE_PAR_DEFAUT;
}

/** Le créneau demandé n'a plus de place disponible pour ce nombre de couverts. */
export class CreneauCompletError extends Error {
  constructor() {
    super("Ce créneau est complet.");
    this.name = "CreneauCompletError";
  }
}

/**
 * Crée une réservation en garantissant qu'elle ne fait jamais dépasser la
 * capacité du restaurant sur ce créneau — y compris sous accès concurrent.
 *
 * Un simple `SELECT` (somme des couverts déjà confirmés) suivi d'un `INSERT`
 * ne suffit pas : entre les deux, une autre réservation peut s'intercaler.
 * La garantie vient donc de la base, pas du code applicatif : le
 * `SELECT ... FOR UPDATE` verrouille la ligne `Restaurant` pour la durée de
 * la transaction, ce qui sérialise les réservations concurrentes sur un même
 * restaurant — la seconde attend que la première commite, puis relit un
 * total à jour avant de décider.
 */
export async function reserverCreneau({
  restaurantId,
  userId,
  date,
  couverts,
}: {
  restaurantId: string;
  userId: string;
  date: Date;
  couverts: number;
}): Promise<Booking> {
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.$queryRaw<{ capacite: number | null }[]>`
      SELECT capacite FROM "Restaurant" WHERE id = ${restaurantId} FOR UPDATE
    `;
    const capacite = capaciteEffective(lignes[0]?.capacite ?? null);

    const agregat = await tx.booking.aggregate({
      where: { restaurantId, date, statut: "CONFIRMEE" },
      _sum: { couverts: true },
    });
    const dejaReserve = agregat._sum.couverts ?? 0;

    if (dejaReserve + couverts > capacite) {
      throw new CreneauCompletError();
    }

    return tx.booking.create({ data: { restaurantId, userId, date, couverts } });
  });
}

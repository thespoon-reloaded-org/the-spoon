import type { Prisma } from "@/generated/prisma";

/**
 * Recalcule la note en cuillères et le nombre d'avis d'un restaurant à
 * partir de ses avis — dans la transaction qui vient de les écrire, pour que
 * la fiche ne montre jamais une moyenne d'avant. Partagé par le dépôt d'avis
 * du dîneur et l'API d'administration.
 */
export async function recalculerNoteRestaurant(tx: Prisma.TransactionClient, restaurantId: string) {
  const agregat = await tx.avis.aggregate({
    where: { restaurantId },
    _avg: { noteCuilleres: true },
    _count: true,
  });
  await tx.restaurant.update({
    where: { id: restaurantId },
    data: { noteCuilleres: agregat._avg.noteCuilleres, nombreAvis: agregat._count },
  });
}

/**
 * Les réservations qui valent passage : une réservation dont le créneau est
 * passé, signalée honorée par le restaurant ou encore confirmée (le
 * restaurant ne l'a pas encore signalée). Jamais une annulée ni un no-show.
 * Seule définition de « avoir été servi » — le dépôt d'avis du dîneur, la
 * fiche qui décide d'afficher le formulaire et l'API d'administration la
 * partagent pour ne pas diverger.
 */
export function reservationsServies(maintenant: Date) {
  return {
    statut: { in: ["HONOREE", "CONFIRMEE"] },
    date: { lte: maintenant },
  } satisfies Prisma.BookingWhereInput;
}

/** Ce dîneur a-t-il déjà été servi dans ce restaurant ? */
export async function aEteServi(
  client: Pick<Prisma.TransactionClient, "booking">,
  restaurantId: string,
  userId: string,
  maintenant = new Date(),
) {
  const reservation = await client.booking.findFirst({
    where: { restaurantId, userId, ...reservationsServies(maintenant) },
    select: { id: true },
  });
  return reservation !== null;
}

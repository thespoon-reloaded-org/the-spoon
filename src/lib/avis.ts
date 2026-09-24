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

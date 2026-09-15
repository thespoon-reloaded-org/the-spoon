import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { FactureDocument } from "@/components/FactureDocument";
import { authRestaurant } from "@/lib/auth";
import { joursRestantsContestation } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";

/**
 * Détail d'une facture, ligne à ligne — chaque ligne rattachée à sa
 * réservation (voir ticket "Mes factures (côté restaurant)"). Scopée au
 * restaurant du contact connecté : pas d'accès à la facture d'un autre
 * restaurant même en devinant l'id.
 */
export default async function FactureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id } = await params;

  const facture = await prisma.facture.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
    include: {
      restaurant: { select: { nom: true, adresse: true } },
      lignes: { include: { booking: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!facture) notFound();

  return (
    <FactureDocument
      facture={facture}
      joursRestants={joursRestantsContestation(facture.genereeLe)}
      retour={{ href: "/espace-restaurant/factures", label: "Mes factures" }}
    />
  );
}

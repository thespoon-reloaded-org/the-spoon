import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { FactureDocument } from "@/components/FactureDocument";
import { authRestaurant } from "@/lib/auth";
import { joursRestantsContestation } from "@/lib/facturation";
import { BOUTON_PRIMAIRE } from "@/lib/ui";
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

  const joursRestants = joursRestantsContestation(facture.genereeLe);

  return (
    <div className="flex flex-col items-start gap-4 md:flex-row">
      <div className="min-w-0 flex-1">
        <FactureDocument
          facture={facture}
          joursRestants={joursRestants}
          retour={{ href: "/espace-restaurant/factures", label: "Mes factures" }}
        />
      </div>
      {joursRestants > 0 && (
        <div className="w-full shrink-0 md:mt-16 md:w-auto">
          <Link
            href={`/espace-restaurant/factures/${facture.id}/contester`}
            className={`${BOUTON_PRIMAIRE} block text-center`}
          >
            Contester cette facture
          </Link>
        </div>
      )}
    </div>
  );
}

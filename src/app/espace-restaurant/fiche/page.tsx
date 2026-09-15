import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { FicheEtablissementForm } from "@/components/FicheEtablissementForm";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * La fiche est alimentée uniquement par le seed jusqu'ici — cet écran laisse
 * le restaurant la tenir à jour lui-même. Contrôle d'accès déjà fait par le
 * layout parent.
 */
export default async function FicheEtablissementPage() {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    select: {
      id: true,
      nom: true,
      ville: true,
      cuisine: true,
      adresse: true,
      horaires: true,
      description: true,
      capacite: true,
      delaiAnnulationHeures: true,
      photoMisAJourLe: true,
    },
  });
  if (!restaurant) notFound();

  return (
    <div className="max-w-xl">
      <FicheEtablissementForm fiche={restaurant} />
    </div>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { FicheEtablissementForm } from "@/components/FicheEtablissementForm";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOUTON_SECONDAIRE } from "@/lib/ui";

export const metadata: Metadata = { title: "Ma fiche" };

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
      description: true,
      capacite: true,
      delaiAnnulationHeures: true,
      photoMisAJourLe: true,
    },
  });
  if (!restaurant) notFound();

  return (
    <>
      <EnteteEspace
        titre="Ma fiche établissement"
        description="C'est ce que voient les dîneurs avant de réserver : nom, adresse, capacité et photo. Les horaires, eux, se déclarent sur « Mes disponibilités »."
        actions={
          <Link href={`/restaurants/${restaurant.id}`} className={BOUTON_SECONDAIRE}>
            Voir ma fiche publique
          </Link>
        }
      />

      <div className="max-w-xl">
        <FicheEtablissementForm fiche={restaurant} />
      </div>
    </>
  );
}

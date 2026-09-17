import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";

import { modifierRestaurant } from "@/app/admin/restaurants/actions";
import { EnteteEspace } from "@/components/EnteteEspace";
import { RestaurantForm } from "@/components/RestaurantForm";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { prisma } from "@/lib/prisma";

/**
 * `generateMetadata` et la page ont besoin du même restaurant. Sans `cache`,
 * Next.js exécute les deux fonctions pour une même requête et Prisma part
 * deux fois en base — la mémoïsation de Next ne couvre que `fetch`.
 */
const lireRestaurant = cache((id: string) => prisma.restaurant.findUnique({ where: { id } }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurant = await lireRestaurant(id);
  return { title: restaurant ? `Modifier ${restaurant.nom}` : "Modifier" };
}

/** La garde d'accès est faite une fois dans le layout parent. */
export default async function ModifierRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerSessionStaff();

  const { id } = await params;
  const restaurant = await lireRestaurant(id);
  if (!restaurant) notFound();

  return (
    <>
      <Link
        href={`/admin/restaurants/${id}`}
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-staff)] hover:underline"
      >
        ← Retour à la fiche
      </Link>

      <EnteteEspace
        titre={`Modifier ${restaurant.nom}`}
        description="Chaque champ modifié est consigné dans le journal d'audit, avec sa valeur avant et après."
      />

      <div className="max-w-xl">
        <RestaurantForm
          action={modifierRestaurant.bind(null, id)}
          libelleBouton="Enregistrer"
          valeursInitiales={{
            nom: restaurant.nom,
            ville: restaurant.ville,
            cuisine: restaurant.cuisine,
            adresse: restaurant.adresse,
            horaires: restaurant.horaires,
            description: restaurant.description,
            capacite: restaurant.capacite,
          }}
        />
      </div>
    </>
  );
}

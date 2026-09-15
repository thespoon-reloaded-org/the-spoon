import { notFound } from "next/navigation";
import Link from "next/link";

import { modifierRestaurant } from "@/app/admin/restaurants/actions";
import { EnteteEspace } from "@/components/EnteteEspace";
import { RestaurantForm } from "@/components/RestaurantForm";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id }, select: { nom: true } });
  return { title: restaurant ? `Modifier ${restaurant.nom}` : "Modifier" };
}

/** La garde d'accès est faite une fois dans le layout parent. */
export default async function ModifierRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
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

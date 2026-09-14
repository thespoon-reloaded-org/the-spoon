import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { modifierRestaurant } from "@/app/admin/restaurants/actions";
import { RestaurantForm } from "@/components/RestaurantForm";
import { authAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ModifierRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link
        href={`/admin/restaurants/${id}`}
        className="text-sm text-[var(--color-ink-muted)] hover:underline"
      >
        ← Retour à la fiche
      </Link>

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Modifier {restaurant.nom}
      </h1>

      <div className="mt-6">
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
    </main>
  );
}

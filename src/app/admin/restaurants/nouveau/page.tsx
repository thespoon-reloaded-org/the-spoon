import type { Metadata } from "next";
import Link from "next/link";

import { creerRestaurant } from "@/app/admin/restaurants/actions";
import { EnteteEspace } from "@/components/EnteteEspace";
import { RestaurantForm } from "@/components/RestaurantForm";
import { exigerSessionStaff } from "@/lib/garde-staff";

export const metadata: Metadata = { title: "Nouveau restaurant" };

export default async function NouveauRestaurantPage() {
  await exigerSessionStaff();

  return (
    <>
      <Link
        href="/admin/restaurants"
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-staff)] hover:underline"
      >
        ← Tous les restaurants
      </Link>

      <EnteteEspace
        titre="Nouveau restaurant"
        description="La création est tracée dans le journal d'audit de l'établissement."
      />

      <div className="max-w-xl">
        <RestaurantForm action={creerRestaurant} libelleBouton="Créer" />
      </div>
    </>
  );
}

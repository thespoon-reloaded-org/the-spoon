import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { creerRestaurant } from "@/app/admin/restaurants/actions";
import { RestaurantForm } from "@/components/RestaurantForm";
import { authAdmin } from "@/lib/auth";

export default async function NouveauRestaurantPage() {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Link href="/admin" className="text-sm text-[var(--color-ink-muted)] hover:underline">
        ← Retour à la console
      </Link>

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Nouveau restaurant
      </h1>

      <div className="mt-6">
        <RestaurantForm action={creerRestaurant} libelleBouton="Créer" />
      </div>
    </main>
  );
}

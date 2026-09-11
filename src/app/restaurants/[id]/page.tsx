import { notFound } from "next/navigation";
import Link from "next/link";

import { NoteCuilleres } from "@/components/NoteCuilleres";
import { prisma } from "@/lib/prisma";

export default async function FicheRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id } });

  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-[var(--color-ink-muted)] hover:underline">
        ← Retour à la recherche
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{restaurant.nom}</h1>
      <p className="text-[var(--color-ink-muted)]">
        {restaurant.cuisine} · {restaurant.ville}
      </p>

      <div className="mt-3">
        <NoteCuilleres note={restaurant.noteCuilleres} nombreAvis={restaurant.nombreAvis} />
      </div>

      {restaurant.description && <p className="mt-6">{restaurant.description}</p>}

      <dl className="mt-6 space-y-1 text-sm text-[var(--color-ink-muted)]">
        <div>
          <dt className="inline font-medium text-[var(--color-ink)]">Adresse : </dt>
          <dd className="inline">{restaurant.adresse}</dd>
        </div>
        {restaurant.capacite && (
          <div>
            <dt className="inline font-medium text-[var(--color-ink)]">Capacité : </dt>
            <dd className="inline">{restaurant.capacite} couverts</dd>
          </div>
        )}
      </dl>

      {/* La réservation arrive avec la story suivante (Réservation / booking). */}
    </main>
  );
}

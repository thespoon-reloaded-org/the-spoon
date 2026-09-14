import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { modifierPlat } from "../actions";
import { PlatForm } from "@/components/PlatForm";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ModifierPlatPage({
  params,
}: {
  params: Promise<{ id: string; platId: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");

  const { id, platId } = await params;
  if (session.user.restaurantId !== id) redirect(`/restaurants/${session.user.restaurantId}/menu`);

  const plat = await prisma.platCuillere.findUnique({ where: { id: platId } });
  if (!plat || plat.restaurantId !== id) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href={`/restaurants/${id}/menu`}
        className="text-sm text-[var(--color-ink-muted)] hover:underline"
      >
        ← Mon menu
      </Link>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Modifier « {plat.nom} »
      </h1>

      <div className="mt-6">
        <PlatForm
          action={modifierPlat.bind(null, id, platId)}
          plat={plat}
          libelleSoumission="Enregistrer"
        />
      </div>
    </main>
  );
}

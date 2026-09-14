import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { modifierPlat } from "../actions";
import { PlatForm } from "@/components/PlatForm";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW } from "@/lib/ui";

export default async function ModifierPlatPage({
  params,
}: {
  params: Promise<{ platId: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null; // garde déjà faite par le layout, satisfait TypeScript

  const { platId } = await params;
  const plat = await prisma.platCuillere.findUnique({ where: { id: platId } });
  if (!plat || plat.restaurantId !== session.user.restaurantId) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/espace-restaurant/menu"
          className="text-sm text-[var(--color-ink-muted)] hover:underline"
        >
          ← Ma carte
        </Link>
        <h2 className={`${EYEBROW} mt-3`}>Modifier « {plat.nom} »</h2>
      </div>

      <div className={CARTE}>
        <PlatForm action={modifierPlat.bind(null, platId)} plat={plat} libelleSoumission="Enregistrer" />
      </div>
    </div>
  );
}

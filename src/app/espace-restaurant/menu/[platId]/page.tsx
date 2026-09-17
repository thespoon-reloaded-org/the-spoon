import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { modifierPlat, trouverPlatDuRestaurant } from "../actions";
import { EnteteEspace } from "@/components/EnteteEspace";
import { PlatForm } from "@/components/PlatForm";
import { authRestaurant } from "@/lib/auth";
import { CARTE } from "@/lib/ui";

export const metadata: Metadata = { title: "Modifier un plat" };

export default async function ModifierPlatPage({
  params,
}: {
  params: Promise<{ platId: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null; // garde déjà faite par le layout, satisfait TypeScript

  const { platId } = await params;
  const plat = await trouverPlatDuRestaurant(platId, session.user.restaurantId);
  if (!plat) notFound();

  return (
    <>
      <Link
        href="/espace-restaurant/menu"
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-pro)] hover:underline"
      >
        ← Ma carte
      </Link>

      <EnteteEspace titre={`Modifier « ${plat.nom} »`} />

      <div className={`${CARTE} max-w-xl`}>
        <PlatForm
          action={modifierPlat.bind(null, platId)}
          plat={plat}
          libelleSoumission="Enregistrer"
        />
      </div>
    </>
  );
}

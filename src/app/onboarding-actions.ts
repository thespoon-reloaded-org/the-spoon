"use server";

import { headers } from "next/headers";

import { auth, authAdmin, authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CleUnivers } from "@/lib/univers";

/**
 * Retient qu'une personne est allée au bout de son onboarding, pour qu'il ne
 * se rouvre plus tout seul.
 *
 * Une action pour les trois univers, mais jamais un identifiant venu du
 * client : chacun résout sa propre session, sur sa propre instance
 * better-auth et sa propre table. Un dîneur ne peut pas marquer l'onboarding
 * d'un membre du staff en changeant un paramètre.
 *
 * Silencieuse : rien à afficher, et un visiteur non connecté (le parcours
 * dîneur est ouvert à tous) n'a simplement rien à retenir.
 *
 * Posée à la racine de `app/` et pas à côté d'une route, contrairement aux
 * autres actions du dépôt : celle-ci est appelée depuis les trois univers, et
 * la ranger sous l'un d'eux laisserait croire qu'elle lui appartient.
 */
export async function marquerOnboardingVu(univers: CleUnivers): Promise<void> {
  const enTetes = await headers();
  const vuLe = new Date();

  if (univers === "client") {
    const session = await auth.api.getSession({ headers: enTetes });
    if (session) {
      await prisma.user.update({ where: { id: session.user.id }, data: { onboardingVuLe: vuLe } });
    }
    return;
  }

  if (univers === "restaurant") {
    const session = await authRestaurant.api.getSession({ headers: enTetes });
    if (session) {
      await prisma.restaurantContact.update({
        where: { id: session.user.id },
        data: { onboardingVuLe: vuLe },
      });
    }
    return;
  }

  const session = await authAdmin.api.getSession({ headers: enTetes });
  if (session) {
    await prisma.staff.update({ where: { id: session.user.id }, data: { onboardingVuLe: vuLe } });
  }
}

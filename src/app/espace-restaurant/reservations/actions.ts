"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { capaciteEffective } from "@/lib/reservation";
import { couvertsServisAcceptes, couvertsServisMaximum } from "@/lib/signalement-bornes";

const schemaSignalement = z
  .object({
    bookingId: z.string(),
    statut: z.enum(["HONOREE", "NO_SHOW"]),
    couvertsServis: z.coerce.number().int().min(1).optional(),
  })
  .refine((donnees) => donnees.statut !== "HONOREE" || donnees.couvertsServis !== undefined, {
    message: "Indique le nombre de couverts servis.",
    path: ["couvertsServis"],
  });

export type EtatSignalement = { erreur?: string; ok?: boolean };

/**
 * Marque une réservation honorée ou no-show — LE geste qui débloque la
 * facturation (voir "Schéma réservation & facturation"). Ne fait jamais
 * confiance à ce que le client affichait : la réservation est recherchée
 * scopée au restaurant du contact connecté, et seul un créneau CONFIRMEE déjà
 * passé peut être signalé (pas encore passé, déjà annulé ou déjà signalé).
 * `signaleeLe` capture l'horodatage du signalement, distinct de `createdAt`.
 */
export async function marquerReservation(
  bookingId: string,
  statut: "HONOREE" | "NO_SHOW",
  _etatPrecedent: EtatSignalement,
  formData: FormData,
): Promise<EtatSignalement> {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");

  const couvertsServisSaisis = formData.get("couvertsServis");
  const donnees = schemaSignalement.safeParse({
    bookingId,
    statut,
    // Un champ vidé renvoie "" (pas null) — sans ce garde, z.coerce.number()
    // le convertirait en 0, qui échoue .min(1) avec le message générique de
    // Zod au lieu du message dédié du .refine ci-dessus.
    couvertsServis: couvertsServisSaisis === "" ? undefined : (couvertsServisSaisis ?? undefined),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Réservation introuvable." };
  }

  const reservation = await prisma.booking.findFirst({
    where: { id: donnees.data.bookingId, restaurantId: session.user.restaurantId },
    include: { restaurant: { select: { capacite: true } } },
  });
  if (!reservation) {
    return { erreur: "Réservation introuvable." };
  }
  if (reservation.statut !== "CONFIRMEE") {
    return { erreur: "Cette réservation a déjà été traitée." };
  }
  if (reservation.date.getTime() > Date.now()) {
    return { erreur: "Ce créneau n'est pas encore passé." };
  }

  // La borne elle-même vit dans `src/lib/signalement-bornes.ts`.
  const couvertsServis = donnees.data.couvertsServis;
  if (donnees.data.statut === "HONOREE" && couvertsServis !== undefined) {
    const bornes = {
      couvertsReserves: reservation.couverts,
      capacite: capaciteEffective(reservation.restaurant.capacite),
    };
    if (!couvertsServisAcceptes(couvertsServis, bornes)) {
      return {
        erreur: `${couvertsServis} couverts servis, c'est trop : ${couvertsServisMaximum(bornes)} au plus pour cette réservation. Vérifie la saisie.`,
      };
    }
  }

  let resultat: { count: number };
  try {
    // `updateMany` avec `statut: "CONFIRMEE"` dans le WHERE rend le
    // check-then-act atomique : si deux signalements arrivent en même temps
    // (double clic, retry réseau), un seul verra `count === 1` — l'autre
    // trouve `count === 0` et sait qu'il a perdu la course, plutôt que
    // d'écraser silencieusement le premier signalement.
    resultat = await prisma.booking.updateMany({
      where: { id: reservation.id, statut: "CONFIRMEE" },
      data: {
        statut: donnees.data.statut,
        signaleeLe: new Date(),
        couvertsServis: donnees.data.statut === "HONOREE" ? donnees.data.couvertsServis : null,
      },
    });
  } catch {
    return { erreur: "Impossible d'enregistrer le signalement, réessaie." };
  }
  if (resultat.count === 0) {
    return { erreur: "Cette réservation a déjà été traitée." };
  }

  revalidatePath("/espace-restaurant/reservations");
  return { ok: true };
}

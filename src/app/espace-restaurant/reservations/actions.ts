"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schemaSignalement = z.object({
  bookingId: z.string(),
  statut: z.enum(["HONOREE", "NO_SHOW"]),
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
  _formData: FormData,
): Promise<EtatSignalement> {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");

  const donnees = schemaSignalement.safeParse({ bookingId, statut });
  if (!donnees.success) {
    return { erreur: "Réservation introuvable." };
  }

  const reservation = await prisma.booking.findFirst({
    where: { id: donnees.data.bookingId, restaurantId: session.user.restaurantId },
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

  try {
    await prisma.booking.update({
      where: { id: reservation.id },
      data: { statut: donnees.data.statut, signaleeLe: new Date() },
    });
  } catch {
    return { erreur: "Impossible d'enregistrer le signalement, réessaie." };
  }

  revalidatePath("/espace-restaurant/reservations");
  return { ok: true };
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schemaAnnulation = z.object({ bookingId: z.string() });

export type EtatAnnulation = { erreur?: string; ok?: boolean };

/**
 * Annule une réservation du dîneur connecté. Ne fait jamais confiance à ce
 * que le client affichait : la réservation est recherchée scopée à
 * `userId: session.user.id`, pour qu'un dîneur ne puisse jamais annuler la
 * réservation de quelqu'un d'autre.
 */
export async function annulerReservation(
  bookingId: string,
  _etatPrecedent: EtatAnnulation,
  _formData: FormData,
): Promise<EtatAnnulation> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const donnees = schemaAnnulation.safeParse({ bookingId });
  if (!donnees.success) {
    return { erreur: "Réservation introuvable." };
  }

  const reservation = await prisma.booking.findFirst({
    where: { id: donnees.data.bookingId, userId: session.user.id },
  });
  if (!reservation) {
    return { erreur: "Réservation introuvable." };
  }
  if (reservation.statut === "ANNULEE") {
    return { erreur: "Cette réservation est déjà annulée." };
  }
  if (reservation.date.getTime() <= Date.now()) {
    return { erreur: "Ce créneau est déjà passé, impossible d'annuler." };
  }

  try {
    await prisma.booking.update({
      where: { id: reservation.id },
      data: { statut: "ANNULEE" },
    });
  } catch {
    return { erreur: "Impossible d'annuler la réservation, réessaie." };
  }

  revalidatePath("/mes-reservations");
  return { ok: true };
}

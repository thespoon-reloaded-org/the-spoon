"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { annulabilite, MESSAGES_REFUS_ANNULATION, peutPrevenirAbsence } from "@/lib/annulation";
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
    include: { restaurant: { select: { delaiAnnulationHeures: true } } },
  });
  if (!reservation) {
    return { erreur: "Réservation introuvable." };
  }

  // Même règle que celle qui décide d'afficher le bouton : ce que le dîneur a
  // vu et ce que le serveur accepte ne peuvent pas diverger. L'écran a pu
  // être chargé avant que le délai ne tombe.
  const verdict = annulabilite(reservation, reservation.restaurant.delaiAnnulationHeures);
  if (!verdict.annulable) {
    return { erreur: MESSAGES_REFUS_ANNULATION[verdict.raison] };
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
  revalidatePath("/espace-restaurant/reservations");
  return { ok: true };
}

export type EtatAbsence = { erreur?: string; ok?: boolean };

/**
 * Le dîneur prévient qu'il ne viendra pas, une fois le délai d'annulation
 * dépassé. Ne change pas le statut : la réservation reste CONFIRMEE et c'est
 * le restaurant qui tranchera honoré/no-show. Sans ce geste, un dîneur
 * empêché n'a plus aucun moyen de le dire et le no-show est mécanique —
 * exactement ce que le produit cherche à réduire.
 */
export async function signalerAbsence(
  bookingId: string,
  _etatPrecedent: EtatAbsence,
  _formData: FormData,
): Promise<EtatAbsence> {
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
  if (!peutPrevenirAbsence(reservation)) {
    return { erreur: "Ce créneau est passé, ou vous avez déjà prévenu." };
  }

  try {
    await prisma.booking.update({
      where: { id: reservation.id },
      data: { absencePrevenueLe: new Date() },
    });
  } catch {
    return { erreur: "Impossible d'enregistrer, réessaie." };
  }

  revalidatePath("/mes-reservations");
  revalidatePath("/espace-restaurant/reservations");
  return { ok: true };
}

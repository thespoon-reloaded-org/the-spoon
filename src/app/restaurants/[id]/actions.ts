"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { construireDateCreneau, estDansLaFenetreReservable, TAILLES_TABLE } from "@/lib/creneaux";
import { prisma } from "@/lib/prisma";

const schemaReservation = z.object({
  jourIso: z.string(),
  creneau: z.string(),
  couverts: z.coerce.number().int(),
});

export type EtatReservation = { erreur?: string; ok?: boolean };

/**
 * Crée une réservation. Ne fait jamais confiance à ce que le client affichait
 * (session, créneau) : tout est revérifié ici avant l'écriture en base.
 */
export async function creerReservation(
  restaurantId: string,
  _etatPrecedent: EtatReservation,
  formData: FormData,
): Promise<EtatReservation> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const donnees = schemaReservation.safeParse({
    jourIso: formData.get("jourIso"),
    creneau: formData.get("creneau"),
    couverts: formData.get("couverts"),
  });

  if (!donnees.success || !TAILLES_TABLE.some((t) => t.valeur === donnees.data.couverts)) {
    return { erreur: "Sélection invalide — choisis un nombre de convives, un jour et un créneau." };
  }

  const date = construireDateCreneau(donnees.data.jourIso, donnees.data.creneau);
  if (!date || !estDansLaFenetreReservable(date)) {
    return { erreur: "Ce créneau n'est plus disponible, choisis-en un autre." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true },
  });
  if (!restaurant) {
    return { erreur: "Restaurant introuvable." };
  }

  try {
    await prisma.booking.create({
      data: { restaurantId, userId: session.user.id, date, couverts: donnees.data.couverts },
    });
  } catch {
    return { erreur: "Impossible d'enregistrer la réservation, réessaie." };
  }

  revalidatePath(`/restaurants/${restaurantId}/reservations`);
  return { ok: true };
}

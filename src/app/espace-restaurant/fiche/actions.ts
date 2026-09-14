"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schemaFiche = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  ville: z.string().trim().min(1, "La ville est obligatoire."),
  cuisine: z.string().trim().min(1, "Le type de cuisine est obligatoire."),
  adresse: z.string().trim().min(1, "L'adresse est obligatoire."),
  horaires: z
    .string()
    .trim()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  description: z
    .string()
    .trim()
    .max(1000, "Description trop longue (1000 caractères max).")
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  capacite: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  delaiAnnulationHeures: z.coerce
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export type EtatFiche = { erreur?: string; ok?: boolean };

/**
 * Met à jour la fiche établissement du restaurant du contact connecté —
 * jusqu'ici alimentée uniquement par le seed. Scopée à
 * `session.user.restaurantId` : un contact ne peut modifier que son propre
 * établissement, jamais un id passé par le client.
 */
export async function mettreAJourFiche(
  _etatPrecedent: EtatFiche,
  formData: FormData,
): Promise<EtatFiche> {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return { erreur: "Session expirée, reconnecte-toi." };

  const donnees = schemaFiche.safeParse({
    nom: formData.get("nom"),
    ville: formData.get("ville"),
    cuisine: formData.get("cuisine"),
    adresse: formData.get("adresse"),
    horaires: formData.get("horaires"),
    description: formData.get("description"),
    capacite: formData.get("capacite"),
    delaiAnnulationHeures: formData.get("delaiAnnulationHeures"),
  });

  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Fiche invalide." };
  }

  try {
    await prisma.restaurant.update({
      where: { id: session.user.restaurantId },
      data: donnees.data,
    });
  } catch {
    return { erreur: "Impossible d'enregistrer la fiche, réessaie." };
  }

  revalidatePath("/espace-restaurant/fiche");
  revalidatePath(`/restaurants/${session.user.restaurantId}`);
  revalidatePath("/");
  return { ok: true };
}

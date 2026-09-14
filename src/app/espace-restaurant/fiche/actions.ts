"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authRestaurant } from "@/lib/auth";
import { validerImage } from "@/lib/photos";
import { prisma } from "@/lib/prisma";
import { getRestaurantsPhotosStore } from "@/lib/restaurants-photos";

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

export type EtatFiche = { erreur?: string; ok?: boolean; avertissement?: string };

function lirePhoto(formData: FormData): File | null {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  return photo;
}

/**
 * Envoie la photo sur le store (Netlify Blobs en prod, disque local en dev —
 * voir `getRestaurantsPhotosStore`). Si l'écriture échoue, on ne bloque pas
 * l'enregistrement de la fiche pour autant — juste un avertissement affiché
 * à l'utilisateur au lieu de laisser croire que tout s'est bien passé (même
 * logique que `sauvegarderPhoto` pour les plats).
 */
async function sauvegarderPhoto(restaurantId: string, photo: File): Promise<string | null> {
  try {
    await getRestaurantsPhotosStore().set(restaurantId, photo, {
      metadata: { contentType: photo.type },
    });
    return null;
  } catch (erreur) {
    console.error("Échec de l'upload de la photo du restaurant (stockage indisponible) :", erreur);
    return "Fiche enregistrée, mais la photo n'a pas pu être envoyée — réessaie plus tard.";
  }
}

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

  const photo = lirePhoto(formData);
  if (photo) {
    const erreurPhoto = validerImage(photo);
    if (erreurPhoto) return { erreur: erreurPhoto };
  }

  // La photo part avant l'update pour que photoMisAJourLe rejoigne les
  // autres champs dans la même écriture (même raisonnement que
  // modifierPlat côté menu).
  let avertissement: string | undefined;
  if (photo) {
    const erreurPhoto = await sauvegarderPhoto(session.user.restaurantId, photo);
    if (erreurPhoto) avertissement = erreurPhoto;
  }

  try {
    await prisma.restaurant.update({
      where: { id: session.user.restaurantId },
      data: {
        ...donnees.data,
        ...(photo && !avertissement ? { photoMisAJourLe: new Date() } : {}),
      },
    });
  } catch {
    return { erreur: "Impossible d'enregistrer la fiche, réessaie." };
  }

  revalidatePath("/espace-restaurant/fiche");
  revalidatePath(`/restaurants/${session.user.restaurantId}`);
  revalidatePath("/");
  return { ok: true, avertissement };
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authRestaurant } from "@/lib/auth";
import { getPlatsPhotosStore } from "@/lib/plats-photos";
import { prisma } from "@/lib/prisma";

const TAILLE_MAX_PHOTO = 5 * 1024 * 1024; // 5 Mo

const schemaPlat = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom du plat est obligatoire.")
    .max(80, "Nom trop long (80 caractères max)."),
  description: z
    .string()
    .trim()
    .max(500, "Description trop longue (500 caractères max).")
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  categorie: z.enum(["ENTREE", "PLAT", "DESSERT"], {
    message: "Choisis une catégorie : entrée, plat ou dessert.",
  }),
  prixEuros: z.coerce
    .number({ message: "Indique un prix." })
    .positive("Le prix doit être supérieur à 0."),
});

export type EtatPlat = { erreur?: string };

function lirePhoto(formData: FormData): File | null {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  return photo;
}

function validerPhoto(photo: File): string | null {
  if (!photo.type.startsWith("image/")) return "La photo doit être une image.";
  if (photo.size > TAILLE_MAX_PHOTO) return "Photo trop lourde (5 Mo max).";
  return null;
}

/**
 * Envoie la photo sur le store (Netlify Blobs en prod, disque local en dev —
 * voir `getPlatsPhotosStore`). Si l'écriture échoue quand même (disque plein,
 * permissions...), on ne bloque pas l'enregistrement du plat pour autant (nom,
 * description, catégorie, prix sont déjà en base) — juste un warning serveur
 * plutôt qu'un plantage.
 */
async function sauvegarderPhoto(platId: string, photo: File): Promise<void> {
  try {
    await getPlatsPhotosStore().set(platId, photo, { metadata: { contentType: photo.type } });
    await prisma.platCuillere.update({
      where: { id: platId },
      data: { photoMisAJourLe: new Date() },
    });
  } catch (erreur) {
    console.error("Échec de l'upload de la photo du plat (stockage indisponible) :", erreur);
  }
}

/** Vérifie que le contact connecté gère bien CE restaurant, sinon redirige. */
async function garantirProprietaire(restaurantId: string) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");
  if (session.user.restaurantId !== restaurantId) {
    redirect(`/restaurants/${session.user.restaurantId}/menu`);
  }
  return session;
}

/**
 * Ajoute un plat à la carte du restaurant connecté. La photo (facultative)
 * part dans le même envoi que le texte — un seul formulaire, un seul geste —
 * d'où le relèvement de `experimental.serverActions.bodySizeLimit` dans
 * next.config.ts (le défaut de 1 Mo est trop juste pour une photo).
 */
export async function creerPlat(
  restaurantId: string,
  _etatPrecedent: EtatPlat,
  formData: FormData,
): Promise<EtatPlat> {
  await garantirProprietaire(restaurantId);

  const donnees = schemaPlat.safeParse({
    nom: formData.get("nom"),
    description: formData.get("description"),
    categorie: formData.get("categorie"),
    prixEuros: formData.get("prixEuros"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const photo = lirePhoto(formData);
  if (photo) {
    const erreurPhoto = validerPhoto(photo);
    if (erreurPhoto) return { erreur: erreurPhoto };
  }

  const plat = await prisma.platCuillere.create({
    data: {
      restaurantId,
      nom: donnees.data.nom,
      description: donnees.data.description,
      categorie: donnees.data.categorie,
      prixCentimes: Math.round(donnees.data.prixEuros * 100),
    },
  });

  if (photo) {
    await sauvegarderPhoto(plat.id, photo);
  }

  revalidatePath(`/restaurants/${restaurantId}/menu`);
  revalidatePath(`/restaurants/${restaurantId}`);
  redirect(`/restaurants/${restaurantId}/menu`);
}

/** Modifie un plat existant (texte et/ou remplacement de la photo). */
export async function modifierPlat(
  restaurantId: string,
  platId: string,
  _etatPrecedent: EtatPlat,
  formData: FormData,
): Promise<EtatPlat> {
  await garantirProprietaire(restaurantId);

  const plat = await prisma.platCuillere.findUnique({ where: { id: platId } });
  if (!plat || plat.restaurantId !== restaurantId) {
    return { erreur: "Plat introuvable." };
  }

  const donnees = schemaPlat.safeParse({
    nom: formData.get("nom"),
    description: formData.get("description"),
    categorie: formData.get("categorie"),
    prixEuros: formData.get("prixEuros"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const photo = lirePhoto(formData);
  if (photo) {
    const erreurPhoto = validerPhoto(photo);
    if (erreurPhoto) return { erreur: erreurPhoto };
  }

  await prisma.platCuillere.update({
    where: { id: platId },
    data: {
      nom: donnees.data.nom,
      description: donnees.data.description,
      categorie: donnees.data.categorie,
      prixCentimes: Math.round(donnees.data.prixEuros * 100),
    },
  });

  if (photo) {
    await sauvegarderPhoto(platId, photo);
  }

  revalidatePath(`/restaurants/${restaurantId}/menu`);
  revalidatePath(`/restaurants/${restaurantId}`);
  redirect(`/restaurants/${restaurantId}/menu`);
}

/** Supprime un plat de la carte (et sa photo si présente). */
export async function supprimerPlat(
  restaurantId: string,
  platId: string,
  _etatPrecedent: EtatPlat,
  _formData: FormData,
): Promise<EtatPlat> {
  await garantirProprietaire(restaurantId);

  const plat = await prisma.platCuillere.findUnique({ where: { id: platId } });
  if (!plat || plat.restaurantId !== restaurantId) {
    return { erreur: "Plat introuvable." };
  }

  await prisma.platCuillere.delete({ where: { id: platId } });
  if (plat.photoMisAJourLe) {
    // Best effort : le plat doit disparaître même si le stockage est
    // indisponible (voir sauvegarderPhoto).
    await getPlatsPhotosStore()
      .delete(platId)
      .catch((erreur) => console.error("Échec de la suppression de la photo du plat :", erreur));
  }

  revalidatePath(`/restaurants/${restaurantId}/menu`);
  revalidatePath(`/restaurants/${restaurantId}`);
  return {};
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authRestaurant } from "@/lib/auth";
import { getPlatsPhotosStore } from "@/lib/plats-photos";
import { lirePhoto, sauvegarderPhotoEntite, validerImage } from "@/lib/photos";
import { prisma } from "@/lib/prisma";
import type { PlatCuillere } from "@/generated/prisma";

const MESSAGE_ECHEC_PHOTO = "Plat enregistré, mais la photo n'a pas pu être envoyée — réessaie plus tard.";

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
    .finite("Prix invalide.")
    .positive("Le prix doit être supérieur à 0.")
    .max(10000, "Prix trop élevé (10 000 € max)."),
});

export type EtatPlat = { erreur?: string; ok?: boolean; avertissement?: string };

function revaliderMenu(restaurantId: string) {
  revalidatePath("/espace-restaurant/menu");
  revalidatePath(`/restaurants/${restaurantId}`);
  revalidatePath("/");
}

/** Trouve un plat et vérifie qu'il appartient bien au restaurant du contact connecté. */
export async function trouverPlatDuRestaurant(
  platId: string,
  restaurantId: string,
): Promise<PlatCuillere | null> {
  const plat = await prisma.platCuillere.findUnique({ where: { id: platId } });
  return plat && plat.restaurantId === restaurantId ? plat : null;
}

/**
 * Ajoute un plat à la carte du restaurant du contact connecté. La photo
 * (facultative) part dans le même envoi que le texte — un seul formulaire,
 * un seul geste — d'où le relèvement de `experimental.serverActions.bodySizeLimit`
 * dans next.config.ts (le défaut de 1 Mo est trop juste pour une photo).
 */
export async function creerPlat(_etatPrecedent: EtatPlat, formData: FormData): Promise<EtatPlat> {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return { erreur: "Session expirée, reconnecte-toi." };

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
    const erreurPhoto = validerImage(photo);
    if (erreurPhoto) return { erreur: erreurPhoto };
  }

  // L'id du plat n'existe qu'une fois créé : la photo, elle, est indexée par
  // cet id, donc le create doit précéder l'upload — pas moyen de fusionner
  // les deux écritures ici (contrairement à modifierPlat, où l'id est déjà
  // connu avant la première écriture).
  const plat = await prisma.platCuillere.create({
    data: {
      restaurantId: session.user.restaurantId,
      nom: donnees.data.nom,
      description: donnees.data.description,
      categorie: donnees.data.categorie,
      prixCentimes: Math.round(donnees.data.prixEuros * 100),
    },
  });

  let avertissement: string | undefined;
  if (photo) {
    const erreurPhoto = await sauvegarderPhotoEntite(getPlatsPhotosStore(), plat.id, photo, MESSAGE_ECHEC_PHOTO);
    if (erreurPhoto) {
      avertissement = erreurPhoto;
    } else {
      await prisma.platCuillere.update({
        where: { id: plat.id },
        data: { photoMisAJourLe: new Date() },
      });
    }
  }

  revaliderMenu(session.user.restaurantId);
  return { ok: true, avertissement };
}

/** Modifie un plat existant (texte et/ou remplacement de la photo). Scopé à `session.user.restaurantId` — jamais un id passé par le client. */
export async function modifierPlat(
  platId: string,
  _etatPrecedent: EtatPlat,
  formData: FormData,
): Promise<EtatPlat> {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return { erreur: "Session expirée, reconnecte-toi." };

  const plat = await trouverPlatDuRestaurant(platId, session.user.restaurantId);
  if (!plat) return { erreur: "Plat introuvable." };

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
    const erreurPhoto = validerImage(photo);
    if (erreurPhoto) return { erreur: erreurPhoto };
  }

  // Contrairement à creerPlat, platId est déjà connu : la photo (si présente)
  // part avant l'update pour que photoMisAJourLe rejoigne les autres champs
  // dans la même écriture, au lieu d'un second aller-retour.
  let avertissement: string | undefined;
  if (photo) {
    const erreurPhoto = await sauvegarderPhotoEntite(getPlatsPhotosStore(), platId, photo, MESSAGE_ECHEC_PHOTO);
    if (erreurPhoto) avertissement = erreurPhoto;
  }

  try {
    await prisma.platCuillere.update({
      where: { id: platId },
      data: {
        nom: donnees.data.nom,
        description: donnees.data.description,
        categorie: donnees.data.categorie,
        prixCentimes: Math.round(donnees.data.prixEuros * 100),
        ...(photo && !avertissement ? { photoMisAJourLe: new Date() } : {}),
      },
    });
  } catch {
    // Le plat a pu être supprimé entre la vérification ci-dessus et cet
    // update (un autre onglet, un double clic) — message propre plutôt
    // qu'une erreur Prisma non attrapée.
    return { erreur: "Plat introuvable." };
  }

  revaliderMenu(session.user.restaurantId);
  return { ok: true, avertissement };
}

/** Supprime un plat de la carte (et sa photo si présente). Scopé à `session.user.restaurantId`. */
export async function supprimerPlat(
  platId: string,
  _etatPrecedent: EtatPlat,
  _formData: FormData,
): Promise<EtatPlat> {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return { erreur: "Session expirée, reconnecte-toi." };

  const plat = await trouverPlatDuRestaurant(platId, session.user.restaurantId);
  if (!plat) return { erreur: "Plat introuvable." };

  try {
    await prisma.platCuillere.delete({ where: { id: platId } });
  } catch {
    // Déjà supprimé entre-temps (autre onglet, double clic) — pas une erreur
    // pour l'utilisateur, le plat a bien disparu.
    revaliderMenu(session.user.restaurantId);
    return { ok: true };
  }

  if (plat.photoMisAJourLe) {
    // Best effort : le plat doit disparaître même si le stockage est
    // indisponible (voir sauvegarderPhotoEntite dans src/lib/photos.ts).
    await getPlatsPhotosStore()
      .delete(platId)
      .catch((erreur) => console.error("Échec de la suppression de la photo du plat :", erreur));
  }

  revaliderMenu(session.user.restaurantId);
  return { ok: true };
}

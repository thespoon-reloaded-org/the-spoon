import { creerStorePhotos } from "./photos";

export const TAILLE_MAX_PIECE_JOINTE = 5 * 1024 * 1024; // 5 Mo — même plafond que les photos (voir photos.ts)

/**
 * Types acceptés pour un justificatif de contestation — image ou PDF, jamais
 * SVG (même raison que TYPES_IMAGE_ACCEPTES dans photos.ts : un SVG peut
 * embarquer du JavaScript).
 */
const TYPES_ACCEPTES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

/** Valide un fichier envoyé comme pièce jointe d'un dossier de contestation. */
export function validerPieceJointeDossier(fichier: File): string | null {
  if (!TYPES_ACCEPTES.has(fichier.type)) return "Pièce jointe invalide (image ou PDF uniquement).";
  if (fichier.size > TAILLE_MAX_PIECE_JOINTE) return "Pièce jointe trop lourde (5 Mo max).";
  return null;
}

/**
 * Store des pièces jointes de dossiers de contestation — une entrée par
 * PieceJointeDossier, clé = id de cette ligne (voir schema.prisma). Sert une
 * route authentifiée, contrairement aux photos de plats/restaurants qui sont
 * publiques.
 */
export function getDossierPiecesJointesStore() {
  return creerStorePhotos("dossiers-pieces-jointes");
}

import { creerStorePhotos } from "./photos";

/**
 * Store des photos de plats — une entrée par plat, clé = id du plat (une
 * seule photo par plat, un nouvel upload remplace l'ancienne).
 */
export function getPlatsPhotosStore() {
  return creerStorePhotos("plats-photos");
}

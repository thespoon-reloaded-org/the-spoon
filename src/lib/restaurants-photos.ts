import { creerStorePhotos } from "./photos";

/**
 * Store des photos d'établissement — une entrée par restaurant, clé = id du
 * restaurant (une seule photo, un nouvel upload remplace l'ancienne).
 */
export function getRestaurantsPhotosStore() {
  return creerStorePhotos("restaurants-photos");
}

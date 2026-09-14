import type { CategoriePlat } from "@/generated/prisma";

/** Libellés affichés pour chaque catégorie — seule source de vérité, partagée par le formulaire et les deux écrans qui affichent un plat. */
export const LIBELLE_CATEGORIE: Record<CategoriePlat, string> = {
  ENTREE: "Entrée",
  PLAT: "Plat",
  DESSERT: "Dessert",
};

export const CATEGORIES = Object.entries(LIBELLE_CATEGORIE).map(([valeur, libelle]) => ({
  valeur: valeur as CategoriePlat,
  libelle,
}));

import type { RoleContactRestaurant } from "@/generated/prisma";

/** Libellés affichés pour chaque rôle — seule source de vérité, partagée par le formulaire d'ajout et la fiche admin qui affiche un contact. */
export const LIBELLE_ROLE_CONTACT: Record<RoleContactRestaurant, string> = {
  GERANT: "Gérant",
  CHEF_DE_SALLE: "Chef de salle",
};

export const ROLES_CONTACT = Object.entries(LIBELLE_ROLE_CONTACT).map(([valeur, libelle]) => ({
  valeur: valeur as RoleContactRestaurant,
  libelle,
}));

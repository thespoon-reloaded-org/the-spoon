"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const champTexteOptionnel = z
  .string()
  .trim()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null));

const schemaRestaurant = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  ville: z.string().trim().min(1, "La ville est obligatoire."),
  cuisine: z.string().trim().min(1, "Le type de cuisine est obligatoire."),
  adresse: z.string().trim().min(1, "L'adresse est obligatoire."),
  horaires: champTexteOptionnel,
  description: champTexteOptionnel,
  capacite: z.coerce.number().int().min(1).nullable().optional(),
});

export type EtatFormulaireRestaurant = { erreur?: string; ok?: boolean };

function lireDonneesFormulaire(formData: FormData) {
  const capaciteBrute = formData.get("capacite");
  return schemaRestaurant.safeParse({
    nom: formData.get("nom"),
    ville: formData.get("ville"),
    cuisine: formData.get("cuisine"),
    adresse: formData.get("adresse"),
    horaires: formData.get("horaires"),
    description: formData.get("description"),
    capacite: capaciteBrute && capaciteBrute !== "" ? capaciteBrute : null,
  });
}

/**
 * Crée un restaurant depuis la Console staff. Pas encore un ticket Notion
 * séparé — ajouté dans le prolongement de "Console staff : vue restaurants"
 * à la demande d'Elsa. Revérifie la session admin ici : jamais confiance
 * dans ce que le client affichait.
 */
export async function creerRestaurant(
  _etatPrecedent: EtatFormulaireRestaurant,
  formData: FormData,
): Promise<EtatFormulaireRestaurant> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = lireDonneesFormulaire(formData);
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const restaurant = await prisma.restaurant.create({ data: donnees.data });

  revalidatePath("/admin");
  redirect(`/admin/restaurants/${restaurant.id}`);
}

/**
 * Modifie un restaurant existant depuis la Console staff. Même logique que
 * `creerRestaurant` : session revérifiée, données revalidées côté serveur.
 */
export async function modifierRestaurant(
  restaurantId: string,
  _etatPrecedent: EtatFormulaireRestaurant,
  formData: FormData,
): Promise<EtatFormulaireRestaurant> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = lireDonneesFormulaire(formData);
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    await prisma.restaurant.update({ where: { id: restaurantId }, data: donnees.data });
  } catch {
    return { erreur: "Restaurant introuvable." };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  redirect(`/admin/restaurants/${restaurantId}`);
}

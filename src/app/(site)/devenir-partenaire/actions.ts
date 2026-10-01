"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";

const schemaDemandeContact = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom est obligatoire.")
    .max(100, "Nom trop long (100 caractères max)."),
  email: z
    .string()
    .trim()
    .min(1, "L'email est obligatoire.")
    .max(200, "Email trop long (200 caractères max).")
    .email("Email invalide."),
  etablissement: z
    .string()
    .trim()
    .min(1, "Le nom de l'établissement est obligatoire.")
    .max(150, "Nom d'établissement trop long (150 caractères max)."),
  adresse: z
    .string()
    .trim()
    .min(1, "L'adresse de l'établissement est obligatoire.")
    .max(250, "Adresse trop longue (250 caractères max)."),
  message: z
    .string()
    .trim()
    .min(1, "Décrivez brièvement votre demande.")
    .max(2000, "Message trop long (2000 caractères max)."),
});

export type EtatDemandeContact = { erreur?: string; ok?: boolean };

/**
 * Dépose une demande de contact restaurateur — depuis la landing ou l'écran
 * de connexion restaurant, pour un établissement pas encore référencé (voir
 * le modèle `DemandeContactRestaurateur`). Formulaire public, sans session :
 * seule la forme des données est vérifiée ici, rien d'autre à autoriser.
 */
export async function envoyerDemandeContactRestaurateur(
  _etatPrecedent: EtatDemandeContact,
  formData: FormData,
): Promise<EtatDemandeContact> {
  const donnees = schemaDemandeContact.safeParse({
    nom: formData.get("nom"),
    email: formData.get("email"),
    etablissement: formData.get("etablissement"),
    adresse: formData.get("adresse"),
    message: formData.get("message"),
  });

  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    await prisma.demandeContactRestaurateur.create({ data: donnees.data });
  } catch (erreur) {
    console.error("Échec de l'enregistrement d'une demande de contact restaurateur :", erreur);
    return { erreur: "Impossible d'envoyer votre demande, réessayez." };
  }

  return { ok: true };
}

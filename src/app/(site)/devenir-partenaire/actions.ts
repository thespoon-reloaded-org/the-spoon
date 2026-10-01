"use server";

import { schemaDemandeContact } from "@/lib/demande-contact-restaurateur";
import { prisma } from "@/lib/prisma";

export type EtatDemandeContact = { erreur?: string; ok?: boolean };

/**
 * Dépose une demande de contact restaurateur — depuis la landing ou l'écran
 * de connexion restaurant, pour un établissement pas encore référencé (voir
 * le modèle `DemandeContactRestaurateur`). Formulaire public, sans session :
 * seule la forme des données est vérifiée ici, rien d'autre à autoriser.
 *
 * La demande et son événement `DEPOT` partent dans la même transaction : le
 * journal commence au dépôt, et un dépôt sans première ligne serait un début
 * manquant plutôt qu'une demande sans histoire.
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
    siren: formData.get("siren"),
    urlGoogleMyBusiness: formData.get("urlGoogleMyBusiness"),
    menusALaCuillere: formData.get("menusALaCuillere"),
    message: formData.get("message"),
  });

  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const demande = await tx.demandeContactRestaurateur.create({ data: donnees.data });
      await tx.evenementDemandeRestaurateur.create({
        data: { demandeId: demande.id, type: "DEPOT" },
      });
    });
  } catch (erreur) {
    console.error("Échec de l'enregistrement d'une demande de contact restaurateur :", erreur);
    return { erreur: "Impossible d'envoyer votre demande, réessayez." };
  }

  return { ok: true };
}

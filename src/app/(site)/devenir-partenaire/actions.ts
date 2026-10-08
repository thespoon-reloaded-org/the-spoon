"use server";

import { schemaDemandeContact } from "@/lib/demande-contact-restaurateur";
import { deposerDemandesRestaurateur } from "@/lib/demandes-restaurateur";

export type EtatDemandeContact = { erreur?: string; ok?: boolean };

/**
 * Dépose une demande de contact restaurateur — depuis la landing ou l'écran
 * de connexion restaurant, pour un établissement pas encore référencé (voir
 * le modèle `DemandeContactRestaurateur`). Formulaire public, sans session :
 * seule la forme des données est vérifiée ici, rien d'autre à autoriser.
 * L'écriture, demande et journal, est `deposerDemandesRestaurateur`.
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
    await deposerDemandesRestaurateur([donnees.data]);
  } catch (erreur) {
    console.error("Échec de l'enregistrement d'une demande de contact restaurateur :", erreur);
    return { erreur: "Impossible d'envoyer votre demande, réessayez." };
  }

  return { ok: true };
}

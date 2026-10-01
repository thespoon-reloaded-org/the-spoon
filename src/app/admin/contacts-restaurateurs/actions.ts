"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ISSUES_DECISION_DEMANDE } from "@/lib/demande-labels";
import { deciderDemandeRestaurateur as deciderDemandeRestaurateurLib } from "@/lib/demandes-restaurateur";
import { exigerSessionStaff } from "@/lib/garde-staff";

const schemaDecision = z.object({
  issue: z.enum(ISSUES_DECISION_DEMANDE, { message: "Choisis l'issue de la demande." }),
  motif: z
    .string()
    .trim()
    .min(1, "Le motif est obligatoire : c'est ce que gardera le journal.")
    .max(2000, "Motif trop long (2000 caractères max)."),
});

export type EtatDecisionDemande = { erreur?: string; message?: string };

/**
 * Accepte ou rejette une demande de contact restaurateur depuis sa fiche
 * détail. Sous garde staff, comme le reste de la Console. La règle métier
 * (demande encore à qualifier, motif présent) est revalidée dans
 * `deciderDemandeRestaurateur` : le formulaire masque des champs, il ne les
 * protège pas.
 */
export async function deciderDemandeRestaurateur(
  demandeId: string,
  _etatPrecedent: EtatDecisionDemande,
  formData: FormData,
): Promise<EtatDecisionDemande> {
  const session = await exigerSessionStaff();

  const donnees = schemaDecision.safeParse({
    issue: formData.get("issue"),
    motif: formData.get("motif"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Décision invalide." };
  }

  const resultat = await deciderDemandeRestaurateurLib(
    demandeId,
    session.user.id,
    donnees.data.issue,
    donnees.data.motif,
  );
  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath(`/admin/contacts-restaurateurs/${demandeId}`);
  revalidatePath("/admin/contacts-restaurateurs");
  return { message: "Décision enregistrée." };
}

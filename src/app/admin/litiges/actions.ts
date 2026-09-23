"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authAdmin } from "@/lib/auth";
import {
  deciderDossier as deciderDossierLib,
  demanderComplementDossier as demanderComplementDossierLib,
  prendreEnChargeDossier as prendreEnChargeDossierLib,
} from "@/lib/contestation";

export type EtatPriseEnCharge = { erreur?: string; ok?: boolean };

export async function prendreEnChargeDossier(
  dossierId: string,
  _etatPrecedent: EtatPriseEnCharge,
): Promise<EtatPriseEnCharge> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const resultat = await prendreEnChargeDossierLib(dossierId, session.user.id);
  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath("/admin/litiges");
  return { ok: true };
}

const schemaComplement = z.object({
  message: z.string().trim().min(1, "Indique ce qui manque au dossier."),
});

export type EtatDemandeComplement = { erreur?: string; ok?: boolean };

export async function demanderComplementDossier(
  dossierId: string,
  _etatPrecedent: EtatDemandeComplement,
  formData: FormData,
): Promise<EtatDemandeComplement> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = schemaComplement.safeParse({ message: formData.get("message") });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Message invalide." };
  }

  const resultat = await demanderComplementDossierLib(
    dossierId,
    session.user.id,
    donnees.data.message,
  );
  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath(`/admin/litiges/${dossierId}`);
  return { ok: true };
}

const schemaDecision = z.object({
  issue: z.enum(["ACCORDE", "PARTIEL", "REFUSE", "ESCALADE"], { message: "Choisis une issue." }),
  /** Saisi en euros dans le formulaire, converti en centimes ici — comme le seuil de crédit d'office. */
  montantAccordeEuros: z.coerce
    .number({ message: "Indique le montant accordé." })
    .finite("Montant invalide.")
    .optional(),
  imputation: z.enum(["THESPOON", "CLIENT"], { message: "Indique qui porte le coût." }).optional(),
  motif: z
    .string()
    .trim()
    .min(1, "Motive la décision : c'est la réponse que reçoit le restaurant."),
});

export type EtatDecision = { erreur?: string; message?: string };

/**
 * "Décision & émission d'avoir" — enregistre l'issue de l'instruction et, le
 * cas échéant, l'avoir. Les règles métier (montant d'un accord partiel,
 * imputation cohérente avec l'issue) sont revalidées dans `deciderDossier`,
 * pas seulement ici : le formulaire masque des champs, il ne les protège pas.
 */
export async function deciderDossier(
  dossierId: string,
  _etatPrecedent: EtatDecision,
  formData: FormData,
): Promise<EtatDecision> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  // FormData rend `null` pour un champ absent du DOM (les champs conditionnels
  // de l'issue choisie) et "" pour un champ vide : les deux valent "non
  // renseigné" ici, alors que `z.coerce.number()` lirait 0.
  const valeurFacultative = (nom: string) => {
    const brut = formData.get(nom);
    return typeof brut === "string" && brut.trim() !== "" ? brut : undefined;
  };

  const donnees = schemaDecision.safeParse({
    issue: formData.get("issue"),
    montantAccordeEuros: valeurFacultative("montantAccordeEuros"),
    imputation: valeurFacultative("imputation"),
    motif: formData.get("motif"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Décision invalide." };
  }

  const resultat = await deciderDossierLib(dossierId, session.user.id, {
    issue: donnees.data.issue,
    montantAccordeCentimes:
      donnees.data.montantAccordeEuros === undefined
        ? null
        : Math.round(donnees.data.montantAccordeEuros * 100),
    imputation: donnees.data.imputation ?? null,
    motif: donnees.data.motif,
  });
  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath(`/admin/litiges/${dossierId}`);
  revalidatePath("/admin/litiges");
  return {
    message: resultat.avoirEmis
      ? "Décision enregistrée, avoir émis sur la facture."
      : "Décision enregistrée.",
  };
}

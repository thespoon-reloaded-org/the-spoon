"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authAdmin } from "@/lib/auth";
import {
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

  const resultat = await demanderComplementDossierLib(dossierId, session.user.id, donnees.data.message);
  if (!resultat.ok) return { erreur: resultat.erreur };

  revalidatePath(`/admin/litiges/${dossierId}`);
  return { ok: true };
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authAdmin } from "@/lib/auth";
import { genererFacturesMois } from "@/lib/facturation";

const schemaMois = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Mois invalide.")
  .transform((valeur) => {
    const [annee, moisIndex] = valeur.split("-");
    return new Date(Date.UTC(Number(annee), Number(moisIndex) - 1, 1));
  });

export type EtatGenerationFactures = { erreur?: string; resume?: string };

/**
 * Déclenche la génération des factures d'un mois donné (format "AAAA-MM").
 * Idempotent côté `genererFacturesMois` — relancer sur un mois déjà traité
 * ne recrée rien, donc pas besoin de garde supplémentaire ici.
 */
export async function genererFacturesDuMois(
  _etatPrecedent: EtatGenerationFactures,
  formData: FormData,
): Promise<EtatGenerationFactures> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = schemaMois.safeParse(formData.get("mois"));
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Mois invalide." };
  }

  const { facturesCreees, dejaExistantes } = await genererFacturesMois(donnees.data);

  revalidatePath("/admin/factures");
  return {
    resume: `${facturesCreees} facture${facturesCreees > 1 ? "s" : ""} créée${facturesCreees > 1 ? "s" : ""}, ${dejaExistantes} déjà existante${dejaExistantes > 1 ? "s" : ""}.`,
  };
}

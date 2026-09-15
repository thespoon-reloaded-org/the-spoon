"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schemaSeuil = z.object({
  seuilEuros: z.coerce
    .number({ message: "Indique un seuil." })
    .finite("Seuil invalide.")
    .positive("Le seuil doit être supérieur à 0."),
});

export type EtatSeuilContestation = { erreur?: string; ok?: boolean };

/**
 * Met à jour le seuil de crédit d'office ("Montant contesté dérivé & seuil
 * de crédit d'office") — la ligne singleton ConfigContestation, jamais une
 * constante de code : la valeur appliquée est copiée sur chaque dossier à sa
 * création (voir creerDossierContestation dans src/lib/contestation.ts), donc
 * modifier ce seuil ne réécrit jamais l'historique des dossiers déjà déposés.
 */
export async function mettreAJourSeuilContestation(
  _etatPrecedent: EtatSeuilContestation,
  formData: FormData,
): Promise<EtatSeuilContestation> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = schemaSeuil.safeParse({ seuilEuros: formData.get("seuilEuros") });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Seuil invalide." };
  }

  const seuilCentimes = Math.round(donnees.data.seuilEuros * 100);
  await prisma.configContestation.upsert({
    where: { id: "singleton" },
    update: { seuilCreditOfficeCentimes: seuilCentimes },
    create: { id: "singleton", seuilCreditOfficeCentimes: seuilCentimes },
  });

  revalidatePath("/admin/contestation");
  return { ok: true };
}

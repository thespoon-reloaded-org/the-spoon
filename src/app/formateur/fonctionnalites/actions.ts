"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { CleFonctionnalite } from "@/generated/prisma";
import { changerFonctionnalite, FONCTIONNALITES } from "@/lib/fonctionnalites";
import { exigerSessionFormateur } from "@/lib/garde-formateur";

const CLES = Object.keys(FONCTIONNALITES) as [CleFonctionnalite, ...CleFonctionnalite[]];

const schemaBascule = z.object({
  cle: z.enum(CLES, { message: "Fonctionnalité inconnue." }),
  active: z.enum(["oui", "non"]).transform((v) => v === "oui"),
});

export type EtatFonctionnalite = { erreur?: string; message?: string };

/**
 * Coupe ou rallume une fonctionnalité pour tout TheSpoon. Le formulaire
 * envoie l'état voulu, pas « inverser » (voir `changerFonctionnalite`).
 */
export async function basculerFonctionnalite(
  _etatPrecedent: EtatFonctionnalite,
  formData: FormData,
): Promise<EtatFonctionnalite> {
  const session = await exigerSessionFormateur();

  const donnees = schemaBascule.safeParse({
    cle: formData.get("cle"),
    active: formData.get("active"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Demande invalide." };
  }

  const { cle, active } = donnees.data;
  const { change } = await changerFonctionnalite(cle, active, session.user.id);
  revalidatePath("/formateur/fonctionnalites");

  if (!change) return { message: "Elle était déjà dans cet état : rien n'a changé." };
  return { message: active ? "Rallumée pour tout TheSpoon." : "Coupée pour tout TheSpoon." };
}

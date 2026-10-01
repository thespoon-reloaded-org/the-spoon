"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Le staff a envoyé le mail depuis sa messagerie : la demande sort de la
 * vue « À traiter ». Seule une demande analysée peut passer à `MAIL_ENVOYE`.
 */
export async function marquerMailEnvoye(id: string): Promise<void> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  await prisma.demandeContactRestaurateur.updateMany({
    where: { id, statut: { in: ["ACCEPTEE", "INFOS_MANQUANTES", "REFUSEE"] } },
    data: { statut: "MAIL_ENVOYE" },
  });
  revalidatePath("/admin/contacts-restaurateurs");
}

"use server";

import { randomUUID } from "node:crypto";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { MotifContestation } from "@/generated/prisma";
import { authRestaurant } from "@/lib/auth";
import { creerDossierContestation } from "@/lib/contestation";
import { LABELS_MOTIF_CONTESTATION } from "@/lib/contestation-labels";
import { getDossierPiecesJointesStore, validerPieceJointeDossier } from "@/lib/dossier-pieces-jointes";
import { sauvegarderPhotoEntite } from "@/lib/photos";
import { prisma } from "@/lib/prisma";

// Dérivé de LABELS_MOTIF_CONTESTATION plutôt que retapé : évite une
// troisième source de vérité pour la liste des motifs (schema.prisma +
// contestation-labels.ts + ce tuple), qui pourrait diverger silencieusement.
const MOTIFS = Object.keys(LABELS_MOTIF_CONTESTATION) as [MotifContestation, ...MotifContestation[]];

const schemaLigne = z.object({
  ligneFactureId: z.string().min(1),
  motif: z.enum(MOTIFS, { message: "Choisis un motif pour chaque ligne sélectionnée." }),
});

const schemaDepot = z.object({
  lignes: z.array(schemaLigne).min(1, "Sélectionne au moins une ligne à contester."),
  commentaire: z
    .string()
    .trim()
    .max(2000, "Commentaire trop long (2000 caractères max.).")
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type EtatDepotContestation = { erreur?: string; avertissement?: string };

/**
 * Dépose un dossier de contestation sur une ou plusieurs lignes d'une
 * facture du restaurant du contact connecté. La validation métier (délai,
 * appartenance des lignes, unicité) vit dans creerDossierContestation —
 * cette action ne fait que lire le formulaire et gérer les pièces jointes.
 */
export async function deposerContestation(
  factureId: string,
  _etatPrecedent: EtatDepotContestation,
  formData: FormData,
): Promise<EtatDepotContestation> {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-restaurant");

  const ligneIds = formData.getAll("ligneIds").map(String);
  const donnees = schemaDepot.safeParse({
    lignes: ligneIds.map((id) => ({ ligneFactureId: id, motif: formData.get(`motif-${id}`) })),
    commentaire: formData.get("commentaire"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const resultat = await creerDossierContestation({
    factureId,
    restaurantId: session.user.restaurantId,
    restaurantContactId: session.user.id,
    lignes: donnees.data.lignes,
    commentaire: donnees.data.commentaire,
  });
  if (!resultat.ok) {
    return { erreur: resultat.erreur };
  }

  const fichiers = formData
    .getAll("piecesJointes")
    .filter((fichier): fichier is File => fichier instanceof File && fichier.size > 0);

  let avertissement = false;
  for (const fichier of fichiers) {
    const erreurValidation = validerPieceJointeDossier(fichier);
    if (erreurValidation) {
      avertissement = true;
      continue;
    }

    // L'id est généré ici (et non par Prisma à la création) pour pouvoir
    // uploader AVANT d'écrire la métadonnée en base : si l'upload échoue (ou
    // si le process s'arrête entre les deux étapes), aucune ligne
    // PieceJointeDossier ne pointe vers un fichier qui n'existe pas — pas
    // besoin de suppression compensatoire. Les tirets sont retirés : la clé
    // sert aussi de nom de fichier sur le store disque local, qui exige
    // `/^[a-z0-9]+$/i` (voir src/lib/photos.ts).
    const pieceId = randomUUID().replace(/-/g, "");

    const erreurUpload = await sauvegarderPhotoEntite(
      getDossierPiecesJointesStore(),
      pieceId,
      fichier,
      "Pièce jointe non envoyée, réessaie depuis le dossier.",
    );
    if (erreurUpload) {
      // Best effort : le dossier reste valide même si une pièce jointe n'a
      // pas pu être envoyée (même philosophie que sauvegarderPhotoEntite).
      avertissement = true;
      continue;
    }

    await prisma.pieceJointeDossier.create({
      data: {
        id: pieceId,
        dossierId: resultat.dossierId,
        nomOriginal: fichier.name,
        typeMime: fichier.type,
        tailleOctets: fichier.size,
      },
    });
  }

  revalidatePath(`/espace-restaurant/factures/${factureId}`);
  redirect(
    `/espace-restaurant/factures/${factureId}/contester/${resultat.dossierId}${avertissement ? "?avertissement=1" : ""}`,
  );
}

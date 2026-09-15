import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { authAdmin, authRestaurant } from "@/lib/auth";
import { getDossierPiecesJointesStore } from "@/lib/dossier-pieces-jointes";
import { prisma } from "@/lib/prisma";

/**
 * Sert une pièce jointe d'un dossier de contestation — contrairement aux
 * photos de plats/restaurants (publiques), un justificatif de litige n'est
 * pas une donnée publique : accessible au contact restaurant propriétaire du
 * dossier (via sa facture) ou à tout membre du staff connecté.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dossierId: string; pieceId: string }> },
) {
  const { dossierId, pieceId } = await params;
  const requestHeaders = await headers();

  const sessionRestaurant = await authRestaurant.api.getSession({ headers: requestHeaders });
  const sessionAdmin = sessionRestaurant ? null : await authAdmin.api.getSession({ headers: requestHeaders });
  if (!sessionRestaurant && !sessionAdmin) {
    return new NextResponse(null, { status: 401 });
  }

  const piece = await prisma.pieceJointeDossier.findFirst({
    where: {
      id: pieceId,
      dossierId,
      ...(sessionRestaurant
        ? { dossier: { facture: { restaurantId: sessionRestaurant.user.restaurantId } } }
        : {}),
    },
  });
  if (!piece) return new NextResponse(null, { status: 404 });

  let resultat;
  try {
    resultat = await getDossierPiecesJointesStore().getWithMetadata(piece.id, { type: "blob" });
  } catch (erreur) {
    console.error("Pièce jointe de dossier indisponible :", erreur);
    resultat = null;
  }
  if (!resultat || !resultat.data) {
    return new NextResponse(null, { status: 404 });
  }

  // `nomOriginal` vient du nom de fichier envoyé par le navigateur, jamais
  // validé côté serveur : au-delà des guillemets, des retours à la ligne
  // (CR/LF) dans un en-tête HTTP feraient planter la construction de la
  // réponse (valeur d'en-tête invalide) — ils sont retirés en plus des
  // guillemets, pas seulement ces derniers.
  const nomFichierSurEnTete = piece.nomOriginal.replace(/["\r\n]/g, "");

  return new NextResponse(resultat.data, {
    headers: {
      "Content-Type": piece.typeMime,
      "Content-Disposition": `attachment; filename="${nomFichierSurEnTete}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

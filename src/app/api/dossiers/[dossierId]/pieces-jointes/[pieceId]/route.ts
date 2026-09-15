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

  return new NextResponse(resultat.data, {
    headers: {
      "Content-Type": piece.typeMime,
      "Content-Disposition": `attachment; filename="${piece.nomOriginal.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse } from "next/server";

import { getRestaurantsPhotosStore } from "@/lib/restaurants-photos";

/**
 * Sert la photo d'un établissement (voir `getRestaurantsPhotosStore`).
 * Public, comme la fiche restaurant elle-même : pas de vérification de
 * session ici, seule l'écriture (voir `mettreAJourFiche`) est réservée au
 * contact du restaurant.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let resultat;
  try {
    resultat = await getRestaurantsPhotosStore().getWithMetadata(id, { type: "blob" });
  } catch (erreur) {
    console.error("Photo de restaurant indisponible :", erreur);
    resultat = null;
  }

  if (!resultat || !resultat.data) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType =
    typeof resultat.metadata?.contentType === "string"
      ? resultat.metadata.contentType
      : "application/octet-stream";

  return new NextResponse(resultat.data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

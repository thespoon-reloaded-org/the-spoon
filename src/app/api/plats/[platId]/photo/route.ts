import { NextResponse } from "next/server";

import { getPlatsPhotosStore } from "@/lib/plats-photos";

/**
 * Sert la photo d'un plat (voir `getPlatsPhotosStore`). Public (comme la
 * fiche restaurant elle-même) : pas de vérification de session ici, seule
 * l'écriture (voir creerPlat/modifierPlat) est réservée au contact du
 * restaurant.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platId: string }> },
) {
  const { platId } = await params;

  let resultat;
  try {
    resultat = await getPlatsPhotosStore().getWithMetadata(platId, { type: "blob" });
  } catch (erreur) {
    // Lecture impossible (disque local abîmé, Netlify Blobs en panne...) —
    // pas de photo à servir, pas de 500 pour autant.
    console.error("Photo de plat indisponible :", erreur);
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
      // Défense en profondeur : validerImage() (src/lib/photos.ts) refuse déjà
      // les SVG à l'upload, mais cette route reste publique et non
      // authentifiée — nosniff évite qu'un navigateur ne réinterprète le
      // contenu comme un type plus dangereux que le Content-Type déclaré.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Enveloppe commune des routes `/api/admin/*` : authentification, lecture du
 * corps JSON, et traduction des erreurs en réponses HTTP lisibles — une
 * seule fois ici plutôt que recopiée dans chaque route.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma";

import { ErreurApi } from "./erreurs";
import { authentifierApiAdmin, type ContexteApiAdmin } from "./garde";

const SANS_CACHE = { "Cache-Control": "no-store" };

export function repondre(corps: unknown, statut = 200): Response {
  return Response.json(corps, { status: statut, headers: SANS_CACHE });
}

function repondreErreur(statut: number, erreur: string, details?: unknown): Response {
  return repondre(details === undefined ? { erreur } : { erreur, details }, statut);
}

/** Corps JSON validé par `schema`, ou 400 qui dit quel champ corriger. */
export async function lireCorps<S extends z.ZodType>(
  requete: Request,
  schema: S,
): Promise<z.output<S>> {
  let brut: unknown;
  try {
    brut = await requete.json();
  } catch {
    throw new ErreurApi(400, "Le corps de la requête doit être du JSON valide.");
  }
  const resultat = schema.safeParse(brut);
  if (!resultat.success) {
    throw new ErreurApi(
      400,
      "Données invalides.",
      resultat.error.issues.map((i) => ({
        champ: i.path.join(".") || "(racine)",
        message: i.message,
      })),
    );
  }
  return resultat.data;
}

/**
 * Une route d'administration. Après toute écriture réussie, le cache de
 * rendu de tout le site est invalidé : une donnée créée ici doit apparaître
 * tout de suite sur les écrans dîneur, restaurant et staff, et cette API
 * n'est pas appelée assez souvent pour que la finesse vaille la peine.
 */
export function routeAdmin<C = unknown>(
  traiter: (requete: Request, contexte: ContexteApiAdmin, contexteRoute: C) => Promise<Response>,
) {
  return async (requete: Request, contexteRoute: C): Promise<Response> => {
    try {
      const contexte = await authentifierApiAdmin(requete);
      const reponse = await traiter(requete, contexte, contexteRoute);
      if (requete.method !== "GET" && reponse.ok) revalidatePath("/", "layout");
      return reponse;
    } catch (erreur) {
      if (erreur instanceof ErreurApi)
        return repondreErreur(erreur.statut, erreur.message, erreur.details);
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
        return repondreErreur(409, "Doublon : une donnée unique existe déjà.", {
          cible: erreur.meta?.target,
        });
      }
      console.error("API admin :", erreur);
      return repondreErreur(500, "Erreur interne.");
    }
  };
}

import { genererFactures, listerFacturesMois } from "@/lib/api-admin/creations";
import { ErreurApi } from "@/lib/api-admin/erreurs";
import { lireCorps, repondre, routeAdmin } from "@/lib/api-admin/reponses";
import { schemaGenerationFactures, schemaMois } from "@/lib/api-admin/schemas";

export const GET = routeAdmin(async (requete) => {
  const mois = schemaMois.safeParse(new URL(requete.url).searchParams.get("mois"));
  if (!mois.success) throw new ErreurApi(400, "Paramètre mois=AAAA-MM requis.");
  return repondre({ factures: await listerFacturesMois(mois.data) });
});

/** Idempotent, comme depuis la Console : relancer complète, ne duplique pas. */
export const POST = routeAdmin(async (requete) => {
  const { mois } = await lireCorps(requete, schemaGenerationFactures);
  return repondre(await genererFactures(mois));
});

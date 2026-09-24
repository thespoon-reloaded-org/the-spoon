/**
 * Garde de l'API d'administration (`/api/admin/*`).
 *
 * Pourquoi un jeton et pas la session staff : cette API sert à créer des
 * données en masse depuis un script, un `curl` ou un agent — aucun de ces
 * clients ne tient un cookie better-auth. Un seul jeton, posé en variable
 * d'environnement (`ADMIN_API_TOKEN`), réservé à l'administratrice du
 * produit : pas de table de clés tant qu'il n'y a qu'une personne derrière.
 *
 * Quatre états, dans cet ordre :
 * - pas de jeton configuré → 404 : sur cet environnement, l'API n'existe pas.
 *   C'est l'état par défaut, pour qu'aucun déploiement ne l'ouvre par oubli ;
 * - jeton configuré trop court → 503, l'API reste fermée : un jeton qu'on
 *   devine n'en est pas un. Jugé ici et pas au démarrage (`env.ts`), pour
 *   qu'une faute de configuration de l'API ne fasse pas tomber le site ;
 * - jeton absent ou faux dans la requête → 401 ;
 * - jeton bon mais `ADMIN_API_STAFF_EMAIL` absent ou inconnu → 503 : chaque
 *   création de restaurant est tracée dans `JournalAuditRestaurant` au nom
 *   d'un membre du staff, comme depuis la Console. Une API qui écrirait sans
 *   auteur ferait mentir la fiche admin (« toute création est tracée »).
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

import { ErreurApi } from "./erreurs";

/** `openssl rand -hex 32` en donne 64. */
export const LONGUEUR_MINIMALE_JETON = 32;

export type ContexteApiAdmin = {
  /** Membre du staff à qui les écritures sont imputées (journal d'audit). */
  staffId: string;
};

/**
 * Comparaison en temps constant, sur les empreintes plutôt que sur les
 * chaînes : `timingSafeEqual` exige deux tampons de même longueur, et
 * comparer les longueurs d'abord révélerait celle du jeton attendu.
 */
export function jetonCorrespond(fourni: string | null, attendu: string): boolean {
  if (!fourni) return false;
  const empreinte = (valeur: string) => createHash("sha256").update(valeur).digest();
  return timingSafeEqual(empreinte(fourni), empreinte(attendu));
}

/** Le jeton d'un en-tête `Authorization: Bearer <jeton>`, ou `null`. */
export function jetonDeLEntete(entete: string | null): string | null {
  const correspondance = /^Bearer\s+(\S+)\s*$/i.exec(entete ?? "");
  return correspondance ? correspondance[1]! : null;
}

export async function authentifierApiAdmin(requete: Request): Promise<ContexteApiAdmin> {
  const jetonAttendu = env.ADMIN_API_TOKEN;
  if (!jetonAttendu) throw new ErreurApi(404, "Introuvable.");
  if (jetonAttendu.length < LONGUEUR_MINIMALE_JETON) {
    throw new ErreurApi(
      503,
      `ADMIN_API_TOKEN doit faire ${LONGUEUR_MINIMALE_JETON} caractères minimum — générer avec \`openssl rand -hex 32\`.`,
    );
  }

  if (!jetonCorrespond(jetonDeLEntete(requete.headers.get("authorization")), jetonAttendu)) {
    throw new ErreurApi(401, "Jeton manquant ou invalide (en-tête Authorization: Bearer …).");
  }

  const email = env.ADMIN_API_STAFF_EMAIL;
  const staff = email
    ? await prisma.staff.findUnique({ where: { email }, select: { id: true } })
    : null;
  if (!staff) {
    throw new ErreurApi(
      503,
      email
        ? `ADMIN_API_STAFF_EMAIL (${email}) ne correspond à aucun membre du staff — le créer avec \`pnpm creer-compte\`.`
        : "ADMIN_API_STAFF_EMAIL n'est pas configuré : impossible d'imputer les créations au journal d'audit.",
    );
  }

  return { staffId: staff.id };
}

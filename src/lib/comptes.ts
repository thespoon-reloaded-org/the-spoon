/**
 * Brique commune de création d'un compte credential (mot de passe), partagée
 * entre `scripts/creer-compte.ts` et la création d'un contact restaurant
 * depuis la Console staff (`creerContactRestaurant` dans
 * `src/app/admin/restaurants/actions.ts`).
 *
 * Les trois populations (dîneur, contact restaurant, staff) suivent la même
 * mécanique better-auth pour une connexion par mot de passe : une ligne
 * `*Account` avec `providerId: "credential"`, `id`/`accountId`/`userId` tous
 * égaux à l'id de l'utilisateur — convention posée par `creer-compte`,
 * reprise ici pour ne pas la dupliquer.
 */
import { randomInt } from "node:crypto";

/** Le `providerId` attendu par better-auth pour une connexion par mot de passe. */
export const FOURNISSEUR_CREDENTIAL = "credential";

/** Ligne de compte credential, identique pour les trois populations — voir plus haut. */
export function nouveauCompteCredential(utilisateurId: string, motDePasseHash: string) {
  return {
    id: utilisateurId,
    accountId: utilisateurId,
    providerId: FOURNISSEUR_CREDENTIAL,
    userId: utilisateurId,
    password: motDePasseHash,
  };
}

/**
 * Alphabet sans caractères ambigus (0/O, 1/l/I) : ce mot de passe est destiné
 * à être lu à l'écran par le staff puis retransmis à la main (téléphone,
 * email) à un contact restaurant — pas de canal d'envoi automatique dans ce
 * projet.
 */
const ALPHABET_MOT_DE_PASSE = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

/**
 * Mot de passe temporaire lisible pour un contact créé depuis la Console
 * staff, affiché une seule fois à l'écran (voir `creerContactRestaurant`).
 * `randomInt` (CSPRNG + tirage par rejet déjà géré nativement, sans biais
 * modulo) plutôt qu'un tirage par rejet écrit à la main.
 */
export function genererMotDePasseTemporaire(longueur = 12): string {
  let motDePasse = "";
  for (let i = 0; i < longueur; i++) {
    motDePasse += ALPHABET_MOT_DE_PASSE.charAt(randomInt(ALPHABET_MOT_DE_PASSE.length));
  }
  return motDePasse;
}

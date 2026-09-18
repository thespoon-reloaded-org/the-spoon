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
import { randomBytes } from "node:crypto";

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
 * Tirage par rejet plutôt que modulo direct : `256 % alphabet.length !== 0`,
 * un modulo introduirait un léger biais vers le début de l'alphabet.
 */
export function genererMotDePasseTemporaire(longueur = 12): string {
  const seuilRejet = 256 - (256 % ALPHABET_MOT_DE_PASSE.length);
  let motDePasse = "";
  while (motDePasse.length < longueur) {
    // Un octet à la fois : simple, et le rejet ne consomme en moyenne qu'une
    // poignée d'octets de plus pour un mot de passe de cette longueur.
    const octet = randomBytes(1).readUInt8(0);
    if (octet < seuilRejet) {
      motDePasse += ALPHABET_MOT_DE_PASSE.charAt(octet % ALPHABET_MOT_DE_PASSE.length);
    }
  }
  return motDePasse;
}

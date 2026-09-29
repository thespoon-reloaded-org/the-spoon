/**
 * Qui peut être formateur : une adresse @hymaia.com, et rien d'autre.
 *
 * Le domaine exact, pas « contient hymaia » : `hymaia.fan@gmail.com` ou
 * `prenom@hymaia.com.ailleurs.io` n'en sont pas.
 *
 * Et le domaine seul ne prouve rien : n'importe qui peut taper une adresse
 * dans un formulaire d'inscription (celui des dîneurs est ouvert, sans
 * vérification d'email). Il ne vaut que là où l'adresse est prouvée :
 *
 * - « Se connecter avec Google » : Google atteste que la personne possède
 *   l'adresse, et qu'elle appartient au Workspace hymaia.com (claim `hd`).
 *   C'est la porte d'entrée, le compte se crée à la première connexion.
 * - `pnpm creer-compte` : un compte à mot de passe créé à la main, pour le
 *   développement local ou en secours ; le script applique la même règle.
 *
 * La connexion (`authFormateur`) et chaque page (`exigerSessionFormateur`)
 * la revérifient pour un compte glissé en base à la main.
 */
export const DOMAINE_FORMATEURS = "hymaia.com";

export function estEmailFormateur(email: string): boolean {
  const normalise = email.trim().toLowerCase();
  const arobase = normalise.lastIndexOf("@");
  return arobase > 0 && normalise.slice(arobase + 1) === DOMAINE_FORMATEURS;
}

/** Code d'erreur renvoyé à l'écran de connexion quand l'adresse n'est pas @hymaia.com. */
export const ERREUR_HORS_DOMAINE = "hors_domaine_hymaia";

/**
 * Le refus que better-auth renvoie à une identité Google qui n'est pas
 * @hymaia.com (`validateUserInfo`), ou rien si elle est admise.
 */
export function refusIdentiteFormateur(email: string | null | undefined) {
  if (email && estEmailFormateur(email)) return undefined;
  return {
    error: ERREUR_HORS_DOMAINE,
    errorDescription: `La console formateur est réservée aux adresses @${DOMAINE_FORMATEURS}.`,
  };
}

/**
 * Ce que l'écran de connexion dit quand Google renvoie une erreur
 * (`?error=…`). Le cas du mauvais compte Google est le seul qu'un formateur
 * peut corriger lui-même : il a son propre message.
 */
export function messageErreurConnexion(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === ERREUR_HORS_DOMAINE) {
    return `Ce compte Google n'est pas une adresse @${DOMAINE_FORMATEURS}. Reconnectez-vous avec votre compte Hymaia.`;
  }
  return "La connexion avec Google n'a pas abouti. Réessayez.";
}

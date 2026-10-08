/**
 * Qui peut être formateur : une adresse @hymaia.com, et rien d'autre.
 *
 * Le domaine exact, pas « contient hymaia » : `hymaia.fan@gmail.com` ou
 * `prenom@hymaia.com.ailleurs.io` n'en sont pas.
 *
 * Et le domaine seul ne prouve rien : n'importe qui peut taper une adresse
 * dans un formulaire d'inscription (celui des dîneurs est ouvert, sans
 * vérification d'email). La règle ne protège que parce qu'aucun compte
 * formateur ne se crée soi-même — `pnpm creer-compte` est la seule porte, et
 * il l'applique. La connexion (`authFormateur`) et chaque page
 * (`exigerSessionFormateur`) la revérifient pour un compte glissé en base à
 * la main.
 */
export const DOMAINE_FORMATEURS = "hymaia.com";

export function estEmailFormateur(email: string): boolean {
  const normalise = email.trim().toLowerCase();
  const arobase = normalise.lastIndexOf("@");
  return arobase > 0 && normalise.slice(arobase + 1) === DOMAINE_FORMATEURS;
}

/**
 * « Où ramener le dîneur après la connexion ».
 *
 * Un dîneur qui remplit sa réservation avant de se connecter ne doit pas
 * retrouver la page d'accueil et sa sélection perdue : l'écran qui l'envoie
 * vers `/connexion` y joint le chemin de retour (sélection comprise), et le
 * formulaire de connexion l'y ramène.
 *
 * Le chemin vient de l'URL, donc de n'importe qui : on ne redirige que vers
 * une adresse interne. Un `//evil.com` ou un `/\evil.com` est un chemin pour
 * le navigateur, pas pour nous — sans ce filtre, un lien
 * `/connexion?retour=//evil.com` ferait de notre écran de connexion un
 * tremplin vers un site tiers.
 */

export function lienConnexion(retour: string): string {
  return `/connexion?retour=${encodeURIComponent(retour)}`;
}

/** Le chemin de retour s'il est utilisable, `null` sinon (l'appelant décide de la destination par défaut). */
export function cheminRetour(valeur: string | string[] | undefined): string | null {
  if (typeof valeur !== "string" || !valeur.startsWith("/")) return null;
  if (valeur.startsWith("//") || valeur.startsWith("/\\")) return null;
  return valeur;
}

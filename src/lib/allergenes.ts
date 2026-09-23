import type { Allergene } from "@/generated/prisma";

/**
 * Les quatorze allergènes à déclaration obligatoire (annexe II du règlement
 * UE n° 1169/2011). Libellés volontairement proches du texte réglementaire :
 * le dîneur allergique connaît ces mots-là, pas une reformulation maison.
 *
 * Module sans dépendance à Prisma runtime (seulement un `import type`) — il
 * est importé par le formulaire client de « Ma carte », qui n'a rien à faire
 * de `pg` dans son bundle. Même raison que `contestation-labels.ts`.
 */
export const LIBELLE_ALLERGENE: Record<Allergene, string> = {
  GLUTEN: "Gluten",
  CRUSTACES: "Crustacés",
  OEUFS: "Œufs",
  POISSONS: "Poissons",
  ARACHIDES: "Arachides",
  SOJA: "Soja",
  LAIT: "Lait",
  FRUITS_A_COQUE: "Fruits à coque",
  CELERI: "Céleri",
  MOUTARDE: "Moutarde",
  SESAME: "Sésame",
  SULFITES: "Sulfites",
  LUPIN: "Lupin",
  MOLLUSQUES: "Mollusques",
};

/** Précision utile à la case à cocher, pas au dîneur qui lit une pastille. */
export const PRECISION_ALLERGENE: Partial<Record<Allergene, string>> = {
  GLUTEN: "blé, seigle, orge, avoine…",
  FRUITS_A_COQUE: "amandes, noisettes, noix…",
  SULFITES: "au-delà de 10 mg/kg",
};

/** L'ordre de l'annexe II, seul ordre d'affichage — pas celui des clics. */
export const ALLERGENES = Object.keys(LIBELLE_ALLERGENE) as Allergene[];

/** Pour `z.enum`, qui veut un tuple non vide plutôt qu'un simple tableau. */
export const VALEURS_ALLERGENES = ALLERGENES as [Allergene, ...Allergene[]];

const RANG = new Map(ALLERGENES.map((allergene, index) => [allergene, index]));

/**
 * Remet une sélection dans l'ordre réglementaire. Les cases cochées arrivent
 * dans l'ordre du DOM, un plat modifié dans l'ordre stocké : sans ça, deux
 * plats portant les mêmes allergènes les affichaient dans un ordre différent.
 */
export function trierAllergenes(allergenes: Allergene[]): Allergene[] {
  return [...new Set(allergenes)].sort((a, b) => RANG.get(a)! - RANG.get(b)!);
}

/**
 * Ce qu'un plat dit de ses allergènes. Trois cas, pas deux : « non
 * renseigné » n'est pas « aucun allergène ». C'est toute la raison d'être de
 * `allergenesDeclaresLe` — un plat qui n'a jamais été renseigné a lui aussi
 * une liste vide, et l'afficher comme sûr tromperait un dîneur allergique.
 */
export type DeclarationAllergenes =
  | { etat: "non_renseigne" }
  | { etat: "aucun"; declareLe: Date }
  | { etat: "presents"; declareLe: Date; allergenes: Allergene[] };

export type PlatAllergenes = {
  allergenes: Allergene[];
  allergenesDeclaresLe: Date | null;
};

export function lireDeclaration(plat: PlatAllergenes): DeclarationAllergenes {
  if (!plat.allergenesDeclaresLe) return { etat: "non_renseigne" };
  const allergenes = trierAllergenes(plat.allergenes);
  return allergenes.length === 0
    ? { etat: "aucun", declareLe: plat.allergenesDeclaresLe }
    : { etat: "presents", declareLe: plat.allergenesDeclaresLe, allergenes };
}

/**
 * Traduit ce qu'un formulaire a renvoyé en ce qui part en base. Écrit une
 * seule fois ici parce que la même règle vaut à la création et à la
 * modification : on ne se déclare « sans allergène » qu'en le cochant
 * explicitement. Sans ça, un restaurateur qui corrige un prix daterait sans
 * le savoir une déclaration « aucun allergène » sur un plat jamais renseigné.
 */
export function declarationDepuisFormulaire(
  saisie: { allergenes: Allergene[]; aucunAllergene: boolean },
  maintenant: Date,
): { allergenes: Allergene[]; allergenesDeclaresLe: Date | null } {
  if (saisie.aucunAllergene) {
    return { allergenes: [], allergenesDeclaresLe: maintenant };
  }
  const allergenes = trierAllergenes(saisie.allergenes);
  return allergenes.length === 0
    ? { allergenes: [], allergenesDeclaresLe: null }
    : { allergenes, allergenesDeclaresLe: maintenant };
}

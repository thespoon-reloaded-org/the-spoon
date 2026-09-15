import type { CategoriePlat } from "@/generated/prisma";

/**
 * Visuels de repli.
 *
 * Un restaurant ou un plat sans photo affichait jusqu'ici un aplat rayé
 * « [ PHOTO ] » ou un emoji 🥣 : la grille d'accueil ressemblait à une maquette
 * plutôt qu'à un produit. Tant que le partenaire n'a pas téléversé sa propre
 * photo (`/espace-restaurant/fiche` et `/espace-restaurant/menu`), on montre
 * une photo générique cohérente avec sa cuisine — elle est *remplacée* dès
 * qu'une vraie photo existe, jamais superposée.
 *
 * Les fichiers vivent dans `public/images/` (voir `SOURCES.md`).
 */

/**
 * D'où vient l'image, et peut-elle passer par l'optimiseur de `next/image` ?
 *
 * Les photos téléversées sont servies par une route API avec un paramètre de
 * cache-bust (`?v=<horodatage>`). Depuis Next.js 16, une image locale portant
 * une chaîne de requête doit être déclarée dans `images.localPatterns` avec un
 * `search` **exact** — impossible ici, la valeur change à chaque upload. On ne
 * les optimise donc pas ; elles sont déjà servies telles quelles par leur
 * route, ce qui était déjà le comportement avant cette refonte. Les visuels
 * statiques de `public/images/`, eux, n'ont pas de requête et profitent du
 * `srcset`, du lazy-loading et de la conversion WebP.
 */
export type SourcePhoto = {
  url: string;
  /** `true` pour les fichiers de `public/images/`, `false` pour les photos téléversées. */
  optimisable: boolean;
};

const PAR_CUISINE: Record<string, string> = {
  bistrot: "/images/cuisine-bistrot.jpg",
  "bouchon lyonnais": "/images/cuisine-bouchon-lyonnais.jpg",
  italien: "/images/cuisine-italien.jpg",
  japonais: "/images/cuisine-japonais.jpg",
  libanais: "/images/cuisine-libanais.jpg",
  "végé": "/images/cuisine-vege.jpg",
  vege: "/images/cuisine-vege.jpg",
  "végétarien": "/images/cuisine-vege.jpg",
};

/** Ordre stable : deux restaurants d'une cuisine inconnue n'ont pas la même photo. */
const REPLIS_GENERIQUES = [
  "/images/cuisine-bistrot.jpg",
  "/images/cuisine-bouchon-lyonnais.jpg",
  "/images/cuisine-italien.jpg",
  "/images/cuisine-libanais.jpg",
] as const;

/**
 * Photo représentant un type de cuisine — sert la sélection « Envie de quoi ce
 * soir ? » de l'accueil, qui n'est pas rattachée à un restaurant précis.
 */
export function photoCuisine(cuisine: string): SourcePhoto {
  const parCuisine = PAR_CUISINE[cuisine.trim().toLowerCase()];
  if (parCuisine) return { url: parCuisine, optimisable: true };
  return {
    url: REPLIS_GENERIQUES[empreinte(cuisine) % REPLIS_GENERIQUES.length]!,
    optimisable: true,
  };
}

/** Somme de contrôle simplissime : même identifiant ⇒ toujours la même photo. */
function empreinte(valeur: string): number {
  let total = 0;
  for (let i = 0; i < valeur.length; i++) total = (total * 31 + valeur.charCodeAt(i)) >>> 0;
  return total;
}

export function photoRestaurant(restaurant: {
  id: string;
  cuisine: string;
  photoMisAJourLe: Date | null;
}): SourcePhoto {
  if (restaurant.photoMisAJourLe) {
    return {
      url: `/api/restaurants/${restaurant.id}/photo?v=${restaurant.photoMisAJourLe.getTime()}`,
      optimisable: false,
    };
  }
  const parCuisine = PAR_CUISINE[restaurant.cuisine.trim().toLowerCase()];
  if (parCuisine) return { url: parCuisine, optimisable: true };
  return {
    url: REPLIS_GENERIQUES[empreinte(restaurant.id) % REPLIS_GENERIQUES.length]!,
    optimisable: true,
  };
}

/**
 * Replis des plats, par catégorie. Un seul visuel générique pour toute la
 * carte donnait cinq fois la même photo de velouté à la suite sur l'accueil —
 * ça se lisait comme un bug d'affichage, pas comme un repli. Chaque catégorie
 * a donc son registre, et les plats d'une même catégorie se répartissent
 * dessus de façon stable.
 */
const REPLIS_PLAT: Record<CategoriePlat, readonly string[]> = {
  ENTREE: ["/images/plat-veloute.jpg", "/images/plat-soupe.jpg"],
  PLAT: ["/images/plat-mijote.jpg", "/images/plat-risotto.jpg", "/images/plat-ramen.jpg"],
  DESSERT: ["/images/plat-dessert.jpg"],
};

export function photoPlat(plat: {
  id: string;
  categorie: CategoriePlat;
  photoMisAJourLe: Date | null;
}): SourcePhoto {
  if (plat.photoMisAJourLe) {
    return {
      url: `/api/plats/${plat.id}/photo?v=${plat.photoMisAJourLe.getTime()}`,
      optimisable: false,
    };
  }
  const registre = REPLIS_PLAT[plat.categorie] ?? REPLIS_PLAT.PLAT;
  return { url: registre[empreinte(plat.id) % registre.length]!, optimisable: true };
}

/** `true` quand la photo affichée est celle du partenaire, pas un repli. */
export function estPhotoReelle(entite: { photoMisAJourLe: Date | null }): boolean {
  return entite.photoMisAJourLe !== null;
}

import Image from "next/image";

import type { SourcePhoto } from "@/lib/images";

/**
 * Photo de couverture d'un restaurant ou d'un plat.
 *
 * Un seul endroit sait comment afficher ces images, parce qu'elles ont deux
 * provenances et ne se traitent pas pareil (cf. `SourcePhoto` dans
 * `src/lib/images.ts`) : les visuels de repli livrés dans `public/images/`
 * passent par `next/image` — `srcset`, lazy-loading, WebP — tandis que les
 * photos téléversées par le partenaire, servies par une route API avec un
 * cache-bust `?v=…`, restent en `<img>` : Next.js 16 refuse d'optimiser une
 * image locale dont la chaîne de requête n'est pas déclarée à l'exact dans
 * `images.localPatterns`, ce qu'un horodatage variable interdit.
 *
 * Le parent doit être positionné (`relative`) et avoir une hauteur **fixe** :
 * l'image remplit son conteneur en `object-cover`. La hauteur fixe n'est pas
 * qu'une question de cadrage — la branche `<img>` n'a pas de dimensions
 * intrinsèques, donc un conteneur qui se dimensionne sur son contenu ferait
 * sauter la mise en page à l'arrivée de la photo.
 */
export function PhotoCouverture({
  photo,
  alt,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority = false,
  className = "",
}: {
  photo: SourcePhoto;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!photo.optimisable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo.url}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <Image
      src={photo.url}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
    />
  );
}

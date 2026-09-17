/**
 * « Photo d'illustration ».
 *
 * Quand un plat n'a pas encore sa photo, on en affiche une générique de la
 * même famille (voir `src/lib/images.ts`) plutôt qu'un carré vide : la carte
 * reste appétissante. Mais montrer une assiette de ramen sous le nom
 * « Risotto aux cèpes » sans rien dire laisserait croire au dîneur que c'est
 * le plat qu'on lui servira. Cette pastille lève l'ambiguïté, et disparaît
 * dès que le restaurant téléverse sa vraie photo.
 *
 * À poser dans un conteneur `relative` — typiquement le même que la photo.
 */
export function MarqueIllustration() {
  return (
    <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
      Photo d&apos;illustration
    </span>
  );
}

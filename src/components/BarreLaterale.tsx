"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ICONES, IconeCroix, IconeMenu, type CleIcone } from "@/components/Icones";
import { LogoTheSpoon } from "@/components/LogoTheSpoon";

export type EntreeMenu = {
  href: string;
  label: string;
  icone: CleIcone;
};

export type ThemeBarre = {
  /** Fond de la barre. */
  fond: string;
  /** Fond de l'entrée survolée / active. */
  fondActif: string;
  /** Séparateurs. */
  ligne: string;
  /** Texte des entrées inactives. */
  texte: string;
  /** Texte et liseré de l'entrée active. */
  accent: string;
};

/**
 * Menu latéral des espaces connectés (espace restaurant, console staff).
 *
 * Il remplace une rangée d'onglets en pilules qui débordait dès cinq entrées
 * et ne laissait aucune place pour l'identité de l'établissement. Colonne
 * fixe à partir de `lg`, barre + tiroir en dessous : sur un téléphone en
 * salle, une colonne de 260 px mangerait l'écran.
 *
 * Générique parce que les deux espaces ont la même structure et deux couleurs
 * différentes — c'est tout ce qui les distingue, et c'est ce que porte
 * `theme`.
 */
export function BarreLaterale({
  marque,
  titre,
  sousTitre,
  entrees,
  theme,
  pied,
}: {
  /** Sur-titre : le nom de l'espace. */
  marque: string;
  /** Titre : le nom de l'établissement, ou de la personne connectée. */
  titre: string;
  sousTitre?: string;
  entrees: readonly EntreeMenu[];
  theme: ThemeBarre;
  /** Rendu en bas de la barre — en pratique, le bouton de déconnexion. */
  pied: React.ReactNode;
}) {
  const pathname = usePathname();
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  // Naviguer referme le tiroir, sinon il masque la page qu'on vient d'ouvrir.
  // Fermé au clic plutôt que dans un effet sur `pathname` : un effet qui
  // appelle `setState` déclenche un rendu en cascade à chaque navigation, y
  // compris sur grand écran où le tiroir n'existe pas.
  const fermerTiroir = () => setTiroirOuvert(false);

  const contenu = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-2">
        <LogoTheSpoon ton="sombre" couleurPastille={theme.accent} />
      </div>

      <div
        className="rounded-2xl px-4 py-3.5"
        style={{ background: theme.fondActif }}
      >
        <p
          className="font-mono text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: theme.accent }}
        >
          {marque}
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-cream)]">
          {titre}
        </p>
        {sousTitre && (
          <p className="mt-0.5 text-xs" style={{ color: theme.texte }}>
            {sousTitre}
          </p>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label={marque}>
        {entrees.map((entree) => {
          const Icone = ICONES[entree.icone];
          const estActive = pathname === entree.href || pathname.startsWith(`${entree.href}/`);
          return (
            <Link
              key={entree.href}
              href={entree.href}
              onClick={fermerTiroir}
              aria-current={estActive ? "page" : undefined}
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors"
              style={
                estActive
                  ? { background: theme.fondActif, color: "var(--color-cream)" }
                  : { color: theme.texte }
              }
            >
              <span style={{ color: estActive ? theme.accent : "inherit" }}>
                <Icone taille={19} />
              </span>
              {entree.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t pt-4" style={{ borderColor: theme.ligne }}>
        {pied}
      </div>
    </div>
  );

  return (
    <>
      {/* ---------- barre mobile ---------- */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 lg:hidden"
        style={{ background: theme.fond }}
      >
        <LogoTheSpoon ton="sombre" couleurPastille={theme.accent} />
        <button
          type="button"
          onClick={() => setTiroirOuvert(true)}
          className="rounded-xl p-2 text-[var(--color-cream)]"
          aria-label={`Ouvrir le menu ${marque}`}
        >
          <IconeMenu taille={22} />
        </button>
      </div>

      {/* ---------- tiroir mobile ----------
           Échap ferme le tiroir : il couvre tout l'écran derrière un voile, et
           sans ça un utilisateur au clavier n'a aucun moyen évident d'en
           sortir. `onKeyDown` sur le conteneur suffit parce que le focus y
           entre dès l'ouverture (le bouton de fermeture est auto-focalisé). */}
      {tiroirOuvert && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Menu ${marque}`}
          onKeyDown={(evenement) => {
            if (evenement.key === "Escape") setTiroirOuvert(false);
          }}
        >
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setTiroirOuvert(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div
            className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto"
            style={{ background: theme.fond }}
          >
            <button
              type="button"
              autoFocus
              onClick={() => setTiroirOuvert(false)}
              className="absolute right-3 top-4 rounded-xl p-2 text-[var(--color-cream)]"
              aria-label="Fermer le menu"
            >
              <IconeCroix taille={20} />
            </button>
            {contenu}
          </div>
        </div>
      )}

      {/* ---------- colonne fixe, à partir de lg ---------- */}
      <aside
        className="sticky top-0 hidden h-screen w-[264px] shrink-0 overflow-y-auto lg:block"
        style={{ background: theme.fond }}
      >
        {contenu}
      </aside>
    </>
  );
}

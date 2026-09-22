"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { marquerOnboardingVu } from "@/app/onboarding-actions";
import { IconeCroix } from "@/components/Icones";
import { PARCOURS } from "@/lib/onboarding";
import { UNIVERS, type CleUnivers } from "@/lib/univers";

/**
 * Nom de l'événement qui ouvre la fenêtre d'un univers.
 *
 * La fenêtre est rendue une fois, le bouton qui la rouvre peut l'être
 * plusieurs : `BarreLaterale` affiche son pied deux fois (la colonne fixe et
 * le tiroir mobile). Les coupler par un état React imposerait un seul
 * bouton ; les coupler par un événement laisse la fenêtre unique et les
 * déclencheurs libres. Sans ça, ouvrir le menu sur mobile montait une seconde
 * fenêtre qui se rouvrait toute seule.
 */
function evenementOuverture(univers: CleUnivers): string {
  return `onboarding:ouvrir:${univers}`;
}

/** Le bouton qui rejoue l'onboarding — autant d'exemplaires que nécessaire. */
export function BoutonOnboarding({
  univers,
  className,
}: {
  univers: CleUnivers;
  /** Le bouton vit dans trois cadres très différents — un header clair, deux barres sombres. */
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(evenementOuverture(univers)))}
      className={className}
    >
      Comment ça marche
    </button>
  );
}

/**
 * La fenêtre d'onboarding d'un univers — à rendre **une seule fois** par page.
 *
 * `<dialog>` natif plutôt qu'un div en position fixe : le piège à focus, la
 * fermeture par Échap et l'inertie du fond viennent avec, et ils sont plus
 * difficiles à réécrire correctement qu'à adopter.
 */
export function Onboarding({
  univers,
  dejaVu,
}: {
  univers: CleUnivers;
  /** `false` : la fenêtre s'ouvre d'elle-même à l'arrivée. */
  dejaVu: boolean;
}) {
  const parcours = PARCOURS[univers];
  const couleurs = UNIVERS[univers];
  const dialogue = useRef<HTMLDialogElement>(null);
  const idTitre = useId();
  const [etape, setEtape] = useState(0);
  // On ne réécrit pas la trace à chaque fermeture : une seule fois suffit, et
  // rouvrir volontairement l'onboarding n'a pas à repasser en base.
  const [aRetenir, setARetenir] = useState(!dejaVu);

  useEffect(() => {
    if (!dejaVu) dialogue.current?.showModal();
  }, [dejaVu]);

  useEffect(() => {
    function ouvrir() {
      setEtape(0);
      if (!dialogue.current?.open) dialogue.current?.showModal();
    }
    const evenement = evenementOuverture(univers);
    window.addEventListener(evenement, ouvrir);
    return () => window.removeEventListener(evenement, ouvrir);
  }, [univers]);

  /** Déclenché aussi bien par Échap que par les boutons — un seul endroit qui retient. */
  function surFermeture() {
    if (!aRetenir) return;
    setARetenir(false);
    void marquerOnboardingVu(univers);
  }

  const derniere = etape === parcours.etapes.length - 1;
  const courante = parcours.etapes[etape]!;

  return (
    <dialog
      ref={dialogue}
      onClose={surFermeture}
      aria-labelledby={idTitre}
      // `m-auto` explicite : le reset de Tailwind met `margin: 0` partout, ce
      // qui prive `<dialog>` du centrage que le navigateur lui donne par défaut.
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-[28px] border border-[var(--color-line-strong)] bg-white p-0 text-[var(--color-ink)] shadow-[var(--shadow-carte-levee)] backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-4 px-7 pt-7">
        <div>
          <h2
            id={idTitre}
            className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight"
          >
            {parcours.titre}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{parcours.accroche}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogue.current?.close()}
          aria-label="Fermer"
          className="shrink-0 rounded-full p-2 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]"
        >
          <IconeCroix taille={18} />
        </button>
      </div>

      <div className="px-7 pb-2 pt-6">
        <ol aria-hidden className="flex gap-1.5">
          {parcours.etapes.map((etapeParcours, index) => (
            <li
              key={etapeParcours.titre}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: index <= etape ? couleurs.accent : "var(--color-line)",
              }}
            />
          ))}
        </ol>

        <p className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Étape {etape + 1} sur {parcours.etapes.length}
        </p>
        <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
          {courante.titre}
        </h3>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
          {courante.texte}
        </p>
        {courante.lien && (
          <Link
            href={courante.lien.href}
            onClick={() => dialogue.current?.close()}
            className="mt-4 inline-block text-sm font-semibold underline"
            style={{ color: couleurs.accent }}
          >
            {courante.lien.libelle} →
          </Link>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--color-line)] px-7 py-5">
        <button
          type="button"
          onClick={() => setEtape((precedente) => Math.max(0, precedente - 1))}
          disabled={etape === 0}
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-line)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Précédent
        </button>
        <button
          type="button"
          onClick={() =>
            derniere ? dialogue.current?.close() : setEtape((suivante) => suivante + 1)
          }
          className="rounded-full px-6 py-2.5 font-[family-name:var(--font-display)] text-[15px] font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: couleurs.accent, color: couleurs.surAccent }}
        >
          {derniere ? "C'est parti" : "Suivant"}
        </button>
      </div>
    </dialog>
  );
}

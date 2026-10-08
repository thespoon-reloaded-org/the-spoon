import Image from "next/image";
import Link from "next/link";

import { IconeFleche, IconeValide } from "@/components/Icones";
import { LogoTheSpoon } from "@/components/LogoTheSpoon";
import { UNIVERS_PUBLICS, type Univers } from "@/lib/univers";

/**
 * Cadre commun aux écrans de connexion.
 *
 * À gauche le formulaire de l'univers, à droite sa photo teintée de sa
 * couleur. Au-dessus du formulaire, le sélecteur « vous êtes… » : c'est lui
 * qui rend les deux portes visibles d'emblée, au lieu de laisser un
 * restaurateur chercher un lien « espace pro » en bas de page.
 *
 * Les pages qui l'utilisent sont des composants client (hooks better-auth),
 * donc celui-ci l'est aussi par ricochet — il ne fait que de la mise en forme.
 */
export function EcranConnexion({
  univers,
  children,
  /** Affiché sous le formulaire, ex. « pas d'inscription en ligne ». */
  pied,
}: {
  univers: Univers;
  children: React.ReactNode;
  pied?: React.ReactNode;
}) {
  return (
    <div
      className={`min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)] ${univers.classeUnivers}`}
      style={{ background: univers.fond }}
    >
      {/* ---------- formulaire ---------- */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <LogoTheSpoon />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: univers.encreDouce }}
          >
            Retour au site
            <IconeFleche taille={15} />
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {univers.interne ? (
            <p
              className="mb-6 w-fit rounded-full px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide"
              style={{ background: univers.interne.fondBadge, color: univers.interne.texteBadge }}
            >
              {univers.interne.badge}
            </p>
          ) : (
            <SelecteurUnivers actif={univers} />
          )}

          <h1
            className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight md:text-4xl"
            style={{ color: univers.encre }}
          >
            {univers.titre}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: univers.encreDouce }}>
            {univers.baseline}
          </p>

          <div className="mt-8">{children}</div>

          {pied && (
            <div className="mt-6 text-sm" style={{ color: univers.encreDouce }}>
              {pied}
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-md">
          {univers.interne ? (
            <Link
              href="/connexion"
              className="text-xs hover:underline"
              style={{ color: univers.encreDouce }}
            >
              ← {univers.interne.sortie}
            </Link>
          ) : (
            <Link
              href="/connexion-admin"
              className="text-xs hover:underline"
              style={{ color: univers.encreDouce }}
            >
              Staff TheSpoon ? Console interne
            </Link>
          )}
        </div>
      </div>

      {/* ---------- panneau photo ---------- */}
      <aside className="relative min-h-[240px] overflow-hidden lg:min-h-screen">
        <Image
          src={univers.photo}
          alt={univers.photoAlt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 46vw"
          className="object-cover"
        />
        <div className="absolute inset-0" style={{ background: univers.voile }} />

        <div className="relative flex h-full flex-col justify-end gap-5 p-8 lg:p-12">
          <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-tight tracking-tight text-[var(--color-cream)] lg:text-3xl">
            {univers.espace}
          </p>
          <ul className="flex flex-col gap-3">
            {univers.atouts.map((atout) => (
              <li key={atout} className="flex items-start gap-3 text-[15px] text-white/85">
                <span className="mt-0.5 shrink-0 text-white/70">
                  <IconeValide taille={17} />
                </span>
                {atout}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/** « Vous êtes… » — deux portes, deux couleurs, un lien par univers. */
function SelecteurUnivers({ actif }: { actif: Univers }) {
  return (
    <div className="mb-8">
      <p
        className="mb-2.5 font-mono text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: actif.encreDouce }}
      >
        Vous êtes…
      </p>
      <div
        className="grid grid-cols-2 gap-1.5 rounded-2xl p-1.5"
        style={{ background: "rgb(0 0 0 / 0.05)" }}
      >
        {UNIVERS_PUBLICS.map((univers) => {
          const estActif = univers.cle === actif.cle;
          return (
            <Link
              key={univers.cle}
              href={univers.href}
              aria-current={estActif ? "page" : undefined}
              className="rounded-xl px-3 py-2.5 text-center text-[13px] font-bold leading-tight transition-colors sm:text-sm"
              style={
                estActif
                  ? { background: univers.accent, color: univers.surAccent }
                  : { color: actif.encreDouce }
              }
            >
              {univers.onglet}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

import { headers } from "next/headers";
import Link from "next/link";

import { creerPlat } from "./actions";
import { PlatForm } from "@/components/PlatForm";
import { SupprimerPlatBouton } from "@/components/SupprimerPlatBouton";
import { authRestaurant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BOUTON_SECONDAIRE, CARTE, EYEBROW } from "@/lib/ui";

const LIBELLE_CATEGORIE: Record<"ENTREE" | "PLAT" | "DESSERT", string> = {
  ENTREE: "Entrée",
  PLAT: "Plat",
  DESSERT: "Dessert",
};

/**
 * Écran "Ma carte" de l'espace restaurant — voir le ticket Notion "Mon menu
 * (plats, photos, prix)". Le contrôle d'accès (session + restaurant du
 * contact) est fait une fois dans le layout parent.
 */
export default async function MenuPage() {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null; // garde déjà faite par le layout, satisfait TypeScript

  const plats = await prisma.platCuillere.findMany({
    where: { restaurantId: session.user.restaurantId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className={EYEBROW}>Mes plats</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Visible immédiatement sur ta fiche publique et sur l&apos;accueil.
        </p>

        {plats.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Pas encore de plat sur la carte.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {plats.map((plat) => (
              <li key={plat.id} className={`${CARTE} flex items-center gap-4`}>
                {plat.photoMisAJourLe ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/plats/${plat.id}/photo?v=${plat.photoMisAJourLe.getTime()}`}
                    alt={plat.nom}
                    className="h-16 w-16 shrink-0 rounded-[14px] object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-accent-soft)] text-2xl">
                    🥣
                  </span>
                )}

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">{plat.nom}</span>
                    <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
                      {LIBELLE_CATEGORIE[plat.categorie]}
                    </span>
                  </div>
                  {plat.description && (
                    <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{plat.description}</p>
                  )}
                  <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">
                    {(plat.prixCentimes / 100).toFixed(2)} €
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Link href={`/espace-restaurant/menu/${plat.id}`} className={BOUTON_SECONDAIRE}>
                    Modifier
                  </Link>
                  <SupprimerPlatBouton platId={plat.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className={EYEBROW}>Ajouter un plat</h2>
        <div className={`${CARTE} mt-3`}>
          <PlatForm action={creerPlat} libelleSoumission="Ajouter à la carte" />
        </div>
      </section>
    </div>
  );
}

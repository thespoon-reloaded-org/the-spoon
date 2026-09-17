import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { creerPlat } from "./actions";
import { EnteteEspace } from "@/components/EnteteEspace";
import { PhotoCouverture } from "@/components/PhotoCouverture";
import { PlatForm } from "@/components/PlatForm";
import { SupprimerPlatBouton } from "@/components/SupprimerPlatBouton";
import { authRestaurant } from "@/lib/auth";
import { estPhotoReelle, photoPlat } from "@/lib/images";
import { LIBELLE_CATEGORIE } from "@/lib/plats";
import { prisma } from "@/lib/prisma";
import { BOUTON_SECONDAIRE, CARTE, ETAT_VIDE, TITRE_SECTION, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Ma carte" };

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

  const sansPhoto = plats.filter((plat) => !estPhotoReelle(plat)).length;

  return (
    <>
      <EnteteEspace
        titre="Ma carte"
        description="Ces plats apparaissent immédiatement sur votre fiche publique et sur l'accueil TheSpoon."
      />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className={TITRE_SECTION}>
            Mes plats{" "}
            <span className="font-body text-base font-medium text-[var(--color-ink-muted)]">
              · {plats.length}
            </span>
          </h2>
          {sansPhoto > 0 && (
            <span className={pastilleEtat("attention")}>
              {sansPhoto} sans photo — un visuel générique est affiché à la place
            </span>
          )}
        </div>

        {plats.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
              Pas encore de plat sur la carte
            </p>
            <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
              Ajoutez votre premier plat à la cuillère ci-dessous : c&apos;est ce qui vous met en
              avant sur la page d&apos;accueil.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {plats.map((plat) => (
              <li
                key={plat.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-line-strong)] bg-white p-4"
              >
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[14px]">
                  <PhotoCouverture photo={photoPlat(plat)} alt={plat.nom} sizes="64px" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">{plat.nom}</span>
                    <span className={pastilleEtat("marque")}>
                      {LIBELLE_CATEGORIE[plat.categorie]}
                    </span>
                  </div>
                  {plat.description && (
                    <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{plat.description}</p>
                  )}
                  <p className="mt-1 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">
                    {(plat.prixCentimes / 100).toFixed(2)} €
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
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

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-4`}>Ajouter un plat</h2>
        <div className={CARTE}>
          <PlatForm action={creerPlat} libelleSoumission="Ajouter à la carte" />
        </div>
      </section>
    </>
  );
}

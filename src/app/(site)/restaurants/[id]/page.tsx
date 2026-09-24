import { headers } from "next/headers";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AllergenesPlat } from "@/components/AllergenesPlat";
import { AvisForm } from "@/components/AvisForm";
import { BookingCard } from "@/components/BookingCard";
import { IconeCouverts, IconeHorloge, IconeLieu } from "@/components/Icones";
import { MarqueIllustration } from "@/components/MarqueIllustration";
import { NoteCuilleres } from "@/components/NoteCuilleres";
import { PhotoCouverture } from "@/components/PhotoCouverture";
import { auth } from "@/lib/auth";
import { aEteServi } from "@/lib/avis";
import { cleCreneau, construireDateCreneau, genererJoursReservables } from "@/lib/creneaux";
import { lireDisponibilites } from "@/lib/disponibilites";
import { formaterDate } from "@/lib/fuseau";
import { formaterHoraires } from "@/lib/horaires";
import { estPhotoReelle, photoPlat, photoRestaurant } from "@/lib/images";
import { LIBELLE_CATEGORIE } from "@/lib/plats";
import { prisma } from "@/lib/prisma";
import { capaciteEffective } from "@/lib/reservation";
import { pastilleEtat } from "@/lib/ui";

/**
 * `generateMetadata` et la page ont besoin du même restaurant. Sans `cache`,
 * Next.js exécute les deux fonctions pour une même requête et Prisma part
 * deux fois en base — la mémoïsation de Next ne couvre que `fetch`.
 */
const lireRestaurant = cache((id: string) =>
  prisma.restaurant.findUnique({
    where: { id },
    include: {
      platsCuillere: { orderBy: { createdAt: "desc" } },
      avis: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurant = await lireRestaurant(id);
  if (!restaurant) return { title: "Restaurant introuvable" };
  return {
    title: `${restaurant.nom}, ${restaurant.ville}`,
    description:
      restaurant.description ??
      `${restaurant.cuisine} à ${restaurant.ville} — réservez sur TheSpoon.`,
  };
}

/** Un bloc d'information du bandeau sous le hero. */
function Repere({
  Icone,
  libelle,
  lignes,
}: {
  Icone: typeof IconeLieu;
  libelle: string;
  lignes: string[];
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[var(--color-accent)]">
        <Icone taille={19} />
      </span>
      <span className="flex flex-col">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          {libelle}
        </span>
        {lignes.map((ligne) => (
          <span key={ligne} className="text-[15px] text-[var(--color-ink)]">
            {ligne}
          </span>
        ))}
      </span>
    </div>
  );
}

export default async function FicheRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [restaurant, session] = await Promise.all([
    lireRestaurant(id),
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (!restaurant) notFound();

  // Réservé aux dîneurs déjà servis — même règle que la garde faite côté
  // serveur dans `deposerAvis` (voir `aEteServi`).
  const dejaServi = session ? await aEteServi(prisma, restaurant.id, session.user.id) : false;

  const avisExistant = session
    ? (restaurant.avis.find((a) => a.userId === session.user.id) ?? null)
    : null;

  // Ce que le restaurant ouvre (ses horaires, recouverts par ses exceptions
  // datées) puis, dans ces créneaux-là seulement, ce qu'il lui reste de place
  // (voir "Capacité & conflits de réservation") : un créneau fermé n'a pas à
  // être proposé, et un créneau complet non plus.
  const joursReservables = genererJoursReservables();
  const { plages, ouvertures } = await lireDisponibilites(
    restaurant.id,
    joursReservables.map((jour) => jour.iso),
  );
  const datesCreneaux = joursReservables
    .flatMap((jour) =>
      (ouvertures[jour.iso] ?? []).map((creneau) => construireDateCreneau(jour.iso, creneau)),
    )
    .filter((date): date is Date => date !== null);
  const occupationParCreneau = await prisma.booking.groupBy({
    by: ["date"],
    where: { restaurantId: restaurant.id, statut: "CONFIRMEE", date: { in: datesCreneaux } },
    _sum: { couverts: true },
  });
  const occupation = Object.fromEntries(
    occupationParCreneau.map((ligne) => [cleCreneau(ligne.date), ligne._sum.couverts ?? 0]),
  );

  // Les mêmes plages que celles qui décident des créneaux ci-dessus — la
  // fiche ne peut plus annoncer une chose et en proposer une autre.
  const horaires = formaterHoraires(plages);

  return (
    <main>
      {/* ---------- hero ---------- */}
      <section className="relative mx-3 mt-3 h-[340px] overflow-hidden rounded-[32px] md:mx-6 md:h-[420px] md:rounded-[40px]">
        <PhotoCouverture
          photo={photoRestaurant(restaurant)}
          alt={restaurant.nom}
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25" />

        <div className="relative flex h-full flex-col justify-between p-6 md:p-10">
          <Link
            href="/"
            className="w-fit rounded-full bg-black/35 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/55"
          >
            ← Retour à la recherche
          </Link>

          <div className="max-w-2xl">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--color-yellow)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-ink)]">
                {restaurant.cuisine.toUpperCase()}
              </span>
              <span className="rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                {restaurant.ville}
              </span>
            </div>

            <h1 className="mb-3 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[0.95] tracking-tight text-white md:text-6xl">
              {restaurant.nom}
            </h1>

            <NoteCuilleres
              note={restaurant.noteCuilleres}
              nombreAvis={restaurant.nombreAvis}
              taille="grand"
              ton="sombre"
            />
          </div>
        </div>
      </section>

      {/* ---------- corps ---------- */}
      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-14">
          <div className="flex flex-col gap-12">
            <section>
              {restaurant.description && (
                <p className="max-w-2xl text-[17px] leading-relaxed text-[var(--color-ink-soft)]">
                  {restaurant.description}
                </p>
              )}

              <div className="mt-6 grid gap-5 rounded-[24px] border border-[var(--color-line-strong)] bg-white p-6 sm:grid-cols-3">
                <Repere Icone={IconeLieu} libelle="Adresse" lignes={[restaurant.adresse]} />
                <Repere
                  Icone={IconeHorloge}
                  libelle="Horaires"
                  lignes={
                    horaires.length > 0 ? horaires : ["Horaires non communiqués par le restaurant"]
                  }
                />
                {restaurant.capacite && (
                  <Repere
                    Icone={IconeCouverts}
                    libelle="Capacité"
                    lignes={[`${restaurant.capacite} couverts`]}
                  />
                )}
              </div>
            </section>

            {restaurant.platsCuillere.length > 0 && (
              <section>
                <h2 className="mb-5 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
                  Les incontournables
                </h2>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {restaurant.platsCuillere.map((plat) => (
                    <article
                      key={plat.id}
                      className="flex flex-col overflow-hidden rounded-[22px] border border-[var(--color-line-strong)] bg-white"
                    >
                      <div className="relative h-36 w-full">
                        <PhotoCouverture
                          photo={photoPlat(plat)}
                          alt={plat.nom}
                          sizes="(max-width: 640px) 100vw, 300px"
                        />
                        {!estPhotoReelle(plat) && <MarqueIllustration />}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--color-ink)]">
                            {plat.nom}
                          </h3>
                          <span className={pastilleEtat("marque")}>
                            {LIBELLE_CATEGORIE[plat.categorie]}
                          </span>
                        </div>
                        {plat.description && (
                          <p className="text-sm text-[var(--color-ink-muted)]">
                            {plat.description}
                          </p>
                        )}
                        <AllergenesPlat plat={plat} />
                        <p className="mt-auto pt-2 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                          {(plat.prixCentimes / 100).toFixed(2)} €
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-5 font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
                Avis{" "}
                <span className="font-body text-lg font-medium text-[var(--color-ink-muted)]">
                  · {restaurant.avis.length}
                </span>
              </h2>

              <AvisForm
                restaurantId={restaurant.id}
                estConnecte={!!session}
                peutDeposer={dejaServi}
                avisExistant={
                  avisExistant
                    ? {
                        noteCuilleres: avisExistant.noteCuilleres,
                        commentaire: avisExistant.commentaire,
                      }
                    : null
                }
              />

              {restaurant.avis.length === 0 ? (
                <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
                  Pas encore d&apos;avis sur cette adresse.
                </p>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {restaurant.avis.map((avis) => (
                    <article
                      key={avis.id}
                      className="flex flex-col gap-3 rounded-[22px] border border-[var(--color-line-strong)] bg-white p-5"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent-tint)] font-[family-name:var(--font-display)] text-sm font-bold text-[var(--color-accent)]"
                        >
                          {avis.user.name.trim()[0]?.toUpperCase() ?? "?"}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-[var(--color-ink)]">
                            {avis.user.name}
                          </span>
                          <span className="text-xs text-[var(--color-ink-muted)]">
                            {formaterDate(avis.createdAt, { month: "long", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <NoteCuilleres note={avis.noteCuilleres} taille="petit" />
                      {avis.commentaire && (
                        <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
                          {avis.commentaire}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* La carte de réservation suit le défilement : sur une fiche longue,
              le dîneur ne doit pas remonter pour réserver. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <BookingCard
              restaurantId={restaurant.id}
              estConnecte={!!session}
              jours={joursReservables}
              ouvertures={ouvertures}
              occupation={occupation}
              capacite={capaciteEffective(restaurant.capacite)}
              delaiAnnulationHeures={restaurant.delaiAnnulationHeures}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

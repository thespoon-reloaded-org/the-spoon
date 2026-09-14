import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AvisForm } from "@/components/AvisForm";
import { BookingCard } from "@/components/BookingCard";
import { NoteCuilleres } from "@/components/NoteCuilleres";
import { auth } from "@/lib/auth";
import { genererJoursReservables } from "@/lib/creneaux";
import { LIBELLE_CATEGORIE } from "@/lib/plats";
import { prisma } from "@/lib/prisma";

export default async function FicheRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [restaurant, session] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id },
      include: {
        platsCuillere: { orderBy: { createdAt: "desc" } },
        avis: { include: { user: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (!restaurant) notFound();

  // Réservé aux dîneurs déjà servis (réservation confirmée et passée) —
  // cohérent avec la garde faite côté serveur dans `deposerAvis`.
  const dejaServi = session
    ? await prisma.booking.findFirst({
        where: {
          restaurantId: restaurant.id,
          userId: session.user.id,
          statut: "CONFIRMEE",
          date: { lte: new Date() },
        },
        select: { id: true },
      })
    : null;

  const avisExistant = session ? (restaurant.avis.find((a) => a.userId === session.user.id) ?? null) : null;

  return (
    <main>
      {/* hero */}
      <section className="relative mx-4 mt-4 overflow-hidden rounded-[36px] bg-[var(--color-accent)] px-6 py-10 md:mx-6 md:px-16 md:py-14">
        <div className="pointer-events-none absolute -right-20 -top-52 h-[520px] w-[520px] rounded-full bg-[var(--color-accent-soft)] opacity-45" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-[140px] w-[280px] rounded-t-[280px] bg-[var(--color-yellow)] opacity-95" />

        <Link
          href="/"
          className="relative mb-6 inline-block text-sm font-medium text-[#ffe3e9] hover:underline"
        >
          ← Retour à la recherche
        </Link>

        <div className="relative max-w-xl">
          <div className="mb-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--color-yellow)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-ink)]">
              {restaurant.cuisine.toUpperCase()}
            </span>
            <span className="rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-[var(--color-cream)]">
              {restaurant.ville}
            </span>
            {restaurant.horaires && (
              <span className="rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-[var(--color-cream)]">
                {restaurant.horaires}
              </span>
            )}
          </div>

          <h1 className="mb-4 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[0.95] tracking-tight text-[var(--color-cream)] md:text-6xl">
            {restaurant.nom}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-[15px] text-[#ffe3e9]">
            <NoteCuilleres note={restaurant.noteCuilleres} nombreAvis={restaurant.nombreAvis} />
            <span className="opacity-45">|</span>
            <span aria-label={`Adresse : ${restaurant.adresse}`}>{restaurant.adresse}</span>
          </div>
        </div>
      </section>

      {/* corps */}
      <section className="mx-4 mt-8 flex flex-col gap-10 px-2 pb-14 md:mx-6 md:px-4">
        {restaurant.description && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
            {restaurant.description}
          </p>
        )}

        {restaurant.capacite && (
          <dl className="inline-flex w-fit flex-col gap-1 rounded-[22px] border border-[var(--color-line)] bg-white px-6 py-4">
            <dt className="font-mono text-[11px] tracking-wide text-[var(--color-ink-muted)]">
              CAPACITÉ
            </dt>
            <dd className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
              {restaurant.capacite} couverts
            </dd>
          </dl>
        )}

        {restaurant.platsCuillere.length > 0 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
              Les incontournables
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {restaurant.platsCuillere.map((plat) => (
                <div
                  key={plat.id}
                  className="flex flex-col gap-2 rounded-[22px] border border-[var(--color-line)] bg-white p-5"
                >
                  {plat.photoMisAJourLe ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/plats/${plat.id}/photo?v=${plat.photoMisAJourLe.getTime()}`}
                      alt={plat.nom}
                      className="h-32 w-full rounded-[16px] object-cover"
                    />
                  ) : (
                    <span className="text-2xl">🥣</span>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--color-ink)]">
                      {plat.nom}
                    </span>
                    <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-ink)]">
                      {LIBELLE_CATEGORIE[plat.categorie]}
                    </span>
                  </div>
                  {plat.description && (
                    <span className="text-sm text-[var(--color-ink-muted)]">{plat.description}</span>
                  )}
                  <span className="text-sm font-semibold text-[var(--color-ink)]">
                    {(plat.prixCentimes / 100).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-3xl">
              Avis
            </h2>

            <AvisForm
              restaurantId={restaurant.id}
              estConnecte={!!session}
              peutDeposer={!!dejaServi}
              avisExistant={
                avisExistant
                  ? { noteCuilleres: avisExistant.noteCuilleres, commentaire: avisExistant.commentaire }
                  : null
              }
            />

            {restaurant.avis.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-muted)]">Pas encore d&apos;avis.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {restaurant.avis.map((avis) => (
                  <div
                    key={avis.id}
                    className="rounded-[22px] border border-[var(--color-line)] bg-white p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[var(--color-ink)]">{avis.user.name}</span>
                      <span aria-label={`${avis.noteCuilleres} sur 5 cuillères`}>
                        {"🥄".repeat(avis.noteCuilleres)}
                      </span>
                    </div>
                    {avis.commentaire && (
                      <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{avis.commentaire}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="max-w-md">
            <BookingCard
              restaurantId={restaurant.id}
              estConnecte={!!session}
              jours={genererJoursReservables()}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

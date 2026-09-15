import Link from "next/link";

import { NoteCuilleres } from "@/components/NoteCuilleres";
import { prisma } from "@/lib/prisma";

type SearchParams = { ville?: string; cuisine?: string };

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ville, cuisine } = await searchParams;

  const [restaurants, cuisines, platsCuillere] = await Promise.all([
    prisma.restaurant.findMany({
      where: {
        ville: ville ? { equals: ville, mode: "insensitive" } : undefined,
        cuisine: cuisine ? { equals: cuisine, mode: "insensitive" } : undefined,
      },
      orderBy: { nom: "asc" },
    }),
    prisma.restaurant
      .findMany({ distinct: ["cuisine"], select: { cuisine: true }, orderBy: { cuisine: "asc" } })
      .then((rows) => rows.map((r) => r.cuisine)),
    prisma.platCuillere.findMany({
      include: { restaurant: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      {/* hero */}
      <section className="relative mx-4 overflow-hidden rounded-[36px] bg-[var(--color-accent)] px-6 py-12 md:mx-6 md:px-16 md:py-16">
        <div className="pointer-events-none absolute -right-16 -top-44 h-[520px] w-[520px] rounded-full bg-[var(--color-accent-soft)] opacity-45" />
        <div className="pointer-events-none absolute bottom-0 right-16 h-[150px] w-[300px] rounded-t-[300px] bg-[var(--color-yellow)] md:right-72" />

        <div className="relative max-w-xl">
          <span className="mb-5 inline-block rounded-full bg-[var(--color-yellow)] px-4 py-2 text-[13px] font-bold text-[var(--color-ink)]">
            🍽 {restaurants.length} restaurant{restaurants.length > 1 ? "s" : ""} sur TheSpoon
          </span>
          <h1 className="mb-5 font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[0.95] tracking-tight text-[var(--color-cream)] md:text-7xl">
            Trouve ta table.
            <br />
            Pas ta patience.
          </h1>
          <p className="mb-8 max-w-md text-lg leading-relaxed text-[#ffe3e9]">
            Les meilleures adresses près de toi, réservées en deux tapes.
          </p>

          <form
            action="/"
            className="flex flex-col gap-2 rounded-3xl bg-[var(--color-cream)] p-2 sm:flex-row sm:items-center sm:rounded-full sm:pl-6"
          >
            <div className="flex-1 px-4 pt-2 sm:px-0 sm:pt-0">
              <label className="text-[11px] font-bold tracking-wide text-[var(--color-ink-muted)]">OÙ</label>
              <input
                type="text"
                name="ville"
                defaultValue={ville}
                placeholder="Ville"
                className="block w-full bg-transparent text-[15px] font-semibold text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-ink-muted)]"
              />
            </div>
            <div className="hidden h-[34px] w-px bg-[var(--color-line)] sm:block" />
            <div className="flex-1 px-4 pb-2 sm:border-l sm:border-[var(--color-line)] sm:px-4 sm:pb-0">
              <label className="text-[11px] font-bold tracking-wide text-[var(--color-ink-muted)]">
                CUISINE
              </label>
              <input
                type="text"
                name="cuisine"
                defaultValue={cuisine}
                placeholder="Italien, japonais…"
                className="block w-full bg-transparent text-[15px] font-semibold text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-ink-muted)]"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-[var(--color-ink)] px-7 py-4 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)]"
            >
              Chercher
            </button>
          </form>
        </div>
      </section>

      {/* marquee */}
      <div className="my-6 -rotate-[0.6deg] overflow-hidden bg-[var(--color-ink)] py-3.5">
        <div className="flex w-max animate-[spoon-marquee_26s_linear_infinite] gap-10 whitespace-nowrap font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--color-cream)] md:text-xl">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i}>
              {(cuisines.length > 0 ? cuisines : ["TheSpoon"]).map((c) => c.toUpperCase()).join(" ✦ ")}{" "}
              ✦
            </span>
          ))}
        </div>
      </div>

      {/* plats à la cuillère */}
      {platsCuillere.length > 0 && (
        <section className="bg-[var(--color-accent-tint)] px-6 py-10 md:px-14">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-4xl">
            Ce soir, on mange à la cuillère
          </h2>
          <p className="mt-2 max-w-lg text-[var(--color-ink-soft)]">
            TheSpoon, c&apos;est ça avant tout : des plats qui se mangent à la cuillère, chez nos
            restaurants partenaires.
          </p>

          <div className="mt-8 flex gap-5 overflow-x-auto pb-2">
            {platsCuillere.map((plat) => (
              <Link
                key={plat.id}
                href={`/restaurants/${plat.restaurantId}`}
                className="flex w-[260px] shrink-0 flex-col gap-3 rounded-[22px] bg-[var(--color-cream)] p-5"
              >
                {plat.photoMisAJourLe ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/plats/${plat.id}/photo?v=${plat.photoMisAJourLe.getTime()}`}
                    alt={plat.nom}
                    className="h-32 w-full rounded-[16px] object-cover"
                  />
                ) : (
                  <span className="text-3xl">🥣</span>
                )}
                <span className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                  {plat.nom}
                </span>
                {plat.description && (
                  <span className="text-sm text-[var(--color-ink-muted)]">{plat.description}</span>
                )}
                <span className="mt-1 text-sm font-semibold text-[var(--color-accent)]">
                  {plat.restaurant.nom} · {plat.restaurant.ville}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* filtres + grille */}
      <section className="px-6 py-10 md:px-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-4xl">
            Tous les restaurants{" "}
            <span className="text-lg font-medium text-[var(--color-ink-muted)] md:text-xl">
              · {restaurants.length} adresse{restaurants.length > 1 ? "s" : ""}
            </span>
          </h2>
        </div>

        <div className="mb-8 flex flex-wrap gap-2.5">
          <Link
            href="/"
            className={`rounded-full border-[1.5px] px-5 py-2.5 text-sm font-semibold ${
              !cuisine
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "border-[var(--color-line-strong)] text-[var(--color-ink-soft)]"
            }`}
          >
            Tout
          </Link>
          {cuisines.map((c) => (
            <Link
              key={c}
              href={`/?cuisine=${encodeURIComponent(c)}`}
              className={`rounded-full border-[1.5px] px-5 py-2.5 text-sm font-semibold ${
                cuisine?.toLowerCase() === c.toLowerCase()
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "border-[var(--color-line-strong)] text-[var(--color-ink-soft)]"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              href={`/restaurants/${restaurant.id}`}
              className="overflow-hidden rounded-[26px] border border-[var(--color-line)] bg-white"
            >
              {restaurant.photoMisAJourLe ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/restaurants/${restaurant.id}/photo?v=${restaurant.photoMisAJourLe.getTime()}`}
                  alt={restaurant.nom}
                  className="h-[180px] w-full object-cover"
                />
              ) : (
                <div className="relative flex h-[180px] items-center justify-center bg-[repeating-linear-gradient(135deg,#F7E6EA_0_12px,#F0D8DE_12px_24px)]">
                  <span className="font-mono text-[11px] text-[#b09aa1]">[ PHOTO ]</span>
                </div>
              )}
              <div className="flex flex-col gap-2.5 px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
                    {restaurant.nom}
                  </span>
                </div>
                <div className="text-sm text-[var(--color-ink-muted)]">
                  {restaurant.cuisine} · {restaurant.ville}
                </div>
                <NoteCuilleres note={restaurant.noteCuilleres} nombreAvis={restaurant.nombreAvis} />
              </div>
            </Link>
          ))}

          {restaurants.length === 0 && (
            <p className="text-sm text-[var(--color-ink-muted)]">Aucun restaurant pour cette recherche.</p>
          )}
        </div>
      </section>

      {/* footer */}
      <footer className="relative overflow-hidden bg-[var(--color-ink)] px-6 py-12 md:px-14">
        <div className="pointer-events-none absolute bottom-0 right-8 hidden h-[180px] w-[360px] rounded-t-[360px] bg-[var(--color-accent)] md:block" />
        <div className="relative max-w-xl">
          <h3 className="mb-3 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight text-[var(--color-cream)] md:text-4xl">
            Le resto parfait, sans scroller pendant 20 minutes.
          </h3>
          <p className="mb-6 text-[#b9afb3]">Trois adresses par semaine, choisies pour tes goûts.</p>
          <div className="inline-flex items-center gap-4 rounded-full bg-[var(--color-cream)] py-1.5 pl-5 pr-1.5">
            <span className="text-[15px] text-[var(--color-ink-muted)]">ton@email.com</span>
            <span className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-[15px] font-bold text-[var(--color-cream)]">
              Je m&apos;inscris
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

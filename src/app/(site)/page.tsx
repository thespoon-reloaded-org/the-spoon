import Image from "next/image";
import Link from "next/link";

import { IconeCuillere, IconeFleche, IconeLieu, IconeRecherche } from "@/components/Icones";
import { MarqueIllustration } from "@/components/MarqueIllustration";
import { Cuillere, NoteCuilleres } from "@/components/NoteCuilleres";
import { PhotoCouverture } from "@/components/PhotoCouverture";
import { estPhotoReelle, photoCuisine, photoPlat, photoRestaurant } from "@/lib/images";
import { prisma } from "@/lib/prisma";

type SearchParams = { ville?: string; cuisine?: string };

/** Garde les filtres déjà posés quand on en change un — cliquer « Italien » ne doit pas oublier la ville. */
function lienRecherche(filtres: SearchParams): string {
  const params = new URLSearchParams();
  if (filtres.ville) params.set("ville", filtres.ville);
  if (filtres.cuisine) params.set("cuisine", filtres.cuisine);
  const requete = params.toString();
  return requete ? `/?${requete}` : "/";
}

/**
 * Pilule de sélection d'une cuisine — une vignette ronde et un libellé.
 *
 * Elle remplace le bandeau défilant qui occupait cette place : celui-ci
 * égrenait les mêmes cuisines en lettres capitales, ce qui ressemblait à une
 * navigation sans en être une (rien n'y était cliquable), et un texte en
 * mouvement permanent se lit mal. Même information, mais elle filtre
 * vraiment la liste.
 */
function pilleCuisine(actif: boolean): string {
  const base =
    "inline-flex shrink-0 items-center gap-2.5 rounded-full border-[1.5px] py-1.5 pl-1.5 pr-5 text-sm font-semibold transition-colors";
  return actif
    ? `${base} border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]`
    : `${base} border-[var(--color-line-strong)] bg-white text-[var(--color-ink)] hover:border-[var(--color-ink)]`;
}

/**
 * Mots du bandeau défilant.
 *
 * Il affichait les cuisines réellement présentes en base : six mots, donc un
 * bandeau à moitié vide sur un grand écran, et une liste qui se lisait comme
 * un inventaire. C'est un élément de marque, pas un catalogue — il dit ce
 * qu'on vient chercher ici, des plats qui se mangent à la cuillère, en
 * alternant plats et cuisines.
 */
const MOTS_BANDEAU = [
  "VELOUTÉS",
  "ITALIEN",
  "RAMENS",
  "LIBANAIS",
  "MIJOTÉS",
  "JAPONAIS",
  "RISOTTOS",
  "BISTROT",
  "CURRYS",
  "THAÏ",
  "POT-AU-FEU",
  "BOUCHON LYONNAIS",
  "DAHLS",
  "CORÉEN",
  "CHORBAS",
  "VÉGÉ",
  "BOUILLONS PHO",
  "VIETNAMIEN",
  "BLANQUETTES",
  "INDIEN",
  "GASPACHOS",
  "PORTUGAIS",
  "TAJINES",
  "GREC",
  "POLENTAS",
  "PÉRUVIEN",
] as const;

/**
 * Témoignages sur le service TheSpoon.
 *
 * Cette section affichait les derniers `Avis` déposés en base. Or un avis
 * porte sur un restaurant (« le velouté vaut le détour ») : le présenter en
 * page d'accueil comme une recommandation de la plateforme n'a pas de sens —
 * sa place est sur la fiche du restaurant, où il est d'ailleurs déjà affiché.
 *
 * ⚠️ Ceci est du contenu éditorial de remplissage, pas des données : le
 * schéma n'a pas de modèle « avis sur le service ». À remplacer par de vrais
 * témoignages recueillis auprès de dîneurs — ou à retirer — avant toute mise
 * en ligne : publier de faux avis clients est une pratique commerciale
 * trompeuse.
 */
const TEMOIGNAGES = [
  {
    citation:
      "Je ne savais pas qu'il me fallait un site qui ne référence que les plats à la cuillère. Maintenant je ne cherche plus ailleurs.",
    auteur: "Camille B.",
    detail: "Paris, dîneuse depuis 2025",
  },
  {
    citation:
      "La note en cuillères, c'est bête et c'est parfait : je sais tout de suite si le mijoté vaut le déplacement.",
    auteur: "Yanis M.",
    detail: "Lyon, 14 réservations",
  },
  {
    citation:
      "Table pour six un dimanche soir, confirmée dans la seconde. Zéro coup de téléphone, zéro rappel pour rien.",
    auteur: "Sofia L.",
    detail: "Paris, dîneuse depuis 2024",
  },
] as const;

const ETAPES = [
  {
    titre: "Trouve ton adresse",
    texte: "Filtre par ville et par type de cuisine, compare les notes en cuillères.",
    Icone: IconeRecherche,
  },
  {
    titre: "Réserve ton créneau",
    texte: "Midi ou soir, jusqu'à cinq jours à l'avance, sur les créneaux réellement ouverts.",
    Icone: IconeLieu,
  },
  {
    titre: "Note en cuillères",
    texte: "Après le repas, laisse une note de 1 à 5 cuillères et un mot au restaurant.",
    Icone: IconeCuillere,
  },
] as const;

export default async function RecherchePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { ville, cuisine } = await searchParams;

  const [restaurants, cuisines, platsCuillere, totalRestaurants, agregatAvis] = await Promise.all([
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
      take: 8,
    }),
    prisma.restaurant.count(),
    prisma.avis.aggregate({ _count: true, _avg: { noteCuilleres: true } }),
  ]);

  const filtreActif = Boolean(ville || cuisine);

  return (
    /*
     * Rythme vertical : c'est ce conteneur qui espace les blocs, pas chaque
     * section. Quand chacune portait son propre `py`, deux sections voisines
     * cumulaient leurs paddings et l'écart changeait à chaque fois — 8 ici,
     * 12 là, 26 entre le bandeau et la section suivante. Les sections ne
     * gardent que leurs marges horizontales ; seule la bande colorée
     * « à la cuillère » conserve un padding interne, parce qu'elle a un fond.
     */
    <div className="flex flex-col gap-14 md:gap-20">
      {/* ---------- hero ---------- */}
      <section className="relative mx-3 mt-3 overflow-hidden rounded-[32px] bg-[var(--color-accent)] px-6 py-12 md:mx-6 md:rounded-[40px] md:px-14 md:py-16">
        <div className="pointer-events-none absolute -right-24 -top-48 h-[540px] w-[540px] rounded-full bg-[var(--color-accent-soft)] opacity-40" />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 h-[220px] w-[380px] rounded-t-full bg-[var(--color-yellow)] opacity-20" />

        <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <div>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--color-yellow)] px-4 py-2 text-[13px] font-bold text-[var(--color-ink)]">
              <IconeCuillere taille={15} />
              {totalRestaurants} adresse{totalRestaurants > 1 ? "s" : ""} à la cuillère
            </span>

            {/* Le concept doit tenir dans le titre : « Trouve ta table. Pas ta
                patience. » vendait de la réservation rapide, ce que fait
                n'importe quelle plateforme, et laissait la cuillère invisible
                jusqu'au milieu de la page. */}
            <h1 className="mb-5 font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[0.95] tracking-tight text-[var(--color-cream)] md:text-7xl">
              Trouve ta table.
              <br />
              Prends ta cuillère.
            </h1>
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-[#ffe3e9]">
              TheSpoon ne référence que les restaurants dont le meilleur plat se mange à la cuillère
              — veloutés, mijotés, risottos, ramens. Tu réserves en deux tapes, tu notes en
              cuillères.
            </p>

            <form
              action="/"
              className="flex flex-col gap-2 rounded-[28px] bg-[var(--color-cream)] p-2 shadow-[var(--shadow-flottant)] sm:flex-row sm:items-center sm:rounded-full sm:pl-5"
            >
              <label className="flex flex-1 items-center gap-3 px-3 py-2 sm:px-0">
                <IconeLieu taille={19} className="shrink-0 text-[var(--color-ink-muted)]" />
                <span className="flex flex-col">
                  <span className="text-[11px] font-bold tracking-wide text-[var(--color-ink-muted)]">
                    OÙ
                  </span>
                  <input
                    type="text"
                    name="ville"
                    defaultValue={ville}
                    placeholder="Ville"
                    className="block w-full bg-transparent text-[15px] font-semibold text-[var(--color-ink)] placeholder:font-normal placeholder:text-[var(--color-ink-muted)]"
                  />
                </span>
              </label>

              <span className="hidden h-9 w-px bg-[var(--color-line-strong)] sm:block" />

              <label className="flex flex-1 items-center gap-3 px-3 py-2 sm:px-4">
                <IconeCuillere taille={19} className="shrink-0 text-[var(--color-ink-muted)]" />
                <span className="flex flex-col">
                  <span className="text-[11px] font-bold tracking-wide text-[var(--color-ink-muted)]">
                    CUISINE
                  </span>
                  <input
                    type="text"
                    name="cuisine"
                    defaultValue={cuisine}
                    placeholder="Italien, japonais…"
                    className="block w-full bg-transparent text-[15px] font-semibold text-[var(--color-ink)] placeholder:font-normal placeholder:text-[var(--color-ink-muted)]"
                  />
                </span>
              </label>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-ink)] px-7 py-4 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] transition-colors hover:bg-[var(--color-ink-soft)]"
              >
                <IconeRecherche taille={17} />
                Chercher
              </button>
            </form>

            {agregatAvis._count > 0 && (
              <p className="mt-5 text-sm text-[#ffd0da]">
                <strong className="font-semibold text-[var(--color-cream)]">
                  {agregatAvis._avg.noteCuilleres?.toFixed(1)}/5
                </strong>{" "}
                de moyenne sur {agregatAvis._count} avis déposés par des dîneurs qui y étaient
                vraiment.
              </p>
            )}
          </div>

          {/* Composition photo — décorative, donc masquée aux lecteurs d'écran et sur petit écran. */}
          <div aria-hidden className="relative hidden h-[420px] lg:block">
            <div className="absolute right-0 top-0 h-[320px] w-[360px] overflow-hidden rounded-[28px] shadow-[var(--shadow-flottant)]">
              <Image
                src="/images/hero-salle.jpg"
                alt=""
                fill
                priority
                sizes="360px"
                className="object-cover"
              />
            </div>
            <div className="absolute bottom-0 left-0 h-[200px] w-[210px] overflow-hidden rounded-[24px] border-4 border-[var(--color-accent)] shadow-[var(--shadow-flottant)]">
              <Image
                src="/images/hero-tablee.jpg"
                alt=""
                fill
                sizes="240px"
                className="object-cover"
              />
            </div>
            {/* Illustration du principe de notation, pas une statistique : on
                montre cinq cuillères sans chiffre, parce qu'afficher une note
                en dur se lirait comme la note moyenne du site. La vraie
                moyenne, elle, est sous le formulaire de recherche. */}
            <div className="absolute bottom-6 right-2 flex flex-col gap-1.5 rounded-2xl bg-[var(--color-cream)] px-4 py-3 shadow-[var(--shadow-flottant)]">
              <span className="flex items-center gap-1 text-[var(--color-accent)]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Cuillere key={i} pleine={i < 4} taille={19} />
                ))}
              </span>
              <span className="text-xs font-semibold text-[var(--color-ink)]">
                Ici, on note en cuillères
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- bandeau défilant ----------
           `overflow-x-clip` plutôt que `overflow-hidden` : il faut rogner ce qui
           dépasse sur les côtés (le bandeau est volontairement plus large que
           la fenêtre) sans rogner en hauteur, sinon la rotation coupe les coins
           du bandeau. Et c'est bien cette largeur excédentaire qui évite les
           deux triangles de fond qui apparaissaient en haut à gauche et en bas
           à droite, là où le bandeau incliné ne touchait plus les bords. */}
      <div className="overflow-x-clip">
        <div className="-ml-[3%] w-[106%] -rotate-[0.6deg] overflow-hidden bg-[var(--color-ink)] py-3.5">
          <div className="flex w-max animate-[spoon-marquee_120s_linear_infinite] whitespace-nowrap font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--color-cream)] md:text-xl">
            {/* Deux copies strictement identiques : l'animation translate de
                -50 %, la seconde vient donc prendre exactement la place de la
                première et la boucle ne se voit pas. La seconde est masquée
                aux lecteurs d'écran, qui liraient sinon la liste deux fois. */}
            {[0, 1].map((copie) => (
              <div key={copie} className="flex shrink-0 items-center" aria-hidden={copie === 1}>
                {MOTS_BANDEAU.map((mot) => (
                  <span key={mot} className="flex items-center gap-10 pr-10 md:gap-16 md:pr-16">
                    {mot}
                    <span className="text-[var(--color-accent-soft)]">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- comment ça marche ---------- */}
      <section className="mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <div className="grid gap-5 sm:grid-cols-3">
          {ETAPES.map(({ titre, texte, Icone }, index) => (
            <div
              key={titre}
              className="rounded-[26px] border border-[var(--color-line-strong)] bg-white p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
                  <Icone taille={21} />
                </span>
                <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
                  ÉTAPE {index + 1}
                </span>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
                {titre}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- plats à la cuillère ---------- */}
      {platsCuillere.length > 0 && (
        <section className="bg-[var(--color-accent-tint)] py-14 md:py-16">
          <div className="mx-auto max-w-[1400px] px-5 md:px-10">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-4xl">
              Ce soir, on mange à la cuillère
            </h2>
            <p className="mt-2 max-w-lg text-[var(--color-ink-soft)]">
              TheSpoon, c&apos;est ça avant tout : des plats qui se mangent à la cuillère, chez nos
              restaurants partenaires.
            </p>

            <div className="defilement-doux mt-8 flex gap-5 overflow-x-auto pb-3">
              {platsCuillere.map((plat) => (
                <Link
                  key={plat.id}
                  href={`/restaurants/${plat.restaurantId}`}
                  className="group flex w-[270px] shrink-0 flex-col overflow-hidden rounded-[24px] bg-[var(--color-cream)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-carte-levee)]"
                >
                  <div className="relative h-36 w-full overflow-hidden">
                    <PhotoCouverture
                      photo={photoPlat(plat)}
                      alt={plat.nom}
                      sizes="270px"
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                    {!estPhotoReelle(plat) && <MarqueIllustration />}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <span className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                      {plat.nom}
                    </span>
                    {plat.description && (
                      <span className="line-clamp-2 text-sm text-[var(--color-ink-muted)]">
                        {plat.description}
                      </span>
                    )}
                    <span className="mt-auto pt-2 text-sm font-semibold text-[var(--color-accent)]">
                      {plat.restaurant.nom} · {plat.restaurant.ville}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- filtres + grille ---------- */}
      <section className="mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-4xl">
            {filtreActif ? "Résultats" : "Tous les restaurants"}{" "}
            <span className="text-lg font-medium text-[var(--color-ink-muted)] md:text-xl">
              · {restaurants.length} adresse{restaurants.length > 1 ? "s" : ""}
            </span>
          </h2>
          {filtreActif && (
            <Link
              href="/"
              className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
            >
              Effacer les filtres
            </Link>
          )}
        </div>

        {cuisines.length > 0 && (
          <div
            className="defilement-doux -mx-1 mb-8 flex gap-2.5 overflow-x-auto px-1 pb-2"
            aria-label="Filtrer par cuisine"
          >
            <Link href={lienRecherche({ ville })} className={pilleCuisine(!cuisine)}>
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  cuisine
                    ? "bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
                    : "bg-white/15 text-[var(--color-cream)]"
                }`}
              >
                <IconeCuillere taille={17} />
              </span>
              Tout
            </Link>

            {cuisines.map((c) => (
              <Link
                key={c}
                href={lienRecherche({ ville, cuisine: c })}
                className={pilleCuisine(cuisine?.toLowerCase() === c.toLowerCase())}
              >
                <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                  <PhotoCouverture photo={photoCuisine(c)} alt="" sizes="32px" />
                </span>
                {c}
              </Link>
            ))}
          </div>
        )}

        {restaurants.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[26px] border border-dashed border-[var(--color-line-strong)] bg-white px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
              <IconeRecherche taille={24} />
            </span>
            <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
              Aucune adresse pour cette recherche
            </p>
            <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
              Essaie une autre ville ou un autre type de cuisine — la carte TheSpoon s&apos;agrandit
              chaque semaine.
            </p>
            <Link
              href="/"
              className="mt-2 rounded-full bg-[var(--color-ink)] px-6 py-3 text-sm font-bold text-[var(--color-cream)]"
            >
              Voir tous les restaurants
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {restaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                href={`/restaurants/${restaurant.id}`}
                className="group flex flex-col overflow-hidden rounded-[26px] border border-[var(--color-line-strong)] bg-white transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-carte-levee)]"
              >
                <div className="relative h-[190px] w-full overflow-hidden">
                  <PhotoCouverture
                    photo={photoRestaurant(restaurant)}
                    alt={restaurant.nom}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 45vw, 320px"
                    className="transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-[var(--color-cream)]/95 px-3 py-1 text-xs font-bold text-[var(--color-ink)] backdrop-blur">
                    {restaurant.cuisine}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-5 py-4">
                  <span className="font-[family-name:var(--font-display)] text-xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                    {restaurant.nom}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-muted)]">
                    <IconeLieu taille={15} />
                    {restaurant.ville}
                  </span>
                  <span className="mt-auto pt-2">
                    <NoteCuilleres
                      note={restaurant.noteCuilleres}
                      nombreAvis={restaurant.nombreAvis}
                      taille="petit"
                    />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------- ce qu'en disent les dîneurs ---------- */}
      <section className="mx-3 md:mx-6">
        <div className="relative overflow-hidden rounded-[32px] bg-[var(--color-accent)] px-6 py-12 md:rounded-[40px] md:px-14 md:py-16">
          <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[var(--color-accent-soft)] opacity-35" />
          <div className="pointer-events-none absolute -bottom-24 right-10 h-[260px] w-[260px] rounded-full bg-[var(--color-yellow)] opacity-20" />

          <div className="relative">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-cream)] md:text-4xl">
              Ce qu&apos;en disent les dîneurs
            </h2>
            <p className="mt-2 max-w-lg text-[#ffe3e9]">
              Des gens qui cherchaient une bonne adresse et qui sont repartis avec une cuillère.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {TEMOIGNAGES.map((temoignage) => (
                <figure
                  key={temoignage.auteur}
                  className="flex flex-col gap-4 rounded-[26px] bg-[var(--color-cream)] p-6 shadow-[var(--shadow-carte)]"
                >
                  <span
                    aria-hidden
                    className="font-[family-name:var(--font-display)] text-5xl leading-none text-[var(--color-yellow)]"
                  >
                    &ldquo;
                  </span>
                  <blockquote className="flex-1 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                    {temoignage.citation}
                  </blockquote>
                  <figcaption className="flex items-center gap-3 border-t border-[var(--color-line)] pt-4">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] font-[family-name:var(--font-display)] text-sm font-bold text-white"
                    >
                      {temoignage.auteur[0]}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold text-[var(--color-ink)]">
                        {temoignage.auteur}
                      </span>
                      <span className="text-xs text-[var(--color-ink-muted)]">
                        {temoignage.detail}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- appel aux restaurateurs ---------- */}
      <section className="mx-auto w-full max-w-[1400px] px-5 md:px-10">
        <div className="grid overflow-hidden rounded-[32px] bg-[var(--color-pro)] md:grid-cols-2">
          <div className="flex flex-col justify-center gap-5 p-8 md:p-12">
            <span className="w-fit rounded-full bg-[var(--color-pro-accent)] px-3.5 py-1.5 text-xs font-bold text-[var(--color-pro-deep)]">
              ESPACE RESTAURATEUR
            </span>
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight text-[var(--color-cream)] md:text-4xl">
              Votre salle, vos règles.
            </h2>
            <p className="max-w-md leading-relaxed text-[#b6cdc4]">
              Réservations reçues, disponibilités, carte, fiche établissement et factures mensuelles
              : tout se pilote depuis un seul espace.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/connexion-restaurant"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-pro-accent)] px-6 py-3.5 font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-pro-deep)] transition-transform hover:-translate-y-0.5"
              >
                Accéder à mon espace
                <IconeFleche taille={18} />
              </Link>
              <Link
                href="/devenir-partenaire"
                className="text-sm font-semibold text-[#b6cdc4] hover:text-[var(--color-cream)] hover:underline"
              >
                Pas encore partenaire ? Contactez-nous
              </Link>
            </div>
          </div>
          <div className="relative min-h-[260px]">
            <Image
              src="/images/restaurateur-cta.jpg"
              alt="Une restauratrice derrière son comptoir"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

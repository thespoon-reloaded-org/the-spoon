import type { Metadata } from "next";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import {
  ClassementBarres,
  HistogrammeColonnes,
  type BarreClassement,
} from "@/components/GraphiquesIndicateurs";
import { IconeChevron } from "@/components/Icones";
import { Indicateur } from "@/components/Indicateur";
import { NoteCuilleres } from "@/components/NoteCuilleres";
import { JOURS_SEMAINE_COURTS, JOURS_SEMAINE_ISO } from "@/lib/creneaux";
import { formaterJourEtHeure, formaterJourSansSemaine } from "@/lib/fuseau";
import { exigerSessionStaff } from "@/lib/garde-staff";
import {
  PERIODES,
  activite,
  bornesPeriode,
  evolution,
  fiabilite,
  formaterEvolution,
  formaterPart,
  habitudes,
  lirePeriode,
  part,
  syntheseAssistant,
  syntheseAvis,
  type Bornes,
  type EntreeClassement,
  type Periode,
} from "@/lib/indicateurs";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW, TITRE_SECTION } from "@/lib/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

function nombre(valeur: number): string {
  return valeur.toLocaleString("fr-FR");
}

function pluriel(n: number, singulier: string, formePlurielle = `${singulier}s`): string {
  return `${nombre(n)} ${n > 1 ? formePlurielle : singulier}`;
}

/** L'écart à la période précédente, en vert ou en rouge — ici, plus c'est toujours mieux. */
function Tendance({
  actuel,
  precedent,
  periode,
}: {
  actuel: number;
  precedent: number;
  periode: Periode;
}) {
  const valeur = evolution(actuel, precedent);
  if (valeur === null) return <>rien sur les {periode} jours d&apos;avant</>;

  const texte = formaterEvolution(valeur);
  const couleur =
    Math.round(valeur * 100) === 0
      ? "text-[var(--color-ink-soft)]"
      : valeur > 0
        ? "text-[var(--color-success)]"
        : "text-[var(--color-danger)]";
  return (
    <>
      <span className={`font-semibold ${couleur}`}>{texte}</span> vs les {periode} jours
      d&apos;avant
    </>
  );
}

function Section({
  titre,
  description,
  children,
}: {
  titre: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first-of-type:mt-0">
      <h2 className={TITRE_SECTION}>{titre}</h2>
      <p className="mb-4 mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>
      {children}
    </section>
  );
}

function RienSurLaPeriode({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-[var(--color-ink-muted)]">{children}</p>;
}

function barres(
  entrees: readonly EntreeClassement[],
  href?: (cle: string) => string,
): BarreClassement[] {
  return entrees.map((entree) => ({
    cle: entree.cle,
    libelle: entree.libelle,
    valeur: entree.nombre,
    detail: `${nombre(entree.nombre)} · ${formaterPart(entree.part)}`,
    href: href?.(entree.cle),
  }));
}

function SelecteurPeriode({ active }: { active: Periode }) {
  return (
    <nav
      aria-label="Période"
      className="inline-flex rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-white p-1"
    >
      {PERIODES.map((periode) => (
        <Link
          key={periode}
          href={`/admin/tableau-de-bord?periode=${periode}`}
          aria-current={periode === active ? "page" : undefined}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            periode === active
              ? "bg-[var(--color-staff)] text-[var(--color-cream)]"
              : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          }`}
        >
          {periode} jours
        </Link>
      ))}
    </nav>
  );
}

/**
 * Tableau de bord de la console staff : les habitudes des dîneurs, où ils
 * vont, et s'ils sont satisfaits — des avis comme des propositions de
 * l'assistant de recherche.
 *
 * Tout est lu à l'affichage, rien n'est précalculé : les volumes d'une
 * période (quelques milliers de réservations) tiennent dans une requête. Les
 * définitions — ce qui compte comme une réservation, un dîneur fidèle, un
 * no-show — sont écrites une fois, dans `src/lib/indicateurs.ts`.
 */
export default async function TableauDeBordAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string | string[] }>;
}) {
  await exigerSessionStaff();

  const periode = lirePeriode((await searchParams).periode);
  const maintenant = new Date();
  const { courante, precedente } = bornesPeriode(periode, maintenant);
  const creeSur = (bornes: Bornes) => ({ createdAt: { gte: bornes.debut, lt: bornes.fin } });

  const [
    reservations,
    reservationsPrecedentes,
    inscrits,
    inscritsPrecedents,
    servicesParStatut,
    avisParNote,
    propositionsParVerdict,
    coeursBrises,
    restaurants,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: creeSur(courante),
      select: { statut: true, couverts: true, userId: true, date: true, restaurantId: true },
    }),
    prisma.booking.findMany({
      where: creeSur(precedente),
      select: { statut: true, couverts: true, userId: true },
    }),
    prisma.user.count({ where: creeSur(courante) }),
    prisma.user.count({ where: creeSur(precedente) }),
    // Les services de la période déjà passés, quelle que soit la date à
    // laquelle la table a été réservée : c'est leur issue qu'on regarde.
    prisma.booking.groupBy({
      by: ["statut"],
      where: { date: { gte: courante.debut, lt: maintenant } },
      _count: { _all: true },
    }),
    prisma.avis.groupBy({
      by: ["noteCuilleres"],
      where: creeSur(courante),
      _count: { _all: true },
    }),
    prisma.propositionAssistant.groupBy({
      by: ["verdict"],
      where: creeSur(courante),
      _count: { _all: true },
    }),
    prisma.propositionAssistant.findMany({
      where: { ...creeSur(courante), verdict: "AIME_PAS" },
      orderBy: { verdictLe: "desc" },
      take: 5,
      select: { id: true, demande: true, verdictLe: true, createdAt: true },
    }),
    // Tous, sans attendre de savoir lesquels ont été réservés : quelques
    // centaines de lignes coûtent moins qu'un second aller-retour en série.
    prisma.restaurant.findMany({ select: { id: true, nom: true, ville: true, cuisine: true } }),
  ]);

  const actuelle = activite(reservations);
  const precedenteActivite = activite(reservationsPrecedentes);
  const lieux = habitudes(reservations, new Map(restaurants.map((r) => [r.id, r])));
  const services = fiabilite(
    Object.fromEntries(servicesParStatut.map((ligne) => [ligne.statut, ligne._count._all])),
  );
  const avis = syntheseAvis(
    new Map(avisParNote.map((ligne) => [ligne.noteCuilleres, ligne._count._all])),
  );
  const assistant = syntheseAssistant(
    new Map(propositionsParVerdict.map((ligne) => [ligne.verdict, ligne._count._all])),
  );

  const maintenues = actuelle.reservations - actuelle.annulees;
  const tableMoyenne = maintenues > 0 ? actuelle.couverts / maintenues : null;
  const servicesPointes = services.honorees + services.noShows;

  return (
    <>
      <EnteteEspace
        titre="Tableau de bord"
        description={`Depuis le ${formaterJourSansSemaine(courante.debut)}, comparé aux ${periode} jours d'avant à la même heure.`}
        actions={<SelecteurPeriode active={periode} />}
      />

      <Section
        titre="Activité"
        description="Les réservations prises sur la période, et les dîneurs qui les ont faites."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicateur
            libelle="Réservations prises"
            valeur={nombre(actuelle.reservations)}
            precision={
              <Tendance
                actuel={actuelle.reservations}
                precedent={precedenteActivite.reservations}
                periode={periode}
              />
            }
          />
          <Indicateur
            libelle="Couverts réservés"
            valeur={nombre(actuelle.couverts)}
            precision={
              <Tendance
                actuel={actuelle.couverts}
                precedent={precedenteActivite.couverts}
                periode={periode}
              />
            }
          />
          <Indicateur
            libelle="Dîneurs actifs"
            valeur={nombre(actuelle.dineursActifs)}
            precision={
              <Tendance
                actuel={actuelle.dineursActifs}
                precedent={precedenteActivite.dineursActifs}
                periode={periode}
              />
            }
          />
          <Indicateur
            libelle="Nouveaux inscrits"
            valeur={nombre(inscrits)}
            precision={
              <Tendance actuel={inscrits} precedent={inscritsPrecedents} periode={periode} />
            }
          />
        </div>
      </Section>

      <Section
        titre="Habitudes"
        description="Comment ils réservent, et s'ils viennent. Le no-show se lit sur les services passés de la période."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicateur
            libelle="Fidélité"
            valeur={formaterPart(part(actuelle.dineursFideles, actuelle.dineursActifs))}
            precision={
              actuelle.dineursActifs > 0
                ? "des dîneurs actifs ont réservé au moins deux fois"
                : "aucun dîneur actif sur la période"
            }
          />
          <Indicateur
            libelle="Table moyenne"
            valeur={
              tableMoyenne === null
                ? "—"
                : tableMoyenne.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
            }
            precision={
              tableMoyenne === null ? "aucune réservation maintenue" : "couverts par réservation"
            }
          />
          <Indicateur
            libelle="Annulations"
            valeur={formaterPart(part(actuelle.annulees, actuelle.reservations))}
            precision={
              actuelle.reservations > 0
                ? pluriel(actuelle.annulees, "réservation annulée", "réservations annulées")
                : "aucune réservation prise"
            }
          />
          <Indicateur
            libelle="No-show"
            valeur={formaterPart(services.tauxNoShow)}
            precision={
              <>
                {servicesPointes > 0
                  ? `sur ${pluriel(servicesPointes, "service pointé", "services pointés")}`
                  : "aucun service pointé"}
                {services.nonPointees > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold text-[var(--color-warning)]">
                      {nombre(services.nonPointees)} à pointer
                    </span>
                  </>
                )}
              </>
            }
          />
        </div>

        <div className={`${CARTE} mt-4`}>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-[var(--color-ink)]">Jours de service</h3>
            {lieux.total > 0 && (
              <p className="text-sm text-[var(--color-ink-muted)]">
                <strong className="font-semibold text-[var(--color-ink)]">
                  {formaterPart(part(lieux.soir, lieux.total))}
                </strong>{" "}
                le soir · {formaterPart(part(lieux.midi, lieux.total))} le midi
              </p>
            )}
          </div>
          {lieux.total === 0 ? (
            <RienSurLaPeriode>Aucune réservation maintenue sur la période.</RienSurLaPeriode>
          ) : (
            <HistogrammeColonnes
              colonnes={lieux.parJourSemaine.map((valeur, jour) => ({
                cle: String(jour),
                libelle: JOURS_SEMAINE_COURTS[jour]!,
                libelleLong: JOURS_SEMAINE_ISO[jour]!,
                valeur,
                detail: `${pluriel(valeur, "réservation")} (${formaterPart(part(valeur, lieux.total))})`,
              }))}
            />
          )}
        </div>
      </Section>

      <Section
        titre="Où ils vont"
        description="Les cinq premiers, sur les réservations prises et non annulées de la période."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              {
                titre: "Restaurants",
                entrees: barres(lieux.restaurants, (id) => `/admin/restaurants/${id}`),
              },
              { titre: "Villes", entrees: barres(lieux.villes) },
              { titre: "Cuisines", entrees: barres(lieux.cuisines) },
            ] as const
          ).map(({ titre, entrees }) => (
            <div key={titre} className={CARTE}>
              <h3 className="mb-4 font-semibold text-[var(--color-ink)]">{titre}</h3>
              {entrees.length === 0 ? (
                <RienSurLaPeriode>Aucune réservation sur la période.</RienSurLaPeriode>
              ) : (
                <ClassementBarres barres={entrees} libelle={`${titre} les plus réservés`} />
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section
        titre="Satisfaction"
        description="Les avis déposés sur la période, et le verdict des dîneurs sur les propositions de l'assistant de recherche."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={CARTE}>
            <h3 className="font-semibold text-[var(--color-ink)]">Avis des dîneurs</h3>
            {avis.total === 0 ? (
              <RienSurLaPeriode>Aucun avis déposé sur la période.</RienSurLaPeriode>
            ) : (
              <>
                <div className="mb-5 mt-3">
                  <NoteCuilleres note={avis.moyenne} nombreAvis={avis.total} taille="grand" />
                </div>
                <ClassementBarres
                  libelle="Répartition des notes"
                  barres={[5, 4, 3, 2, 1].map((note) => {
                    const nombreAvis = avis.parNote[note - 1]!;
                    return {
                      cle: String(note),
                      libelle: pluriel(note, "cuillère"),
                      valeur: nombreAvis,
                      detail: `${nombre(nombreAvis)} · ${formaterPart(part(nombreAvis, avis.total))}`,
                    };
                  })}
                />
              </>
            )}
          </div>

          <div className={CARTE}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-[var(--color-ink)]">Assistant de recherche</h3>
              <Link
                href="/admin/assistant"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-staff)] hover:underline"
              >
                Toutes les propositions
                <IconeChevron taille={15} />
              </Link>
            </div>
            {assistant.servies === 0 ? (
              <RienSurLaPeriode>
                L&apos;assistant n&apos;a servi aucune proposition sur la période.
              </RienSurLaPeriode>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <p className={EYEBROW}>Satisfaction</p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
                      {formaterPart(assistant.satisfaction)}
                    </p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      {assistant.satisfaction === null
                        ? "pas encore de vote"
                        : `${pluriel(assistant.aime, "cœur plein", "cœurs pleins")} · ${pluriel(assistant.aimePas, "cœur brisé", "cœurs brisés")}`}
                    </p>
                  </div>
                  <div>
                    <p className={EYEBROW}>Taux de vote</p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
                      {formaterPart(assistant.tauxVote)}
                    </p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      sur {pluriel(assistant.servies, "proposition servie", "propositions servies")}
                    </p>
                  </div>
                </div>

                {assistant.satisfaction !== null && (
                  <div
                    aria-hidden="true"
                    className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-staff-tint)]"
                  >
                    <div
                      className="h-full rounded-full bg-[var(--color-staff-accent)]"
                      style={{ width: `${assistant.satisfaction * 100}%` }}
                    />
                  </div>
                )}

                <h4 className={`${EYEBROW} mb-2 mt-6`}>Derniers cœurs brisés</h4>
                {coeursBrises.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-muted)]">Aucun sur la période.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-[var(--color-line)]">
                    {coeursBrises.map((proposition) => (
                      <li key={proposition.id}>
                        <Link
                          href={`/admin/assistant/${proposition.id}`}
                          className="group block py-2.5 text-sm"
                        >
                          <p className="line-clamp-2 text-[var(--color-ink)] group-hover:underline">
                            « {proposition.demande} »
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                            {formaterJourEtHeure(proposition.verdictLe ?? proposition.createdAt)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </Section>
    </>
  );
}

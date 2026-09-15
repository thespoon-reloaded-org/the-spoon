import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { authRestaurant } from "@/lib/auth";
import {
  CRENEAUX_HORAIRES,
  CRENEAUX_MIDI,
  CRENEAUX_SOIR,
  formatMoisLabel,
  genererGrilleMois,
  JOURS_SEMAINE_ISO,
  jourSemaineIso,
  moisAdjacent,
  moisIso as calculerMoisIso,
  type JourCalendrier,
} from "@/lib/creneaux";
import { prisma } from "@/lib/prisma";
import { BOUTON_SECONDAIRE, CARTE, TITRE_SECTION } from "@/lib/ui";

import { basculerException, basculerExceptionJournee, basculerHoraireHebdo } from "./actions";

export const metadata: Metadata = { title: "Disponibilités" };

const CHIP_OUVERT =
  "rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]";
const CHIP_FERME =
  "rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-white";
// Tailwind résout les classes en conflit (border-*, bg-*, text-*) par l'ordre
// de la feuille de style générée, pas par l'ordre du texte : concaténer une
// classe de base avec des utilitaires qui la contredisent ne l'override pas
// de façon fiable — toujours une variante complète à la place (vécu ici :
// une case sélectionnée illisible, `text-cream` perdant contre `text-ink`).
const CARTE_FERMEE =
  "rounded-2xl border-[1.5px] border-[var(--color-accent)] bg-[var(--color-accent-tint)] p-5";
const JOUR_ISO_LETTRES = ["L", "M", "M", "J", "V", "S", "D"];
const REGEX_JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

const CELLULE =
  "relative flex aspect-square items-center justify-center rounded-xl text-sm font-semibold";

function classeCellule(jour: JourCalendrier, estSelectionne: boolean): string {
  if (estSelectionne) return `${CELLULE} bg-[var(--color-accent)] text-white`;
  if (jour.horsMois) return `${CELLULE} text-[var(--color-ink-muted)] opacity-40`;
  const anneau = jour.estAujourdhui ? " ring-[1.5px] ring-[var(--color-accent)]" : "";
  return `${CELLULE} text-[var(--color-ink)] transition-colors hover:bg-[var(--color-line)]${anneau}`;
}

/** Une rangée "Midi" ou "Soir" de chips créneaux — factorisé, utilisé pour le planning récurrent et les exceptions. */
function RangeeCreneaux({
  titre,
  creneaux,
  rendreBouton,
}: {
  titre: string;
  creneaux: readonly string[];
  rendreBouton: (creneau: string) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[var(--color-ink-muted)]">{titre}</span>
      <div className="flex flex-wrap gap-2">{creneaux.map(rendreBouton)}</div>
    </div>
  );
}

/** Légende partagée par les deux sections — mêmes couleurs, même sens partout sur cet écran. */
function Legende() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[var(--color-ink-muted)]">
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-white" />
        Ouvert
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-[var(--color-accent)]" />
        Fermé
      </span>
      <span>• = diffère du planning habituel ce jour-là</span>
    </div>
  );
}

/**
 * Deux plannings distincts, tous deux vérifiés par `creerReservation` :
 * l'horaire d'ouverture classique (récurrent, non daté — un jour de semaine
 * fermé toutes les semaines) et les exceptions ponctuelles sur une date
 * précise (ouverture OU fermeture — voir le calendrier ci-dessous), qui
 * recouvrent le récurrent pour ce seul jour. Pas de client component ici —
 * chaque bouton est son propre formulaire server action, la navigation par
 * ?mois=&jour= suffit pour le calendrier.
 */
export default async function DisponibilitesPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; jour?: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null;

  const restaurantId = session.user.restaurantId;
  const params = await searchParams;

  const moisActuel =
    params.mois && /^\d{4}-\d{2}$/.test(params.mois) ? params.mois : calculerMoisIso();
  const jourSelectionne = params.jour && REGEX_JOUR_ISO.test(params.jour) ? params.jour : null;
  const grille = genererGrilleMois(moisActuel);

  const [horairesFermes, exceptions] = await Promise.all([
    prisma.horaireFermeture.findMany({ where: { restaurantId } }),
    prisma.exceptionHoraire.findMany({
      where: { restaurantId, jour: { gte: grille[0]!.iso, lte: grille[41]!.iso } },
    }),
  ]);

  const hebdoJoursFermes = new Set(
    horairesFermes.filter((h) => h.creneau === null).map((h) => h.jourSemaine),
  );
  const hebdoCreneauxFermes = new Set(
    horairesFermes.filter((h) => h.creneau !== null).map((h) => `${h.jourSemaine}|${h.creneau}`),
  );

  function fermeParRecurrent(jourSemaine: number, creneau: string): boolean {
    return (
      hebdoJoursFermes.has(jourSemaine) || hebdoCreneauxFermes.has(`${jourSemaine}|${creneau}`)
    );
  }

  const joursAvecException = new Set(exceptions.map((e) => e.jour));

  const jourSemaineSelectionne = jourSelectionne
    ? jourSemaineIso(new Date(`${jourSelectionne}T00:00:00`))
    : null;
  const exceptionParCreneau = new Map(
    exceptions.filter((e) => e.jour === jourSelectionne).map((e) => [e.creneau, e.ouvert]),
  );

  function effectifOuvert(creneau: string): boolean {
    if (exceptionParCreneau.has(creneau)) return exceptionParCreneau.get(creneau)!;
    return jourSemaineSelectionne === null
      ? true
      : !fermeParRecurrent(jourSemaineSelectionne, creneau);
  }

  const tousOuverts = jourSelectionne ? CRENEAUX_HORAIRES.every(effectifOuvert) : false;

  return (
    <>
      <EnteteEspace
        titre="Mes disponibilités"
        description="Un créneau fermé ici n'est plus réservable côté dîneur. Deux plannings se superposent : l'horaire habituel, et les exceptions posées sur une date précise."
      />

      <Legende />

      <section className="mt-8 flex flex-col gap-4">
        <div>
          <h2 className={TITRE_SECTION}>Horaires d&apos;ouverture</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Le planning classique, valable toutes les semaines.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {JOURS_SEMAINE_ISO.map((label, jourSemaine) => {
            const jourFerme = hebdoJoursFermes.has(jourSemaine);
            return (
              <div key={jourSemaine} className={jourFerme ? CARTE_FERMEE : CARTE}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-ink)]">{label}</span>
                  <form action={basculerHoraireHebdo.bind(null, jourSemaine, null, !jourFerme)}>
                    <button type="submit" className={BOUTON_SECONDAIRE}>
                      {jourFerme ? "Rouvrir" : "Fermer toute la journée"}
                    </button>
                  </form>
                </div>

                {!jourFerme && (
                  <div className="mt-3 flex flex-col gap-3">
                    <RangeeCreneaux
                      titre="Midi"
                      creneaux={CRENEAUX_MIDI}
                      rendreBouton={(creneau) => {
                        const ferme = hebdoCreneauxFermes.has(`${jourSemaine}|${creneau}`);
                        return (
                          <form
                            key={creneau}
                            action={basculerHoraireHebdo.bind(null, jourSemaine, creneau, !ferme)}
                          >
                            <button type="submit" className={ferme ? CHIP_FERME : CHIP_OUVERT}>
                              {creneau}
                            </button>
                          </form>
                        );
                      }}
                    />
                    <RangeeCreneaux
                      titre="Soir"
                      creneaux={CRENEAUX_SOIR}
                      rendreBouton={(creneau) => {
                        const ferme = hebdoCreneauxFermes.has(`${jourSemaine}|${creneau}`);
                        return (
                          <form
                            key={creneau}
                            action={basculerHoraireHebdo.bind(null, jourSemaine, creneau, !ferme)}
                          >
                            <button type="submit" className={ferme ? CHIP_FERME : CHIP_OUVERT}>
                              {creneau}
                            </button>
                          </form>
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10 flex flex-col gap-4">
        <div>
          <h2 className={TITRE_SECTION}>Ouvertures &amp; fermetures exceptionnelles</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-muted)]">
            Un jour férié, des congés, un événement — choisissez une date : chaque créneau est
            pré-rempli depuis le planning ci-dessus et se modifie juste pour ce jour-là.
          </p>
        </div>

        <div className={`${CARTE} max-w-xl`}>
          <div className="flex items-center justify-between">
            <Link
              href={`?mois=${moisAdjacent(moisActuel, -1)}`}
              className="text-sm font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              ← {formatMoisLabel(moisAdjacent(moisActuel, -1))}
            </Link>
            <span className="font-[family-name:var(--font-display)] font-bold text-[var(--color-ink)]">
              {formatMoisLabel(moisActuel)}
            </span>
            <Link
              href={`?mois=${moisAdjacent(moisActuel, 1)}`}
              className="text-sm font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              {formatMoisLabel(moisAdjacent(moisActuel, 1))} →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {JOUR_ISO_LETTRES.map((lettre, i) => (
              <span
                key={i}
                className="pb-1 text-center font-mono text-[11px] font-semibold text-[var(--color-ink-muted)]"
              >
                {lettre}
              </span>
            ))}

            {grille.map((jour) => {
              const aUneException = joursAvecException.has(jour.iso);
              const estSelectionne = jour.iso === jourSelectionne;
              const classe = classeCellule(jour, estSelectionne);

              if (jour.estPasse) {
                return (
                  <span key={jour.iso} className={`${classe} opacity-25`}>
                    {jour.numero}
                  </span>
                );
              }

              return (
                <Link
                  key={jour.iso}
                  href={`?mois=${jour.iso.slice(0, 7)}&jour=${jour.iso}`}
                  className={classe}
                >
                  {jour.numero}
                  {aUneException && !estSelectionne && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--color-accent)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {jourSelectionne && (
          <div className={`${CARTE} max-w-xl`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold capitalize text-[var(--color-ink)]">
                {new Date(`${jourSelectionne}T00:00:00`).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
              <form action={basculerExceptionJournee.bind(null, jourSelectionne, tousOuverts)}>
                <button type="submit" className={BOUTON_SECONDAIRE}>
                  {tousOuverts ? "Fermer toute la journée" : "Ouvrir toute la journée"}
                </button>
              </form>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <RangeeCreneaux
                titre="Midi"
                creneaux={CRENEAUX_MIDI}
                rendreBouton={(creneau) => {
                  const ouvert = effectifOuvert(creneau);
                  const aException = exceptionParCreneau.has(creneau);
                  return (
                    <form
                      key={creneau}
                      action={basculerException.bind(null, jourSelectionne, creneau)}
                    >
                      <button type="submit" className={ouvert ? CHIP_OUVERT : CHIP_FERME}>
                        {creneau}
                        {aException && " •"}
                      </button>
                    </form>
                  );
                }}
              />
              <RangeeCreneaux
                titre="Soir"
                creneaux={CRENEAUX_SOIR}
                rendreBouton={(creneau) => {
                  const ouvert = effectifOuvert(creneau);
                  const aException = exceptionParCreneau.has(creneau);
                  return (
                    <form
                      key={creneau}
                      action={basculerException.bind(null, jourSelectionne, creneau)}
                    >
                      <button type="submit" className={ouvert ? CHIP_OUVERT : CHIP_FERME}>
                        {creneau}
                        {aException && " •"}
                      </button>
                    </form>
                  );
                }}
              />
            </div>
          </div>
        )}
      </section>
    </>
  );
}

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
  type JourCalendrier,
} from "@/lib/creneaux";
import { creneauOuvert } from "@/lib/disponibilites";
import {
  debutDeJournee,
  formaterDate,
  jourIsoValide,
  moisAdjacent,
  moisIso as calculerMoisIso,
  moisIsoValide,
} from "@/lib/fuseau";
import { formaterMinutes, horairesDeclares } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";
import { BOUTON_SECONDAIRE, CARTE, CHAMP_BASE, TITRE_SECTION } from "@/lib/ui";

import {
  ajouterPlage,
  basculerException,
  basculerExceptionJournee,
  fermerJour,
  retirerPlage,
} from "./actions";
import { MESSAGES_ERREUR } from "./erreurs";

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
const PASTILLE_SERVICE =
  "flex items-center gap-1.5 rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-white py-1.5 pl-3.5 pr-1.5 text-sm font-semibold text-[var(--color-ink)]";
// `CHAMP_BASE` et pas `${CHAMP} w-auto` : `CHAMP` porte `w-full`, et Tailwind
// tranche les classes en conflit par l'ordre de la feuille générée, pas par
// celui du texte (voir le commentaire de `CARTE_FERMEE` ci-dessous). Un champ
// d'heure n'a pas à occuper la ligne.
const CHAMP_HEURE = CHAMP_BASE;
const JOUR_ISO_LETTRES = ["L", "M", "M", "J", "V", "S", "D"];

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

/** Légende des chips de la section « exceptions » — mêmes couleurs, même sens. */
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
      <span>• = diffère de vos horaires habituels ce jour-là</span>
    </div>
  );
}

/**
 * Deux plannings distincts, tous deux vérifiés par `creerReservation` et tous
 * deux lus par la fiche que voit le dîneur : les horaires d'ouverture
 * habituels (des services par jour de semaine — ce sont eux qui s'affichent
 * sur la fiche) et les exceptions ponctuelles sur une date précise
 * (ouverture OU fermeture — voir le calendrier ci-dessous), qui les
 * recouvrent pour ce seul jour. Pas de client component ici — chaque bouton
 * est son propre formulaire server action, la navigation par ?mois=&jour=
 * suffit pour le calendrier.
 */
export default async function DisponibilitesPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; jour?: string; erreur?: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null;

  const restaurantId = session.user.restaurantId;
  const params = await searchParams;

  const moisActuel = params.mois && moisIsoValide(params.mois) ? params.mois : calculerMoisIso();
  const jourSelectionne = params.jour && jourIsoValide(params.jour) ? params.jour : null;
  const messageErreur = params.erreur ? MESSAGES_ERREUR[params.erreur] : undefined;
  const grille = genererGrilleMois(moisActuel);

  const [plages, exceptions] = await Promise.all([
    prisma.plageOuverture.findMany({
      where: { restaurantId },
      orderBy: [{ jourSemaine: "asc" }, { debutMinutes: "asc" }],
    }),
    prisma.exceptionHoraire.findMany({
      where: { restaurantId, jour: { gte: grille[0]!.iso, lte: grille[41]!.iso } },
    }),
  ]);
  const declares = horairesDeclares(plages);

  const joursAvecException = new Set(exceptions.map((e) => e.jour));
  const exceptionParCreneau = new Map(
    exceptions.filter((e) => e.jour === jourSelectionne).map((e) => [e.creneau, e.ouvert]),
  );

  /** Ce que verrait le dîneur pour la date sélectionnée — la lecture partagée, pas une copie. */
  function effectifOuvert(creneau: string): boolean {
    if (!jourSelectionne) return true;
    return creneauOuvert({ plages, exceptions, jourIso: jourSelectionne, creneau });
  }

  const tousOuverts = jourSelectionne ? CRENEAUX_HORAIRES.every(effectifOuvert) : false;

  return (
    <>
      <EnteteEspace
        titre="Mes disponibilités"
        description="Ce que vous déclarez ici s'affiche sur votre fiche et décide des créneaux réservables. Deux plannings se superposent : vos horaires habituels, et les exceptions posées sur une date précise."
      />

      {messageErreur && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-[var(--color-danger-tint)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]"
        >
          {messageErreur}
        </p>
      )}

      <Legende />

      <section className="mt-8 flex flex-col gap-4">
        <div>
          <h2 className={TITRE_SECTION}>Horaires d&apos;ouverture</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-ink-muted)]">
            Vos services, valables toutes les semaines. C&apos;est cette déclaration que lit la
            fiche de votre restaurant : ce qu&apos;un dîneur y voit affiché et les créneaux
            qu&apos;il peut réserver sortent d&apos;ici, et de nulle part ailleurs.
          </p>
        </div>

        {!declares && (
          <p className="rounded-xl bg-[var(--color-warning-tint)] px-4 py-3 text-sm text-[var(--color-warning)]">
            Vous n&apos;avez pas encore déclaré vos horaires : faute de mieux, tous les créneaux
            sont proposés aux dîneurs, midi et soir, sept jours sur sept.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {JOURS_SEMAINE_ISO.map((label, jourSemaine) => {
            const services = plages.filter((plage) => plage.jourSemaine === jourSemaine);
            const jourFerme = declares && services.length === 0;
            return (
              <div key={jourSemaine} className={jourFerme ? CARTE_FERMEE : CARTE}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--color-ink)]">{label}</span>
                  {services.length > 0 ? (
                    <form action={fermerJour.bind(null, jourSemaine)}>
                      <button type="submit" className={BOUTON_SECONDAIRE}>
                        Fermer toute la journée
                      </button>
                    </form>
                  ) : (
                    <span className="text-sm font-semibold text-[var(--color-ink-muted)]">
                      {declares ? "Fermé" : "Aucun service"}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  {services.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {services.map((service) => {
                        const horaire = `${formaterMinutes(service.debutMinutes)} – ${formaterMinutes(service.finMinutes)}`;
                        return (
                          <span key={service.id} className={PASTILLE_SERVICE}>
                            {horaire}
                            <form action={retirerPlage.bind(null, service.id)}>
                              <button
                                type="submit"
                                title="Retirer ce service"
                                aria-label={`Retirer le service de ${horaire} le ${label.toLowerCase()}`}
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-line)] hover:text-[var(--color-ink)]"
                              >
                                ×
                              </button>
                            </form>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <form
                    action={ajouterPlage.bind(null, jourSemaine)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      type="time"
                      name="debut"
                      required
                      defaultValue={services.length === 0 ? "12:00" : "19:00"}
                      aria-label={`Début d'un service le ${label.toLowerCase()}`}
                      className={CHAMP_HEURE}
                    />
                    <span aria-hidden className="text-[var(--color-ink-muted)]">
                      –
                    </span>
                    <input
                      type="time"
                      name="fin"
                      required
                      defaultValue={services.length === 0 ? "14:00" : "22:30"}
                      aria-label={`Fin d'un service le ${label.toLowerCase()}`}
                      className={CHAMP_HEURE}
                    />
                    <button type="submit" className={BOUTON_SECONDAIRE}>
                      Ajouter un service
                    </button>
                  </form>
                </div>
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
                {formaterDate(debutDeJournee(jourSelectionne), {
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

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { creerReservation, type EtatReservation } from "@/app/(site)/restaurants/[id]/actions";
import { politiqueAnnulation } from "@/lib/annulation";
import { IconeCalendrier, IconeValide } from "@/components/Icones";
import { lienConnexion } from "@/lib/retour";
import {
  CRENEAUX_MIDI,
  CRENEAUX_SOIR,
  TAILLES_TABLE,
  cleCreneau,
  construireDateCreneau,
  type JourReservable,
} from "@/lib/creneaux";

const CHIP =
  "rounded-[13px] border-[1.5px] px-3 py-2.5 text-center text-sm font-semibold select-none transition-colors";
const CHIP_INACTIF = `${CHIP} cursor-pointer border-[var(--color-line-strong)] bg-white text-[var(--color-ink)] hover:border-[var(--color-ink-muted)]`;
const CHIP_ACTIF = `${CHIP} cursor-pointer border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]`;
const CHIP_COMPLET = `${CHIP} cursor-not-allowed border-[var(--color-line)] text-[var(--color-ink-muted)] opacity-50 line-through`;
// Fermé et complet ne disent pas la même chose au dîneur : l'un ne rouvrira
// pas ce jour-là, l'autre peut se libérer. Deux rendus distincts.
const CHIP_FERME = `${CHIP} cursor-not-allowed border-dashed border-[var(--color-line)] text-[var(--color-ink-muted)] opacity-60`;
const BOUTON_CONFIRMER =
  "block w-full rounded-full bg-[var(--color-accent)] px-7 py-4 text-center font-[family-name:var(--font-display)] text-[15px] font-bold text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60";

const CARTE_RESA = "rounded-[28px] border border-[var(--color-line-strong)] bg-white p-6 shadow-[var(--shadow-carte)] sm:p-7";

const ETAT_INITIAL: EtatReservation = {};

/** Le créneau proposé d'emblée quand le restaurant l'ouvre — l'heure de dîner la plus demandée. */
const CRENEAU_PREFERE = CRENEAUX_SOIR[3];

function creneauParDefaut(ouverts: readonly string[]): string {
  return ouverts.includes(CRENEAU_PREFERE) ? CRENEAU_PREFERE : (ouverts[0] ?? CRENEAU_PREFERE);
}

/**
 * Sélection retrouvée dans l'URL au retour de la connexion. On ne la reprend
 * que si elle tient toujours debout : entre le départ vers `/connexion` et le
 * retour, un créneau a pu se remplir ou le restaurant fermer ce jour-là.
 */
export type SelectionReservation = {
  couverts?: string;
  jour?: string;
  creneau?: string;
};

function Groupe({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
        {libelle}
      </span>
      {children}
    </div>
  );
}

export function BookingCard({
  restaurantId,
  estConnecte,
  jours,
  ouvertures,
  occupation,
  capacite,
  delaiAnnulationHeures,
  selection,
}: {
  restaurantId: string;
  estConnecte: boolean;
  jours: JourReservable[];
  /** Créneaux ouverts par jour (clé : jour ISO) — voir `src/lib/disponibilites.ts`. */
  ouvertures: Record<string, string[]>;
  /** Couverts déjà confirmés par créneau, clé `cleCreneau` — voir `src/lib/reservation.ts`. */
  occupation: Record<string, number>;
  capacite: number;
  /** Délai d'annulation déclaré par le restaurant — annoncé ici, appliqué dans "Mes réservations". */
  delaiAnnulationHeures: number | null;
  /** Sélection à ré-afficher au retour de la connexion — voir `src/lib/retour.ts`. */
  selection?: SelectionReservation;
}) {
  // Ouverte d'emblée sur le premier jour que le restaurant ouvre. S'il n'en
  // ouvre aucun, ces deux valeurs ne servent à rien : la carte affiche plus
  // bas un message à la place du formulaire — mais les hooks se déclarent
  // avant ce retour anticipé.
  const joursOuverts = jours.filter((jour) => (ouvertures[jour.iso] ?? []).length > 0);
  const premierJourOuvert = joursOuverts[0];
  const jourDemande =
    joursOuverts.find((jour) => jour.iso === selection?.jour)?.iso ??
    premierJourOuvert?.iso ??
    "";
  const creneauxDuJourDemande = ouvertures[jourDemande] ?? [];
  const [couverts, setCouverts] = useState<number>(
    () =>
      TAILLES_TABLE.find((t) => String(t.valeur) === selection?.couverts)?.valeur ??
      TAILLES_TABLE[1].valeur,
  );
  const [jourIso, setJourIso] = useState(jourDemande);
  const [creneau, setCreneau] = useState<string>(() =>
    selection?.creneau && creneauxDuJourDemande.includes(selection.creneau)
      ? selection.creneau
      : creneauParDefaut(creneauxDuJourDemande),
  );
  const [etat, action, enCours] = useActionState(
    creerReservation.bind(null, restaurantId),
    ETAT_INITIAL,
  );

  // Place restante sur un créneau donné — un créneau complet ne doit jamais
  // être proposé au dîneur (plutôt que proposé puis refusé à la soumission).
  function placesRestantes(jour: string, c: string): number {
    const date = construireDateCreneau(jour, c);
    if (!date) return 0;
    return capacite - (occupation[cleCreneau(date)] ?? 0);
  }

  const creneauxOuverts = ouvertures[jourIso] ?? [];

  /** Changer de jour peut fermer le créneau choisi : on en reprend un que ce jour-là ouvre. */
  function choisirJour(iso: string) {
    setJourIso(iso);
    const ouverts = ouvertures[iso] ?? [];
    if (!ouverts.includes(creneau)) setCreneau(creneauParDefaut(ouverts));
  }

  // Le dîneur non connecté part vers `/connexion` avec sa sélection dans
  // l'URL : c'est elle qui lui sera ré-affichée au retour.
  const lienRetourFiche = `/restaurants/${restaurantId}?${new URLSearchParams({
    couverts: String(couverts),
    jour: jourIso,
    creneau,
  })}`;

  const restantSurCreneau = placesRestantes(jourIso, creneau);
  const creneauFerme = !creneauxOuverts.includes(creneau);
  const creneauIndisponible = creneauFerme || restantSurCreneau < couverts;

  if (etat.ok) {
    const jour = jours.find((j) => j.iso === jourIso);
    return (
      <div className={`${CARTE_RESA} flex flex-col items-center gap-3 text-center`}>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-tint)] text-[var(--color-success)]">
          <IconeValide taille={26} />
        </span>
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
          Table réservée
        </p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {couverts} personne{couverts > 1 ? "s" : ""} · {jour?.jourSemaine} {jour?.numero} ·{" "}
          {creneau}
        </p>
        <Link
          href="/mes-reservations"
          className="mt-2 inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-line-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
        >
          <IconeCalendrier taille={16} />
          Voir mes réservations
        </Link>
      </div>
    );
  }

  // Fermé sur toute la fenêtre réservable : mieux vaut le dire que présenter
  // un formulaire dont chaque bouton est désactivé.
  if (joursOuverts.length === 0) {
    return (
      <div className={`${CARTE_RESA} flex flex-col gap-3`}>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
          Réserver une table
        </h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Ce restaurant ne prend pas de réservation sur les prochains jours. Ses horaires
          d&apos;ouverture sont indiqués plus haut.
        </p>
      </div>
    );
  }

  return (
    <div className={`${CARTE_RESA} flex flex-col gap-6`}>
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
          Réserver une table
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
          Confirmation immédiate · sans frais
        </p>
      </div>

      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="jourIso" value={jourIso} />
        <input type="hidden" name="creneau" value={creneau} />
        <input type="hidden" name="couverts" value={couverts} />

        <Groupe libelle="CONVIVES">
          <div className="flex gap-2" role="group" aria-label="Nombre de convives">
            {TAILLES_TABLE.map((t) => (
              <button
                key={t.valeur}
                type="button"
                aria-pressed={couverts === t.valeur}
                onClick={() => setCouverts(t.valeur)}
                className={`flex-1 ${couverts === t.valeur ? CHIP_ACTIF : CHIP_INACTIF}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Groupe>

        <Groupe libelle="DATE">
          <div className="flex gap-2" role="group" aria-label="Jour de la réservation">
            {jours.map((j) => {
              const ferme = (ouvertures[j.iso] ?? []).length === 0;
              return (
                <button
                  key={j.iso}
                  type="button"
                  disabled={ferme}
                  aria-pressed={jourIso === j.iso}
                  aria-label={ferme ? `${j.jourSemaine} ${j.numero} — fermé` : undefined}
                  onClick={() => choisirJour(j.iso)}
                  title={ferme ? "Fermé" : undefined}
                  className={`flex-1 ${ferme ? CHIP_FERME : jourIso === j.iso ? CHIP_ACTIF : CHIP_INACTIF}`}
                >
                  <span className="block text-[10px] uppercase opacity-70">{j.jourSemaine}</span>
                  <span className="block font-[family-name:var(--font-display)] text-base">
                    {j.numero}
                  </span>
                </button>
              );
            })}
          </div>
        </Groupe>

        <Groupe libelle="CRÉNEAUX">
          <div className="flex flex-col gap-3" role="group" aria-label="Créneau horaire">
            {(
              [
                ["Midi", CRENEAUX_MIDI],
                ["Soir", CRENEAUX_SOIR],
              ] as const
            ).map(([service, creneaux]) => (
              <div key={service} className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[var(--color-ink-muted)]">
                  {service}
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {creneaux.map((c) => {
                    const ferme = !creneauxOuverts.includes(c);
                    const complet = !ferme && placesRestantes(jourIso, c) < couverts;
                    const etiquette = ferme ? "Fermé" : complet ? "Complet" : undefined;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={ferme || complet}
                        aria-pressed={creneau === c}
                        aria-label={etiquette ? `${c} — ${etiquette.toLowerCase()}` : undefined}
                        onClick={() => setCreneau(c)}
                        title={etiquette}
                        className={
                          ferme
                            ? CHIP_FERME
                            : complet
                              ? CHIP_COMPLET
                              : creneau === c
                                ? CHIP_ACTIF
                                : CHIP_INACTIF
                        }
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Groupe>

        {etat.erreur && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]"
          >
            {etat.erreur}
          </p>
        )}
        {!etat.erreur && creneauIndisponible && (
          <p className="rounded-xl bg-[var(--color-warning-tint)] px-3.5 py-2.5 text-sm text-[var(--color-warning)]">
            {creneauFerme
              ? "Le restaurant est fermé sur ce créneau, choisis-en un autre."
              : `Ce créneau est complet pour ${couverts} personne${couverts > 1 ? "s" : ""}, choisis-en un autre.`}
          </p>
        )}
        {!etat.erreur && !creneauIndisponible && restantSurCreneau <= 6 && (
          <p className="text-center text-sm text-[var(--color-ink-muted)]">
            Plus que {restantSurCreneau} couvert{restantSurCreneau > 1 ? "s" : ""} sur ce créneau.
          </p>
        )}

        {estConnecte ? (
          <button
            type="submit"
            disabled={enCours || creneauIndisponible}
            className={BOUTON_CONFIRMER}
          >
            {enCours ? "Confirmation…" : "Confirmer la réservation"}
          </button>
        ) : (
          <Link href={lienConnexion(lienRetourFiche)} className={BOUTON_CONFIRMER}>
            Se connecter pour réserver
          </Link>
        )}

        <p className="text-center text-xs text-[var(--color-ink-muted)]">
          Aucun prélèvement · {politiqueAnnulation(delaiAnnulationHeures)}
        </p>
      </form>
    </div>
  );
}

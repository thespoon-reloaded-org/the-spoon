import Link from "next/link";

import type { Avoir, Booking, Facture, LigneFacture, Restaurant } from "@/generated/prisma";
import {
  formaterDateReservation,
  formaterMoisFacture,
  formaterMontant,
  netAPayerCentimes,
  referenceAvoir,
  referenceFacture,
} from "@/lib/facturation";
import { formaterDate } from "@/lib/fuseau";
import { EYEBROW } from "@/lib/ui";

type FactureAvecDetails = Facture & {
  restaurant: Pick<Restaurant, "nom" | "adresse">;
  lignes: (LigneFacture & { booking: Booking })[];
  /** Avoirs émis sur cette facture à la suite d'une contestation tranchée. */
  avoirs: Avoir[];
};

/**
 * Rendu "vraie facture" — même document pour le restaurant (qui la reçoit) et
 * pour l'admin (qui la consulte) : émetteur/destinataire, période, tableau
 * des lignes, total. Pas de mentions légales (TVA, SIRET…) — rien dans le
 * produit ne les modélise encore, on ne les invente pas.
 */
export function FactureDocument({
  facture,
  joursRestants,
  retour,
}: {
  facture: FactureAvecDetails;
  joursRestants: number;
  /** Absent quand le document est incorporé dans un autre écran (ex. l'instruction d'un dossier), plutôt qu'affiché comme sa propre page. */
  retour?: { href: string; label: string };
}) {
  return (
    <div>
      {retour && (
        <Link
          href={retour.href}
          className="text-sm font-semibold text-[var(--color-ink-soft)] hover:underline"
        >
          ← {retour.label}
        </Link>
      )}

      <div
        className={`${
          retour ? "mt-4 " : ""
        }max-w-3xl rounded-2xl border border-[var(--color-line-strong)] bg-white p-6 shadow-[var(--shadow-carte)] sm:p-8`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-[1.5px] border-[var(--color-line)] pb-6">
          <div>
            <p className={EYEBROW}>Facture</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
              {referenceFacture(facture)}
            </p>
          </div>
          <div className="text-right text-sm text-[var(--color-ink-muted)]">
            <p>
              Émise le{" "}
              {formaterDate(facture.genereeLe, { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="mt-1">
              {joursRestants > 0
                ? `${joursRestants} jour${joursRestants > 1 ? "s" : ""} restants pour contester`
                : "Délai de contestation expiré"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
          <div>
            <p className={EYEBROW}>Émetteur</p>
            <p className="mt-1 font-semibold text-[var(--color-ink)]">TheSpoon</p>
            <p className="text-[var(--color-ink-muted)]">Commission sur réservations honorées</p>
          </div>
          <div className="sm:text-right">
            <p className={EYEBROW}>Facturé à</p>
            <p className="mt-1 font-semibold text-[var(--color-ink)]">{facture.restaurant.nom}</p>
            <p className="text-[var(--color-ink-muted)]">{facture.restaurant.adresse}</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
          Période facturée :{" "}
          <span className="font-semibold capitalize text-[var(--color-ink)]">
            {formaterMoisFacture(facture.mois)}
          </span>
        </p>

        {/* La facture peut compter beaucoup de lignes et quatre colonnes
            chiffrées : sur mobile, c'est le tableau qui défile, pas la page. */}
        <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b-[1.5px] border-[var(--color-line-strong)] text-left font-mono text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
              <th className="py-2 font-semibold">Réservation</th>
              <th className="py-2 text-right font-semibold">Couverts facturés</th>
              <th className="py-2 text-right font-semibold">Prix unitaire</th>
              <th className="py-2 text-right font-semibold">Montant</th>
            </tr>
          </thead>
          <tbody>
            {facture.lignes.map((ligne) => (
              <tr key={ligne.id} className="border-b border-[var(--color-line)] last:border-0">
                <td className="py-3 text-[var(--color-ink)]">{formaterDateReservation(ligne.booking.date)}</td>
                <td className="py-3 text-right text-[var(--color-ink)]">{ligne.couvertsFactures}</td>
                <td className="py-3 text-right text-[var(--color-ink-muted)]">
                  {/* Dérivé de la ligne stockée, jamais du taux courant : une
                      facture déjà émise doit rester lisible telle quelle même
                      si COMMISSION_CENTIMES_PAR_COUVERT change plus tard. */}
                  {formaterMontant(ligne.montantCentimes / ligne.couvertsFactures)}
                </td>
                <td className="py-3 text-right font-semibold text-[var(--color-ink)]">
                  {formaterMontant(ligne.montantCentimes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Une facture émise ne se réécrit pas : un litige tranché en faveur
            du restaurant ne rabote pas le total, il ajoute un avoir en
            déduction. Le net à payer n'apparaît donc que s'il diffère. */}
        <div className="mt-6 flex justify-end border-t-[1.5px] border-[var(--color-line-strong)] pt-4">
          {facture.avoirs.length === 0 ? (
            <div className="text-right">
              <p className="text-sm text-[var(--color-ink-muted)]">Total</p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
                {formaterMontant(facture.montantTotalCentimes)}
              </p>
            </div>
          ) : (
            <dl className="w-full max-w-xs text-sm">
              <div className="flex items-baseline justify-between gap-6 py-1">
                <dt className="text-[var(--color-ink-muted)]">Total facturé</dt>
                <dd className="font-semibold text-[var(--color-ink)]">
                  {formaterMontant(facture.montantTotalCentimes)}
                </dd>
              </div>
              {facture.avoirs.map((avoir) => (
                <div key={avoir.id} className="flex items-baseline justify-between gap-6 py-1">
                  <dt className="text-[var(--color-ink-muted)]">Avoir {referenceAvoir(avoir)}</dt>
                  <dd className="font-semibold text-[var(--color-success)]">
                    &minus;{formaterMontant(avoir.montantCentimes)}
                  </dd>
                </div>
              ))}
              <div className="mt-2 flex items-baseline justify-between gap-6 border-t border-[var(--color-line)] pt-3">
                <dt className="text-[var(--color-ink-muted)]">Net à payer</dt>
                <dd className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
                  {formaterMontant(netAPayerCentimes(facture.montantTotalCentimes, facture.avoirs))}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

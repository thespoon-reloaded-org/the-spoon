import Link from "next/link";

import type { Booking, Facture, LigneFacture, Restaurant } from "@/generated/prisma";
import { formaterMoisFacture, formaterMontant, referenceFacture } from "@/lib/facturation";
import { EYEBROW } from "@/lib/ui";

type FactureAvecDetails = Facture & {
  restaurant: Pick<Restaurant, "nom" | "adresse">;
  lignes: (LigneFacture & { booking: Booking })[];
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
  retour: { href: string; label: string };
}) {
  return (
    <div>
      <Link href={retour.href} className="text-sm text-[var(--color-ink-muted)] hover:underline">
        ← {retour.label}
      </Link>

      <div className="mt-4 rounded-2xl border-[1.5px] border-[var(--color-line-strong)] bg-white p-8">
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
              {facture.genereeLe.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p className="mt-1">
              {joursRestants > 0
                ? `${joursRestants} jour${joursRestants > 1 ? "s" : ""} restants pour contester`
                : "Délai de contestation expiré"}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className={EYEBROW}>Émetteur</p>
            <p className="mt-1 font-semibold text-[var(--color-ink)]">TheSpoon</p>
            <p className="text-[var(--color-ink-muted)]">Commission sur réservations honorées</p>
          </div>
          <div className="text-right">
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

        <table className="mt-4 w-full text-sm">
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
                <td className="py-3 text-[var(--color-ink)]">
                  {ligne.booking.date.toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  à{" "}
                  {ligne.booking.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </td>
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

        <div className="mt-6 flex justify-end border-t-[1.5px] border-[var(--color-line-strong)] pt-4">
          <div className="text-right">
            <p className="text-sm text-[var(--color-ink-muted)]">Total</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
              {formaterMontant(facture.montantTotalCentimes)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { GenererFacturesForm } from "@/components/GenererFacturesForm";
import { IconeChevron } from "@/components/Icones";
import {
  COMMISSION_CENTIMES_PAR_COUVERT,
  formaterMoisFacture,
  formaterMontant,
  montantAvoirsCentimes,
  netAPayerCentimes,
} from "@/lib/facturation";
import { moisAdjacent, moisIso } from "@/lib/fuseau";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { prisma } from "@/lib/prisma";
import { CARTE, ETAT_VIDE, TITRE_SECTION } from "@/lib/ui";

export const metadata: Metadata = { title: "Facturation" };

/**
 * Le mois écoulé, vu de Paris. `getUTCMonth()` sur "maintenant" se trompait
 * de mois pendant les deux premières heures du 1er : à 00h30 à Paris le
 * 1er octobre, le serveur est encore au 30 septembre et proposait donc de
 * facturer août.
 */
function moisPrecedentISO(): string {
  return moisAdjacent(moisIso(), -1);
}

/** Déclenchement et suivi des factures mensuelles — "Déclenchement & vue des factures (BO Admin)". */
export default async function FacturesAdminPage() {
  await exigerSessionStaff();

  const factures = await prisma.facture.findMany({
    include: {
      restaurant: { select: { nom: true } },
      _count: { select: { lignes: true } },
      avoirs: { select: { montantCentimes: true } },
    },
    orderBy: [{ mois: "desc" }, { restaurant: { nom: "asc" } }],
  });

  const total = factures.reduce((somme, facture) => somme + facture.montantTotalCentimes, 0);
  // Ce que TheSpoon encaisse réellement : les avoirs émis sur litige viennent
  // en déduction, et c'est ce chiffre-là qui intéresse le staff.
  const totalAvoirs = factures.reduce((somme, facture) => somme + montantAvoirsCentimes(facture.avoirs), 0);

  return (
    <>
      <EnteteEspace
        titre="Facturation"
        description={`Commission de ${formaterMontant(
          COMMISSION_CENTIMES_PAR_COUVERT,
        )} par couvert servi. La génération est idempotente : relancer un mois déjà facturé ne crée pas de doublon.`}
      />

      <div className={CARTE}>
        <GenererFacturesForm moisParDefaut={moisPrecedentISO()} />
      </div>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className={TITRE_SECTION}>
            Factures émises{" "}
            <span className="font-body text-base font-medium text-[var(--color-ink-muted)]">
              · {factures.length}
            </span>
          </h2>
          {factures.length > 0 && (
            <span className="text-sm text-[var(--color-ink-muted)]">
              Total facturé :{" "}
              <strong className="font-semibold text-[var(--color-ink)]">
                {formaterMontant(total)}
              </strong>
              {totalAvoirs > 0 && (
                <>
                  {" "}
                  · net après avoirs :{" "}
                  <strong className="font-semibold text-[var(--color-ink)]">
                    {formaterMontant(total - totalAvoirs)}
                  </strong>
                </>
              )}
            </span>
          )}
        </div>

        {factures.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
              Aucune facture générée pour l&apos;instant
            </p>
            <p className="max-w-md text-sm text-[var(--color-ink-muted)]">
              Choisissez un mois ci-dessus : une facture sera créée pour chaque restaurant ayant au
              moins une réservation honorée sur la période.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {factures.map((facture) => (
              <li key={facture.id}>
                <Link
                  href={`/admin/factures/${facture.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-line-strong)] bg-white px-5 py-4 transition-colors hover:border-[var(--color-staff)]"
                >
                  <div>
                    <p className="font-semibold text-[var(--color-ink)]">{facture.restaurant.nom}</p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      <span className="capitalize">{formaterMoisFacture(facture.mois)}</span> ·{" "}
                      {facture._count.lignes} réservation{facture._count.lignes > 1 ? "s" : ""}{" "}
                      honorée{facture._count.lignes > 1 ? "s" : ""}
                      {facture.avoirs.length > 0 && (
                        <>
                          {" "}
                          · net après {formaterMontant(montantAvoirsCentimes(facture.avoirs))}{" "}
                          d&apos;avoirs
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                      {formaterMontant(netAPayerCentimes(facture.montantTotalCentimes, facture.avoirs))}
                    </p>
                    <span className="text-[var(--color-ink-muted)]">
                      <IconeChevron taille={18} />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

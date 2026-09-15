import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { authRestaurant } from "@/lib/auth";
import { LABELS_MOTIF_CONTESTATION, LABELS_STATUT_DOSSIER } from "@/lib/contestation";
import { formaterDateReservation, formaterMontant } from "@/lib/facturation";
import { CARTE, EYEBROW } from "@/lib/ui";
import { prisma } from "@/lib/prisma";

/**
 * Récapitulatif en lecture seule d'un dossier tout juste déposé — pas une
 * liste/file de dossiers (hors scope de ce lot), un simple lien direct après
 * le dépôt.
 */
export default async function RecapitulatifDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; dossierId: string }>;
  searchParams: Promise<{ avertissement?: string }>;
}) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null; // garde déjà faite par le layout

  const { id, dossierId } = await params;
  const { avertissement } = await searchParams;

  const dossier = await prisma.dossier.findFirst({
    where: { id: dossierId, factureId: id, facture: { restaurantId: session.user.restaurantId } },
    include: {
      lignes: { include: { ligneFacture: { include: { booking: true } } } },
      piecesJointes: true,
    },
  });
  if (!dossier) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/espace-restaurant/factures/${id}`}
          className="text-sm text-[var(--color-ink-muted)] hover:underline"
        >
          ← Retour à la facture
        </Link>
        <h2 className={`${EYEBROW} mt-3`}>Dossier déposé</h2>
      </div>

      {avertissement === "1" && (
        <p className="rounded-xl border-[1.5px] border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Le dossier est enregistré, mais au moins une pièce jointe n&apos;a pas pu être envoyée.
        </p>
      )}

      <div className={`${CARTE} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
            {formaterMontant(dossier.montantContesteCentimes)} contestés
          </p>
          <span className="rounded-full border-[1.5px] border-[var(--color-line-strong)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
            {LABELS_STATUT_DOSSIER[dossier.statut]}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {dossier.lignes.map((ligne) => (
            <div
              key={ligne.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-2 text-sm last:border-0"
            >
              <span className="text-[var(--color-ink)]">
                {formaterDateReservation(ligne.ligneFacture.booking.date, { avecHeure: false })} —{" "}
                {LABELS_MOTIF_CONTESTATION[ligne.motif]}
              </span>
              <span className="font-semibold text-[var(--color-ink)]">
                {formaterMontant(ligne.ligneFacture.montantCentimes)}
              </span>
            </div>
          ))}
        </div>

        {dossier.commentaire && (
          <div>
            <p className={EYEBROW}>Commentaire</p>
            <p className="mt-1 text-sm text-[var(--color-ink)]">{dossier.commentaire}</p>
          </div>
        )}

        {dossier.piecesJointes.length > 0 && (
          <div>
            <p className={EYEBROW}>Pièces jointes</p>
            <ul className="mt-1 flex flex-col gap-1">
              {dossier.piecesJointes.map((piece) => (
                <li key={piece.id}>
                  <a
                    href={`/api/dossiers/${dossier.id}/pieces-jointes/${piece.id}`}
                    className="text-sm text-[var(--color-ink)] underline hover:no-underline"
                  >
                    {piece.nomOriginal}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

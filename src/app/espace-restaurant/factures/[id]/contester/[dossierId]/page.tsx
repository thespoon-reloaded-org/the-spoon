import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { IconeValide } from "@/components/Icones";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { authRestaurant } from "@/lib/auth";
import { LABELS_MOTIF_CONTESTATION, LABELS_STATUT_DOSSIER } from "@/lib/contestation";
import { formaterDateReservation, formaterMontant } from "@/lib/facturation";
import { CARTE, EYEBROW, pastilleEtat, type EtatPastille } from "@/lib/ui";
import { prisma } from "@/lib/prisma";
import type { StatutDossier } from "@/generated/prisma";

export const metadata: Metadata = { title: "Dossier de contestation" };

/**
 * Un dossier crédité d'office est réglé ; un dossier en attente demande encore
 * un traitement côté TheSpoon. La pastille le dit par sa couleur, le libellé
 * seul ne le distinguait pas.
 */
const ETAT_STATUT: Record<StatutDossier, EtatPastille> = {
  EN_ATTENTE_INSTRUCTION: "attention",
  CREDITE_OFFICE: "succes",
};

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
    <>
      <Link
        href={`/espace-restaurant/factures/${id}`}
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-pro)] hover:underline"
      >
        ← Retour à la facture
      </Link>

      <EnteteEspace
        titre="Dossier déposé"
        description="Vous recevrez la décision de l'équipe Partenaires sur cette facture."
        actions={
          <span className={pastilleEtat(ETAT_STATUT[dossier.statut])}>
            {LABELS_STATUT_DOSSIER[dossier.statut]}
          </span>
        }
      />

      {avertissement === "1" && (
        <div className="mb-5 max-w-2xl">
          <MessageFormulaire type="avertissement">
            Le dossier est enregistré, mais au moins une pièce jointe n&apos;a pas pu être envoyée.
          </MessageFormulaire>
        </div>
      )}

      <div className={`${CARTE} flex max-w-2xl flex-col gap-5`}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-success-tint)] text-[var(--color-success)]">
            <IconeValide taille={24} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-ink)]">
              {formaterMontant(dossier.montantContesteCentimes)}
            </span>
            <span className="text-sm text-[var(--color-ink-muted)]">
              contestés sur {dossier.lignes.length} réservation
              {dossier.lignes.length > 1 ? "s" : ""}
            </span>
          </span>
        </div>

        <ul className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-4">
          {dossier.lignes.map((ligne) => (
            <li
              key={ligne.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="text-[var(--color-ink)]">
                {formaterDateReservation(ligne.ligneFacture.booking.date, { avecHeure: false })}{" "}
                <span className="text-[var(--color-ink-muted)]">
                  · {LABELS_MOTIF_CONTESTATION[ligne.motif]}
                </span>
              </span>
              <span className="font-semibold text-[var(--color-ink)]">
                {formaterMontant(ligne.ligneFacture.montantCentimes)}
              </span>
            </li>
          ))}
        </ul>

        {dossier.commentaire && (
          <div className="border-t border-[var(--color-line)] pt-4">
            <p className={EYEBROW}>Commentaire</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink)]">
              {dossier.commentaire}
            </p>
          </div>
        )}

        {dossier.piecesJointes.length > 0 && (
          <div className="border-t border-[var(--color-line)] pt-4">
            <p className={EYEBROW}>Pièces jointes</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {dossier.piecesJointes.map((piece) => (
                <li key={piece.id}>
                  <a
                    href={`/api/dossiers/${dossier.id}/pieces-jointes/${piece.id}`}
                    className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--color-line-strong)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
                  >
                    {piece.nomOriginal}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dossier.complementDemandeLe && (
          <div className="rounded-xl border-[1.5px] border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">TheSpoon a demandé un complément sur ce dossier</p>
            <p className="mt-1">{dossier.complementDemandeMessage}</p>
          </div>
        )}
      </div>
    </>
  );
}

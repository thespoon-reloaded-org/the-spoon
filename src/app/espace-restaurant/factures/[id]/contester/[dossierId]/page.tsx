import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { IconeValide } from "@/components/Icones";
import { JournalDossier } from "@/components/JournalDossier";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { authRestaurant } from "@/lib/auth";
import {
  ETAT_ISSUE_DECISION,
  LABELS_ISSUE_DECISION,
  LABELS_MOTIF_CONTESTATION,
  lireJournalDossier,
  STATUT_DOSSIER_COTE_RESTAURANT,
} from "@/lib/contestation";
import { formaterDateReservation, formaterMontant, referenceAvoir } from "@/lib/facturation";
import { CARTE, EYEBROW, pastilleEtat } from "@/lib/ui";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Dossier de contestation" };

/**
 * Le dossier vu par le restaurant : ce qu'il a contesté, et la réponse de
 * TheSpoon dès qu'elle existe. Atteignable juste après le dépôt, et retrouvé
 * ensuite depuis la facture (c'est là que la décision est attendue, des jours
 * plus tard).
 *
 * L'imputation n'y figure pas : savoir que le coût est "à la charge du
 * client" est une information interne à TheSpoon, et l'afficher laisserait
 * entendre au restaurant que le dîneur va être facturé — ce que rien ne fait
 * encore (ticket "Frais de no-show au dîneur").
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
      decisions: { include: { avoir: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!dossier) notFound();

  // Les gestes d'organisation interne (prise en charge, escalade) sont écartés
  // dès la requête : ce qui n'est pas envoyé au navigateur ne peut pas fuiter.
  const journal = await lireJournalDossier(dossier.id, { pourLePartenaire: true });

  // Seule la dernière décision est montrée, et seulement si elle conclut : les
  // réinstructions successives et les escalades regardent l'équipe
  // Partenaires, le restaurant attend une réponse, pas une délibération.
  const dossierTranche = dossier.statut === "CLOTURE" || dossier.statut === "CREDITE_OFFICE";
  const decision = dossierTranche ? dossier.decisions[0] : undefined;
  const statut = STATUT_DOSSIER_COTE_RESTAURANT[dossier.statut];

  return (
    <>
      <Link
        href={`/espace-restaurant/factures/${id}`}
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-pro)] hover:underline"
      >
        ← Retour à la facture
      </Link>

      <EnteteEspace
        titre={decision ? "Réponse à votre contestation" : "Dossier déposé"}
        description={
          decision
            ? "La décision de l'équipe Partenaires sur ce dossier."
            : "Vous recevrez la décision de l'équipe Partenaires sur cette facture."
        }
        actions={
          <>
            <span className={pastilleEtat(statut.etat)}>{statut.libelle}</span>
            {decision && (
              <span className={pastilleEtat(ETAT_ISSUE_DECISION[decision.issue])}>
                {LABELS_ISSUE_DECISION[decision.issue]}
              </span>
            )}
          </>
        }
      />

      {decision && (
        <div className={`${CARTE} mb-5 flex max-w-2xl flex-col gap-3`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
              {decision.montantAccordeCentimes > 0
                ? `${formaterMontant(decision.montantAccordeCentimes)} crédités`
                : "Aucun avoir"}
            </p>
            {decision.avoir && (
              <p className="text-sm text-[var(--color-ink-muted)]">
                Avoir{" "}
                <span className="font-semibold text-[var(--color-ink)]">
                  {referenceAvoir(decision.avoir)}
                </span>
                , déduit de votre facture
              </p>
            )}
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-ink)]">{decision.motif}</p>
        </div>
      )}

      {journal.length > 0 && (
        <div className={`${CARTE} mb-5 max-w-2xl`}>
          <p className={`${EYEBROW} mb-4`}>Suivi du dossier</p>
          <JournalDossier evenements={journal} pourLePartenaire />
        </div>
      )}

      {avertissement === "1" && (
        <div className="mb-5 max-w-2xl">
          <MessageFormulaire
            type="avertissement"
            message="Le dossier est enregistré, mais au moins une pièce jointe n’a pas pu être envoyée."
          />
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

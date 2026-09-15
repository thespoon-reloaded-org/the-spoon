import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { DemanderComplementForm } from "@/components/DemanderComplementForm";
import { FactureDocument } from "@/components/FactureDocument";
import { PrendreEnChargeBouton } from "@/components/PrendreEnChargeBouton";
import { authAdmin } from "@/lib/auth";
import {
  formaterAnciennete,
  formaterDelaiSignalement,
  LABELS_MOTIF_CONTESTATION,
  LABELS_STATUT_DOSSIER,
} from "@/lib/contestation";
import { formaterDateReservation, formaterMontant, joursRestantsContestation } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW } from "@/lib/ui";

/**
 * "Instruction d'un dossier" — l'écran de travail de l'instructeur : le
 * dossier complet, ses lignes contestées et leurs motifs, les réservations
 * d'origine (avec le délai entre le service et son signalement), les pièces
 * jointes, et l'historique du partenaire. Demander un complément ne clôture
 * pas le dossier — la décision elle-même est "Décision & émission d'avoir",
 * pas encore construite.
 */
export default async function InstructionDossierPage({
  params,
}: {
  params: Promise<{ dossierId: string }>;
}) {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const { dossierId } = await params;

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      facture: {
        include: {
          restaurant: { select: { id: true, nom: true, adresse: true } },
          lignes: { include: { booking: true }, orderBy: { createdAt: "asc" } },
        },
      },
      restaurantContact: { select: { nom: true, email: true } },
      instructeur: { select: { nom: true } },
      lignes: { include: { ligneFacture: { include: { booking: true } } } },
      piecesJointes: true,
    },
  });
  if (!dossier) notFound();

  const autresDossiers = await prisma.dossier.findMany({
    where: { facture: { restaurantId: dossier.facture.restaurant.id }, id: { not: dossier.id } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, montantContesteCentimes: true, statut: true, createdAt: true },
  });

  const peutDemanderComplement = dossier.instructeurId === session.user.id;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/admin/litiges" className="text-sm text-[var(--color-ink-muted)] hover:underline">
        ← File des litiges
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={EYEBROW}>{dossier.facture.restaurant.nom}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
            {formaterMontant(dossier.montantContesteCentimes)} contestés
          </h1>
        </div>
        <span className="rounded-full border-[1.5px] border-[var(--color-line-strong)] px-3 py-1 text-xs font-semibold text-[var(--color-ink)]">
          {LABELS_STATUT_DOSSIER[dossier.statut]}
        </span>
      </div>

      <div className={`mt-6 ${CARTE} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-ink-muted)]">
          <span>
            Déposé {formaterAnciennete(dossier.createdAt)} par {dossier.restaurantContact.nom} (
            {dossier.restaurantContact.email})
          </span>
          {dossier.instructeur ? (
            <span className="font-semibold text-[var(--color-ink)]">
              Pris en charge par {dossier.instructeur.nom}
            </span>
          ) : (
            <PrendreEnChargeBouton dossierId={dossier.id} />
          )}
        </div>

        <div className="flex flex-col gap-3">
          {dossier.lignes.map((ligne) => (
            <div
              key={ligne.id}
              className="rounded-xl border-[1.5px] border-[var(--color-line-strong)] p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[var(--color-ink)]">
                  {formaterDateReservation(ligne.ligneFacture.booking.date, { avecHeure: false })} —{" "}
                  {LABELS_MOTIF_CONTESTATION[ligne.motif]}
                </span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {formaterMontant(ligne.ligneFacture.montantCentimes)}
                </span>
              </div>
              <p className="mt-1 text-[var(--color-ink-muted)]">
                {ligne.ligneFacture.booking.couvertsServis ?? ligne.ligneFacture.booking.couverts} couvert
                {(ligne.ligneFacture.booking.couvertsServis ?? ligne.ligneFacture.booking.couverts) > 1
                  ? "s"
                  : ""}{" "}
                servis sur {ligne.ligneFacture.booking.couverts} réservé
                {ligne.ligneFacture.booking.couverts > 1 ? "s" : ""}
                {ligne.ligneFacture.booking.signaleeLe && (
                  <>
                    {" "}
                    ·{" "}
                    {formaterDelaiSignalement(
                      ligne.ligneFacture.booking.date,
                      ligne.ligneFacture.booking.signaleeLe,
                    )}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        {dossier.commentaire && (
          <div>
            <p className={EYEBROW}>Commentaire du restaurant</p>
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

        {dossier.complementDemandeLe && (
          <div className="rounded-xl border-[1.5px] border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Complément demandé {formaterAnciennete(dossier.complementDemandeLe)}</p>
            <p className="mt-1">{dossier.complementDemandeMessage}</p>
          </div>
        )}
      </div>

      {peutDemanderComplement && (
        <div className={`mt-6 ${CARTE}`}>
          <DemanderComplementForm dossierId={dossier.id} />
        </div>
      )}

      <div className="mt-6">
        <p className={EYEBROW}>Facture</p>
        <div className="mt-2">
          <FactureDocument
            facture={dossier.facture}
            joursRestants={joursRestantsContestation(dossier.facture.genereeLe)}
          />
        </div>
      </div>

      {autresDossiers.length > 0 && (
        <div className="mt-6">
          <p className={EYEBROW}>Historique du partenaire</p>
          <div className="mt-2 flex flex-col gap-2">
            {autresDossiers.map((autre) => (
              <Link
                key={autre.id}
                href={`/admin/litiges/${autre.id}`}
                className={`${CARTE} flex items-center justify-between text-sm transition-colors hover:border-[var(--color-ink)]`}
              >
                <span className="text-[var(--color-ink-muted)]">
                  {formaterAnciennete(autre.createdAt)} · {LABELS_STATUT_DOSSIER[autre.statut]}
                </span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {formaterMontant(autre.montantContesteCentimes)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

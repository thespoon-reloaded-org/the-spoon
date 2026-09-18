import { notFound } from "next/navigation";
import Link from "next/link";

import { DeciderDossierForm } from "@/components/DeciderDossierForm";
import { DemanderComplementForm } from "@/components/DemanderComplementForm";
import { EnteteEspace } from "@/components/EnteteEspace";
import { FactureDocument } from "@/components/FactureDocument";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { PrendreEnChargeBouton } from "@/components/PrendreEnChargeBouton";
import {
  dossierATrancher,
  ETAT_ISSUE_DECISION,
  ETAT_STATUT_DOSSIER,
  formaterAnciennete,
  formaterDelaiSignalement,
  LABELS_IMPUTATION_LITIGE,
  LABELS_ISSUE_DECISION,
  LABELS_MOTIF_CONTESTATION,
  LABELS_STATUT_DOSSIER,
  peutInstruireDossier,
} from "@/lib/contestation";
import {
  formaterDateReservation,
  formaterMontant,
  joursRestantsContestation,
  referenceAvoir,
} from "@/lib/facturation";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW, TITRE_SECTION, pastilleEtat } from "@/lib/ui";

export const metadata = { title: "Instruction d'un dossier" };

/**
 * "Instruction d'un dossier" — l'écran de travail de l'instructeur : le
 * dossier complet, ses lignes contestées et leurs motifs, les réservations
 * d'origine (avec le délai entre le service et son signalement), les pièces
 * jointes, l'historique du partenaire, et la décision qui referme le dossier
 * ("Décision & émission d'avoir"). Demander un complément, lui, ne clôture
 * rien.
 *
 * La garde d'accès est refaite ici, pas seulement dans le layout — voir
 * `exigerSessionStaff`. La session sert aussi à savoir si l'instructeur du
 * dossier est bien la personne connectée.
 */
export default async function InstructionDossierPage({
  params,
}: {
  params: Promise<{ dossierId: string }>;
}) {
  const session = await exigerSessionStaff();

  const { dossierId } = await params;

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      facture: {
        include: {
          restaurant: { select: { id: true, nom: true, adresse: true } },
          lignes: { include: { booking: true }, orderBy: { createdAt: "asc" } },
          avoirs: { orderBy: { emisLe: "asc" } },
        },
      },
      restaurantContact: { select: { nom: true, email: true } },
      instructeur: { select: { nom: true } },
      lignes: { include: { ligneFacture: { include: { booking: true } } } },
      piecesJointes: true,
      decisions: {
        include: { avoir: true, decidePar: { select: { nom: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!dossier) notFound();

  const autresDossiers = await prisma.dossier.findMany({
    where: { facture: { restaurantId: dossier.facture.restaurant.id }, id: { not: dossier.id } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, montantContesteCentimes: true, statut: true, createdAt: true },
  });

  const enAttente = dossier.statut === "EN_ATTENTE_INSTRUCTION";
  // Demander un complément et trancher sont deux gestes d'instruction : même
  // règle pour les deux, celle de `peutInstruireDossier`.
  const peutInstruire = peutInstruireDossier(dossier, session.user.id);
  const derniereDecision = dossier.decisions[0];

  return (
    <>
      <Link
        href="/admin/litiges"
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-staff)] hover:underline"
      >
        ← File des litiges
      </Link>

      <EnteteEspace
        titre={`${formaterMontant(dossier.montantContesteCentimes)} contestés`}
        description={`${dossier.facture.restaurant.nom} · déposé ${formaterAnciennete(
          dossier.createdAt,
        )} par ${dossier.restaurantContact.nom} (${dossier.restaurantContact.email})`}
        actions={
          <>
            <span className={pastilleEtat(ETAT_STATUT_DOSSIER[dossier.statut])}>
              {LABELS_STATUT_DOSSIER[dossier.statut]}
            </span>
            {/* L'issue n'est affichée que si elle dit autre chose que le
                statut : un dossier escaladé porterait sinon deux fois le même
                mot. */}
            {dossier.statut === "CLOTURE" && derniereDecision && (
              <span className={pastilleEtat(ETAT_ISSUE_DECISION[derniereDecision.issue])}>
                {LABELS_ISSUE_DECISION[derniereDecision.issue]}
              </span>
            )}
            {dossier.instructeur ? (
              <span className={pastilleEtat("neutre")}>
                Instruit par {dossier.instructeur.nom}
              </span>
            ) : (
              enAttente && <PrendreEnChargeBouton dossierId={dossier.id} />
            )}
          </>
        }
      />

      {dossier.complementDemandeLe && (
        <div className="mb-6 max-w-3xl">
          <MessageFormulaire
            type="avertissement"
            message={
              <span>
                <strong className="font-semibold">
                  Complément demandé {formaterAnciennete(dossier.complementDemandeLe)}
                </strong>{" "}
                — {dossier.complementDemandeMessage}
              </span>
            }
          />
        </div>
      )}

      <section className="max-w-3xl">
        <h2 className={`${TITRE_SECTION} mb-4`}>
          Lignes contestées{" "}
          <span className="font-body text-base font-medium text-[var(--color-ink-muted)]">
            · {dossier.lignes.length}
          </span>
        </h2>

        <ul className="flex flex-col gap-3">
          {dossier.lignes.map((ligne) => {
            const booking = ligne.ligneFacture.booking;
            const servis = booking.couvertsServis ?? booking.couverts;
            return (
              <li
                key={ligne.id}
                className="rounded-2xl border border-[var(--color-line-strong)] bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-ink)]">
                    {formaterDateReservation(booking.date, { avecHeure: false })}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                    {formaterMontant(ligne.ligneFacture.montantCentimes)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={pastilleEtat("marque")}>
                    {LABELS_MOTIF_CONTESTATION[ligne.motif]}
                  </span>
                  <span className={pastilleEtat("neutre")}>
                    {servis} couvert{servis > 1 ? "s" : ""} servis sur {booking.couverts} réservé
                    {booking.couverts > 1 ? "s" : ""}
                  </span>
                  {booking.signaleeLe && (
                    <span className={pastilleEtat("neutre")}>
                      {formaterDelaiSignalement(booking.date, booking.signaleeLe)}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {(dossier.commentaire || dossier.piecesJointes.length > 0) && (
          <div className={`${CARTE} mt-4 flex flex-col gap-5`}>
            {dossier.commentaire && (
              <div>
                <p className={EYEBROW}>Commentaire du restaurant</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink)]">
                  {dossier.commentaire}
                </p>
              </div>
            )}

            {dossier.piecesJointes.length > 0 && (
              <div>
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
          </div>
        )}
      </section>

      {peutInstruire && (
        <section className="mt-10 max-w-3xl">
          <h2 className={`${TITRE_SECTION} mb-4`}>Demander un complément</h2>
          <div className={CARTE}>
            <DemanderComplementForm dossierId={dossier.id} />
          </div>
        </section>
      )}

      <section className="mt-10 max-w-3xl">
        <h2 className={`${TITRE_SECTION} mb-4`}>Décision</h2>

        {dossier.decisions.length > 0 && (
          <ul className="mb-4 flex flex-col gap-3">
            {dossier.decisions.map((decision) => (
              <li key={decision.id} className={CARTE}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={pastilleEtat(ETAT_ISSUE_DECISION[decision.issue])}>
                    {LABELS_ISSUE_DECISION[decision.issue]}
                  </span>
                  <span className="text-sm text-[var(--color-ink-muted)]">
                    {decision.decidePar ? decision.decidePar.nom : "Traitement automatique"} ·{" "}
                    {formaterAnciennete(decision.createdAt)}
                  </span>
                </div>

                <p className="mt-3 font-semibold text-[var(--color-ink)]">
                  {decision.montantAccordeCentimes > 0
                    ? `${formaterMontant(decision.montantAccordeCentimes)} crédités`
                    : "Rien de crédité"}
                  {decision.imputation && (
                    <span className="font-normal text-[var(--color-ink-muted)]">
                      {" "}
                      · {LABELS_IMPUTATION_LITIGE[decision.imputation]}
                    </span>
                  )}
                </p>

                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink)]">{decision.motif}</p>

                {decision.avoir && (
                  <p className="mt-3 border-t border-[var(--color-line)] pt-3 text-sm text-[var(--color-ink-muted)]">
                    Avoir{" "}
                    <span className="font-semibold text-[var(--color-ink)]">
                      {referenceAvoir(decision.avoir)}
                    </span>{" "}
                    émis sur la facture.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {peutInstruire ? (
          <div className={CARTE}>
            <DeciderDossierForm
              dossierId={dossier.id}
              montantContesteCentimes={dossier.montantContesteCentimes}
              montantConteste={formaterMontant(dossier.montantContesteCentimes)}
            />
          </div>
        ) : (
          dossierATrancher(dossier.statut) && (
            <MessageFormulaire
              type="avertissement"
              message="Prenez ce dossier en charge pour pouvoir le trancher."
            />
          )
        )}
      </section>

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-4`}>La facture contestée</h2>
        <FactureDocument
          facture={dossier.facture}
          joursRestants={joursRestantsContestation(dossier.facture.genereeLe)}
        />
      </section>

      {autresDossiers.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className={`${TITRE_SECTION} mb-4`}>
            Historique du partenaire{" "}
            <span className="font-body text-base font-medium text-[var(--color-ink-muted)]">
              · {autresDossiers.length} autre{autresDossiers.length > 1 ? "s" : ""} dossier
              {autresDossiers.length > 1 ? "s" : ""}
            </span>
          </h2>
          <ul className="flex flex-col gap-2">
            {autresDossiers.map((autre) => (
              <li key={autre.id}>
                <Link
                  href={`/admin/litiges/${autre.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-line-strong)] bg-white px-5 py-3.5 text-sm transition-colors hover:border-[var(--color-staff)]"
                >
                  <span className="text-[var(--color-ink-muted)]">
                    Déposé {formaterAnciennete(autre.createdAt)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={pastilleEtat(ETAT_STATUT_DOSSIER[autre.statut])}>
                      {LABELS_STATUT_DOSSIER[autre.statut]}
                    </span>
                    <span className="font-semibold text-[var(--color-ink)]">
                      {formaterMontant(autre.montantContesteCentimes)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

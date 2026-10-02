import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DeciderDemandeForm } from "@/components/DeciderDemandeForm";
import { DemanderComplementDemandeForm } from "@/components/DemanderComplementDemandeForm";
import { EnteteEspace } from "@/components/EnteteEspace";
import { JournalDemande } from "@/components/JournalDemande";
import { formaterAnciennete } from "@/lib/contestation";
import {
  demandeEstOuverte,
  ETAT_STATUT_DEMANDE,
  LABELS_STATUT_DEMANDE,
} from "@/lib/demande-labels";
import { formaterHorodatageDemande } from "@/lib/evenements-demande";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW, TITRE_SECTION, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Demande restaurateur" };

/**
 * Fiche d'une demande de contact restaurateur : toutes les informations
 * déposées, son statut, son journal (du plus récent au plus ancien) et, tant
 * qu'elle n'est pas décidée, les formulaires qui demandent un complément ou
 * la tranche.
 *
 * La garde d'accès est refaite ici, pas seulement dans le layout — voir
 * `exigerSessionStaff`.
 */
export default async function DemandeRestaurateurPage({
  params,
}: {
  params: Promise<{ demandeId: string }>;
}) {
  await exigerSessionStaff();

  const { demandeId } = await params;

  const demande = await prisma.demandeContactRestaurateur.findUnique({
    where: { id: demandeId },
    include: {
      evenements: {
        include: { auteurStaff: { select: { nom: true } } },
        // Du plus récent au plus ancien. `type` en second départage le dépôt
        // et la décision écrits dans la même transaction (l'enum est déclaré
        // dans l'ordre chronologique, donc DECISION passe avant DEPOT en
        // tri décroissant).
        orderBy: [{ createdAt: "desc" }, { type: "desc" }],
      },
    },
  });
  if (!demande) notFound();

  const encoreOuverte = demandeEstOuverte(demande.statut);

  return (
    <>
      <Link
        href="/admin/contacts-restaurateurs"
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-staff)] hover:underline"
      >
        ← Demandes restaurateurs
      </Link>

      <EnteteEspace
        titre={demande.etablissement}
        description={`Déposée ${formaterAnciennete(demande.createdAt)} par ${demande.nom}.`}
        actions={
          <span className={pastilleEtat(ETAT_STATUT_DEMANDE[demande.statut])}>
            {LABELS_STATUT_DEMANDE[demande.statut]}
          </span>
        }
      />

      <section className="max-w-3xl">
        <div className={CARTE}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={EYEBROW}>Contact</dt>
              <dd className="mt-1 text-sm text-[var(--color-ink)]">
                {demande.nom} ·{" "}
                <a href={`mailto:${demande.email}`} className="underline">
                  {demande.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className={EYEBROW}>Établissement</dt>
              <dd className="mt-1 text-sm text-[var(--color-ink)]">{demande.etablissement}</dd>
            </div>
            <div>
              <dt className={EYEBROW}>Adresse</dt>
              <dd className="mt-1 text-sm text-[var(--color-ink)]">
                {demande.adresse ?? "Non renseignée"}
              </dd>
            </div>
            <div>
              <dt className={EYEBROW}>SIREN</dt>
              <dd className="mt-1 text-sm text-[var(--color-ink)]">
                {demande.siren ?? "Non renseigné"}
              </dd>
            </div>
            <div>
              <dt className={EYEBROW}>Menus à la cuillère</dt>
              <dd className="mt-1 text-sm text-[var(--color-ink)]">
                {demande.menusALaCuillere === null
                  ? "Non renseigné"
                  : demande.menusALaCuillere
                    ? "Oui"
                    : "Non"}
              </dd>
            </div>
            <div>
              <dt className={EYEBROW}>Google My Business</dt>
              <dd className="mt-1 text-sm text-[var(--color-ink)]">
                {demande.urlGoogleMyBusiness ? (
                  <a
                    href={demande.urlGoogleMyBusiness}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Voir la fiche
                  </a>
                ) : (
                  "Non renseigné"
                )}
              </dd>
            </div>
            <div>
              <dt className={EYEBROW}>Reçue le</dt>
              <dd className="mt-1 text-sm text-[var(--color-ink)]">
                {formaterHorodatageDemande(demande.createdAt)}
              </dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-[var(--color-line)] pt-4">
            <p className={EYEBROW}>Message</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink)]">
              {demande.message}
            </p>
          </div>
        </div>
      </section>

      {encoreOuverte && (
        <section className="mt-10 max-w-3xl">
          <h2 className={`${TITRE_SECTION} mb-1`}>Demander des informations</h2>
          <p className="mb-4 text-sm text-[var(--color-ink-muted)]">
            Le message est enregistré au journal ; le contact part à la main. La demande reste
            ouverte, vous pouvez la trancher plus tard.
          </p>
          <div className={CARTE}>
            <DemanderComplementDemandeForm demandeId={demande.id} />
          </div>
        </section>
      )}

      {encoreOuverte && (
        <section className="mt-10 max-w-3xl">
          <h2 className={`${TITRE_SECTION} mb-4`}>Décision</h2>
          <div className={CARTE}>
            <DeciderDemandeForm demandeId={demande.id} />
          </div>
        </section>
      )}

      <section className="mt-10 max-w-3xl">
        <h2 className={`${TITRE_SECTION} mb-1`}>Journal</h2>
        <p className="mb-5 text-sm text-[var(--color-ink-muted)]">
          Tout ce qui a été fait sur cette demande, du plus récent au plus ancien. En ajout seul :
          rien ne s&apos;y modifie ni ne s&apos;en supprime.
        </p>
        {demande.evenements.length > 0 ? (
          <div className={CARTE}>
            <JournalDemande evenements={demande.evenements} />
          </div>
        ) : (
          <div className={CARTE}>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Aucun événement. Le journal commence au prochain geste.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { IconeChevron } from "@/components/Icones";
import { PrendreEnChargeBouton } from "@/components/PrendreEnChargeBouton";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { formaterAnciennete, STATUTS_A_TRANCHER } from "@/lib/contestation";
import { formaterMontant } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { ETAT_VIDE, TITRE_SECTION, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Litiges" };

/**
 * "File des litiges à instruire" — le plan de travail quotidien de l'équipe
 * Partenaires : les dossiers qui restent à trancher (les dossiers sous le
 * seuil de crédit d'office ne passent pas par ici, voir decisionStatutDossier
 * dans src/lib/contestation.ts), triés par ancienneté pour voir la queue
 * grossir avant qu'elle ne devienne un problème.
 *
 * Deux files plutôt qu'une : un dossier escaladé a déjà été instruit une fois
 * et attend une reprise par quelqu'un d'autre — le mélanger aux dossiers
 * jamais ouverts ferait perdre les deux. Un dossier tranché (crédité, accordé,
 * refusé) ne figure plus ici : c'est ce que la décision change.
 *
 * La garde d'accès est faite une fois dans le layout parent.
 */
export default async function LitigesAdminPage() {
  await exigerSessionStaff();

  const dossiers = await prisma.dossier.findMany({
    where: { statut: { in: [...STATUTS_A_TRANCHER] } },
    include: {
      facture: { include: { restaurant: { select: { nom: true } } } },
      instructeur: { select: { nom: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const aInstruire = dossiers.filter((dossier) => dossier.statut === "EN_ATTENTE_INSTRUCTION");
  const escalades = dossiers.filter((dossier) => dossier.statut === "ESCALADE");
  const nonAssignes = aInstruire.filter((dossier) => !dossier.instructeur).length;

  return (
    <>
      <EnteteEspace
        titre="File des litiges"
        description="Les dossiers en attente d'instruction, du plus ancien au plus récent. Ceux sous le seuil de crédit d'office n'apparaissent pas ici : ils sont réglés automatiquement."
        actions={
          aInstruire.length > 0 ? (
            <span className={pastilleEtat(nonAssignes > 0 ? "attention" : "succes")}>
              {nonAssignes > 0
                ? `${nonAssignes} sans instructeur`
                : "Tous les dossiers sont pris en charge"}
            </span>
          ) : undefined
        }
      />

      {aInstruire.length === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Aucun dossier en attente
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            La file est vide : rien à instruire pour le moment.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {aInstruire.map((dossier) => (
            <li key={dossier.id}>
              <LigneDossier
                id={dossier.id}
                restaurant={dossier.facture.restaurant.nom}
                montantContesteCentimes={dossier.montantContesteCentimes}
                deposeLe={dossier.createdAt}
                action={
                  dossier.instructeur ? (
                    <span className={pastilleEtat("succes")}>
                      Pris en charge par {dossier.instructeur.nom}
                    </span>
                  ) : (
                    <PrendreEnChargeBouton dossierId={dossier.id} />
                  )
                }
                lienLabel="Instruire"
              />
            </li>
          ))}
        </ul>
      )}

      {escalades.length > 0 && (
        <section className="mt-10">
          <h2 className={`${TITRE_SECTION} mb-1`}>Escaladés</h2>
          <p className="mb-4 text-sm text-[var(--color-ink-muted)]">
            Instruits une première fois, mais pas tranchés : ils sont ouverts à tout le staff.
          </p>
          <ul className="flex flex-col gap-3">
            {escalades.map((dossier) => (
              <li key={dossier.id}>
                <LigneDossier
                  id={dossier.id}
                  restaurant={dossier.facture.restaurant.nom}
                  montantContesteCentimes={dossier.montantContesteCentimes}
                  deposeLe={dossier.createdAt}
                  action={<span className={pastilleEtat("danger")}>Escaladé</span>}
                  lienLabel="Reprendre"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Une ligne de file — même rendu pour les dossiers à instruire et les escaladés. */
function LigneDossier({
  id,
  restaurant,
  montantContesteCentimes,
  deposeLe,
  action,
  lienLabel,
}: {
  id: string;
  restaurant: string;
  montantContesteCentimes: number;
  deposeLe: Date;
  action: React.ReactNode;
  lienLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-line-strong)] bg-white p-5">
      <div className="min-w-0 flex-1">
        <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
          {restaurant}
        </p>
        <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
          {formaterMontant(montantContesteCentimes)} contestés · déposé{" "}
          {formaterAnciennete(deposeLe)}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {action}
        <Link
          href={`/admin/litiges/${id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-staff)] hover:underline"
        >
          {lienLabel}
          <IconeChevron taille={15} />
        </Link>
      </div>
    </div>
  );
}

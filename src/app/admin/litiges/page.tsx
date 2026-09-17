import type { Metadata } from "next";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { IconeChevron } from "@/components/Icones";
import { PrendreEnChargeBouton } from "@/components/PrendreEnChargeBouton";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { formaterAnciennete } from "@/lib/contestation";
import { formaterMontant } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { ETAT_VIDE, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Litiges" };

/**
 * "File des litiges à instruire" — le plan de travail quotidien de l'équipe
 * Partenaires : les dossiers EN_ATTENTE_INSTRUCTION (les dossiers sous le
 * seuil de crédit d'office ne passent pas par ici, voir decisionStatutDossier
 * dans src/lib/contestation.ts), triés par ancienneté pour voir la queue
 * grossir avant qu'elle ne devienne un problème. Prendre en charge assigne un
 * instructeur mais ne change pas le statut : trancher le dossier reste
 * "Décision & émission d'avoir", pas encore construit (voir
 * admin/litiges/[dossierId]/page.tsx pour l'instruction elle-même).
 *
 * La garde d'accès est faite une fois dans le layout parent.
 */
export default async function LitigesAdminPage() {
  await exigerSessionStaff();

  const dossiers = await prisma.dossier.findMany({
    where: { statut: "EN_ATTENTE_INSTRUCTION" },
    include: {
      facture: { include: { restaurant: { select: { nom: true } } } },
      instructeur: { select: { nom: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const nonAssignes = dossiers.filter((dossier) => !dossier.instructeur).length;

  return (
    <>
      <EnteteEspace
        titre="File des litiges"
        description="Les dossiers en attente d'instruction, du plus ancien au plus récent. Ceux sous le seuil de crédit d'office n'apparaissent pas ici : ils sont réglés automatiquement."
        actions={
          dossiers.length > 0 ? (
            <span className={pastilleEtat(nonAssignes > 0 ? "attention" : "succes")}>
              {nonAssignes > 0
                ? `${nonAssignes} sans instructeur`
                : "Tous les dossiers sont pris en charge"}
            </span>
          ) : undefined
        }
      />

      {dossiers.length === 0 ? (
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
          {dossiers.map((dossier) => (
            <li
              key={dossier.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-line-strong)] bg-white p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                  {dossier.facture.restaurant.nom}
                </p>
                <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                  {formaterMontant(dossier.montantContesteCentimes)} contestés · déposé{" "}
                  {formaterAnciennete(dossier.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                {dossier.instructeur ? (
                  <span className={pastilleEtat("succes")}>
                    Pris en charge par {dossier.instructeur.nom}
                  </span>
                ) : (
                  <PrendreEnChargeBouton dossierId={dossier.id} />
                )}
                <Link
                  href={`/admin/litiges/${dossier.id}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-staff)] hover:underline"
                >
                  Instruire
                  <IconeChevron taille={15} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

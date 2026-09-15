import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

import { PrendreEnChargeBouton } from "@/components/PrendreEnChargeBouton";
import { authAdmin } from "@/lib/auth";
import { formaterAnciennete } from "@/lib/contestation";
import { formaterMontant } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { BOUTON_SECONDAIRE, CARTE, EYEBROW } from "@/lib/ui";

/**
 * "File des litiges à instruire" — le plan de travail quotidien de l'équipe
 * Partenaires : les dossiers EN_ATTENTE_INSTRUCTION (les dossiers sous le
 * seuil de crédit d'office ne passent pas par ici, voir decisionStatutDossier
 * dans src/lib/contestation.ts), triés par ancienneté pour voir la queue
 * grossir avant qu'elle ne devienne un problème. Prendre en charge assigne un
 * instructeur mais ne change pas le statut : trancher le dossier reste
 * "Décision & émission d'avoir", pas encore construit (voir
 * admin/litiges/[dossierId]/page.tsx pour l'instruction elle-même).
 */
export default async function LitigesAdminPage() {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const dossiers = await prisma.dossier.findMany({
    where: { statut: "EN_ATTENTE_INSTRUCTION" },
    include: {
      facture: { include: { restaurant: { select: { nom: true } } } },
      instructeur: { select: { nom: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className={EYEBROW}>BO Admin</p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        File des litiges à instruire
      </h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""} en attente d&apos;instruction
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {dossiers.map((dossier) => (
          <div key={dossier.id} className={`${CARTE} flex items-center justify-between gap-4`}>
            <div>
              <p className="font-semibold text-[var(--color-ink)]">{dossier.facture.restaurant.nom}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">
                {formaterMontant(dossier.montantContesteCentimes)} contestés · déposé{" "}
                {formaterAnciennete(dossier.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {dossier.instructeur ? (
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  Pris en charge par {dossier.instructeur.nom}
                </p>
              ) : (
                <PrendreEnChargeBouton dossierId={dossier.id} />
              )}
              <Link href={`/admin/litiges/${dossier.id}`} className={BOUTON_SECONDAIRE}>
                Voir le détail
              </Link>
            </div>
          </div>
        ))}

        {dossiers.length === 0 && (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Aucun dossier en attente d&apos;instruction.
          </p>
        )}
      </div>
    </main>
  );
}

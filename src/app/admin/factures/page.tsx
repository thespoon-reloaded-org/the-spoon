import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GenererFacturesForm } from "@/components/GenererFacturesForm";
import { authAdmin } from "@/lib/auth";
import { formaterMoisFacture, formaterMontant } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW } from "@/lib/ui";

function moisPrecedentISO(): string {
  const maintenant = new Date();
  const moisPrecedent = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 1, 1));
  return `${moisPrecedent.getUTCFullYear()}-${String(moisPrecedent.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Déclenchement et suivi des factures mensuelles — "Déclenchement & vue des factures (BO Admin)". */
export default async function FacturesAdminPage() {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const factures = await prisma.facture.findMany({
    include: { restaurant: { select: { nom: true } }, lignes: true },
    orderBy: [{ mois: "desc" }, { restaurant: { nom: "asc" } }],
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className={EYEBROW}>BO Admin</p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Facturation
      </h1>

      <div className={`mt-6 ${CARTE}`}>
        <GenererFacturesForm moisParDefaut={moisPrecedentISO()} />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {factures.map((facture) => (
          <Link
            key={facture.id}
            href={`/admin/factures/${facture.id}`}
            className={`${CARTE} flex items-center justify-between transition-colors hover:border-[var(--color-ink)]`}
          >
            <div>
              <p className="font-semibold text-[var(--color-ink)]">{facture.restaurant.nom}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">
                <span className="capitalize">{formaterMoisFacture(facture.mois)}</span> ·{" "}
                {facture.lignes.length} réservation{facture.lignes.length > 1 ? "s" : ""} honorée
                {facture.lignes.length > 1 ? "s" : ""}
              </p>
            </div>
            <p className="font-semibold text-[var(--color-ink)]">
              {formaterMontant(facture.montantTotalCentimes)}
            </p>
          </Link>
        ))}

        {factures.length === 0 && (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Aucune facture générée pour l&apos;instant.
          </p>
        )}
      </div>
    </main>
  );
}

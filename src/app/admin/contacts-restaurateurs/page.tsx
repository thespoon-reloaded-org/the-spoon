import type { Metadata } from "next";

import { EnteteEspace } from "@/components/EnteteEspace";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { formaterAnciennete } from "@/lib/contestation";
import { prisma } from "@/lib/prisma";
import { ETAT_VIDE } from "@/lib/ui";

export const metadata: Metadata = { title: "Demandes restaurateurs" };

/**
 * Les demandes de contact déposées par des restaurateurs pas encore
 * partenaires — depuis la landing ou l'écran de connexion restaurant (voir
 * `/devenir-partenaire`). Juste une liste pour l'instant, du plus récent au
 * plus ancien : pas de statut de traitement, ça arrivera avec le ticket qui
 * décrira le suivi de ces demandes.
 *
 * La garde d'accès est faite une fois dans le layout parent.
 */
export default async function ContactsRestaurateursAdminPage() {
  await exigerSessionStaff();

  const demandes = await prisma.demandeContactRestaurateur.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <EnteteEspace
        titre="Demandes restaurateurs"
        description="Les prises de contact de restaurateurs pas encore référencés, du plus récent au plus ancien."
      />

      {demandes.length === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Aucune demande pour le moment
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            Les demandes déposées depuis la landing ou l&apos;écran de connexion restaurant
            apparaîtront ici.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {demandes.map((demande) => (
            <li
              key={demande.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line-strong)] bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                    {demande.etablissement}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    {demande.nom} ·{" "}
                    <a href={`mailto:${demande.email}`} className="underline">
                      {demande.email}
                    </a>
                  </p>
                  {demande.adresse && (
                    <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                      {demande.adresse}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm text-[var(--color-ink-muted)]">
                  {formaterAnciennete(demande.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">
                {demande.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

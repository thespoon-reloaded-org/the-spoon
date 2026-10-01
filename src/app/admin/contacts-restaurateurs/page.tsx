import type { Metadata } from "next";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { formaterAnciennete } from "@/lib/contestation";
import { ETAT_STATUT_DEMANDE, LABELS_STATUT_DEMANDE } from "@/lib/demande-labels";
import { prisma } from "@/lib/prisma";
import { CARTE_CLIQUABLE, ETAT_VIDE, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Demandes restaurateurs" };

/**
 * Les demandes de contact déposées par des restaurateurs pas encore
 * partenaires — depuis la landing ou l'écran de connexion restaurant (voir
 * `/devenir-partenaire`). Chaque carte ouvre la fiche détail, où le staff
 * accepte ou rejette la demande et lit son journal.
 *
 * La garde d'accès est faite une fois dans le layout parent, et dans chaque
 * page (voir `src/lib/garde-staff.ts`).
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
            <li key={demande.id}>
              <Link
                href={`/admin/contacts-restaurateurs/${demande.id}`}
                className={`${CARTE_CLIQUABLE} flex flex-col gap-3`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                      {demande.etablissement}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                      {demande.nom} · {demande.email}
                    </p>
                    {demande.adresse && (
                      <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                        {demande.adresse}
                      </p>
                    )}
                    {demande.siren && (
                      <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                        SIREN : {demande.siren}
                      </p>
                    )}
                    {demande.menusALaCuillere !== null && (
                      <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                        Menus à la cuillère : {demande.menusALaCuillere ? "oui" : "non"}
                      </p>
                    )}
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={pastilleEtat(ETAT_STATUT_DEMANDE[demande.statut])}>
                      {LABELS_STATUT_DEMANDE[demande.statut]}
                    </span>
                    <span className="text-sm text-[var(--color-ink-muted)]">
                      {formaterAnciennete(demande.createdAt)}
                    </span>
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">
                  {demande.message}
                </p>
              </Link>
              {demande.urlGoogleMyBusiness && (
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                  <a
                    href={demande.urlGoogleMyBusiness}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Fiche Google My Business
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

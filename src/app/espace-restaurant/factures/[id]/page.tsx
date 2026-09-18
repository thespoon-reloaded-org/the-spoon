import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { FactureDocument } from "@/components/FactureDocument";
import { IconeChevron } from "@/components/Icones";
import { authRestaurant } from "@/lib/auth";
import {
  ETAT_ISSUE_DECISION,
  formaterAnciennete,
  LABELS_ISSUE_DECISION,
  STATUT_DOSSIER_COTE_RESTAURANT,
} from "@/lib/contestation";
import { formaterMontant, joursRestantsContestation } from "@/lib/facturation";
import { BOUTON_PRIMAIRE, CARTE_CLIQUABLE, TITRE_SECTION, pastilleEtat } from "@/lib/ui";
import { prisma } from "@/lib/prisma";

/**
 * Détail d'une facture, ligne à ligne — chaque ligne rattachée à sa
 * réservation (voir ticket "Mes factures (côté restaurant)"). Scopée au
 * restaurant du contact connecté : pas d'accès à la facture d'un autre
 * restaurant même en devinant l'id.
 */
export default async function FactureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null;

  const { id } = await params;

  const facture = await prisma.facture.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
    include: {
      restaurant: { select: { nom: true, adresse: true } },
      lignes: { include: { booking: true }, orderBy: { createdAt: "asc" } },
      avoirs: { orderBy: { emisLe: "asc" } },
    },
  });
  if (!facture) notFound();

  // Un dossier n'était atteignable qu'une fois, juste après son dépôt : la
  // décision arrive des jours plus tard, il faut pouvoir y revenir.
  const dossiers = await prisma.dossier.findMany({
    where: { factureId: facture.id },
    include: { decisions: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const joursRestants = joursRestantsContestation(facture.genereeLe);

  return (
    <>
      <FactureDocument
        facture={facture}
        joursRestants={joursRestants}
        retour={{ href: "/espace-restaurant/factures", label: "Mes factures" }}
      />

      {dossiers.length > 0 && (
        <section className="mt-8 max-w-3xl">
          <h2 className={`${TITRE_SECTION} mb-4`}>
            Mes contestations sur cette facture{" "}
            <span className="font-body text-base font-medium text-[var(--color-ink-muted)]">
              · {dossiers.length}
            </span>
          </h2>
          <ul className="flex flex-col gap-3">
            {dossiers.map((dossier) => {
              const decision = dossier.decisions[0];
              return (
                <li key={dossier.id}>
                  <Link
                    href={`/espace-restaurant/factures/${facture.id}/contester/${dossier.id}`}
                    className={`${CARTE_CLIQUABLE} flex flex-wrap items-center justify-between gap-4`}
                  >
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">
                        {formaterMontant(dossier.montantContesteCentimes)} contestés
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                        Déposé {formaterAnciennete(dossier.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Un crédit d'office garde son libellé : dire "Accordé"
                          perdrait le fait que personne ne l'a instruit. */}
                      {dossier.statut === "CLOTURE" && decision ? (
                        <span className={pastilleEtat(ETAT_ISSUE_DECISION[decision.issue])}>
                          {LABELS_ISSUE_DECISION[decision.issue]}
                        </span>
                      ) : (
                        <span
                          className={pastilleEtat(
                            STATUT_DOSSIER_COTE_RESTAURANT[dossier.statut].etat,
                          )}
                        >
                          {STATUT_DOSSIER_COTE_RESTAURANT[dossier.statut].libelle}
                        </span>
                      )}
                      <span className="text-[var(--color-ink-muted)]">
                        <IconeChevron taille={18} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* L'action de contestation était un bouton posé à côté du document,
          aligné par une marge en dur (`md:mt-16`). Elle vit maintenant sous la
          facture, avec le délai qui la conditionne : c'est cette information
          qui décide si on clique ou non. */}
      {joursRestants > 0 && (
        <div className="mt-5 flex max-w-3xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-line-strong)] bg-white p-5 shadow-[var(--shadow-carte)]">
          <div>
            <p className="font-semibold text-[var(--color-ink)]">Un couvert facturé à tort ?</p>
            <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
              Il vous reste {joursRestants} jour{joursRestants > 1 ? "s" : ""} pour déposer un
              dossier sur cette facture.
            </p>
          </div>
          <Link
            href={`/espace-restaurant/factures/${facture.id}/contester`}
            className={BOUTON_PRIMAIRE}
          >
            Contester cette facture
          </Link>
        </div>
      )}
    </>
  );
}

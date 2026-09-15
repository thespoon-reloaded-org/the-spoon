import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { IconeChevron } from "@/components/Icones";
import { authRestaurant } from "@/lib/auth";
import {
  COMMISSION_CENTIMES_PAR_COUVERT,
  formaterMoisFacture,
  formaterMontant,
  joursRestantsContestation,
} from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { CARTE_CLIQUABLE, ETAT_VIDE, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Factures" };

/** "Mes factures (côté restaurant)" — la garde d'accès est faite dans le layout parent. */
export default async function MesFacturesPage() {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null;

  const factures = await prisma.facture.findMany({
    where: { restaurantId: session.user.restaurantId },
    include: { _count: { select: { lignes: true } } },
    orderBy: { mois: "desc" },
  });

  return (
    <>
      <EnteteEspace
        titre="Mes factures"
        description={`La commission TheSpoon est de ${formaterMontant(
          COMMISSION_CENTIMES_PAR_COUVERT,
        )} par couvert servi sur une réservation honorée.`}
      />

      {factures.length === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Aucune facture pour l&apos;instant
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            Les factures sont générées chaque mois à partir des réservations que vous avez pointées
            honorées.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {factures.map((facture) => {
            const joursRestants = joursRestantsContestation(facture.genereeLe);
            return (
              <li key={facture.id}>
                <Link
                  href={`/espace-restaurant/factures/${facture.id}`}
                  className={`${CARTE_CLIQUABLE} flex flex-wrap items-center justify-between gap-4`}
                >
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-lg font-bold capitalize text-[var(--color-ink)]">
                      {formaterMoisFacture(facture.mois)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                      {facture._count.lignes} réservation{facture._count.lignes > 1 ? "s" : ""}{" "}
                      honorée{facture._count.lignes > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={pastilleEtat(joursRestants > 0 ? "attention" : "neutre")}>
                      {joursRestants > 0
                        ? `${joursRestants} jour${joursRestants > 1 ? "s" : ""} pour contester`
                        : "Délai de contestation expiré"}
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
                      {formaterMontant(facture.montantTotalCentimes)}
                    </span>
                    <span className="text-[var(--color-ink-muted)]">
                      <IconeChevron taille={18} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

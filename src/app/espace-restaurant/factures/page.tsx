import { headers } from "next/headers";
import Link from "next/link";

import { authRestaurant } from "@/lib/auth";
import { formaterMoisFacture, formaterMontant, joursRestantsContestation } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { CARTE, EYEBROW } from "@/lib/ui";

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
    <div>
      <h2 className={EYEBROW}>Mes factures</h2>

      {factures.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucune facture pour l&apos;instant.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {factures.map((facture) => {
            const joursRestants = joursRestantsContestation(facture.genereeLe);
            return (
              <li key={facture.id}>
                <Link
                  href={`/espace-restaurant/factures/${facture.id}`}
                  className={`${CARTE} flex items-center justify-between transition-colors hover:border-[var(--color-ink)]`}
                >
                  <div>
                    <p className="font-semibold text-[var(--color-ink)] capitalize">
                      {formaterMoisFacture(facture.mois)}
                    </p>
                    <p className="text-sm text-[var(--color-ink-muted)]">
                      {facture._count.lignes} réservation{facture._count.lignes > 1 ? "s" : ""} honorée
                      {facture._count.lignes > 1 ? "s" : ""} ·{" "}
                      {joursRestants > 0
                        ? `${joursRestants} jour${joursRestants > 1 ? "s" : ""} pour contester`
                        : "Délai de contestation expiré"}
                    </p>
                  </div>
                  <p className="font-semibold text-[var(--color-ink)]">
                    {formaterMontant(facture.montantTotalCentimes)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

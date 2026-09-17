import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { FactureDocument } from "@/components/FactureDocument";
import { authRestaurant } from "@/lib/auth";
import { joursRestantsContestation } from "@/lib/facturation";
import { BOUTON_PRIMAIRE } from "@/lib/ui";
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
    },
  });
  if (!facture) notFound();

  const joursRestants = joursRestantsContestation(facture.genereeLe);

  return (
    <>
      <FactureDocument
        facture={facture}
        joursRestants={joursRestants}
        retour={{ href: "/espace-restaurant/factures", label: "Mes factures" }}
      />

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

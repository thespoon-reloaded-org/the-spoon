import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { deposerContestation } from "./actions";
import { DeposerContestationForm } from "@/components/DeposerContestationForm";
import { authRestaurant } from "@/lib/auth";
import { formaterMontant, joursRestantsContestation } from "@/lib/facturation";
import { CARTE, EYEBROW } from "@/lib/ui";
import { prisma } from "@/lib/prisma";

/**
 * Sélection des lignes à contester sur une facture + dépôt du dossier —
 * "Dépôt d'un dossier de contestation". Scopée au restaurant du contact
 * connecté, comme la page de détail de facture.
 */
export default async function ContesterFacturePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null; // garde déjà faite par le layout

  const { id } = await params;

  const facture = await prisma.facture.findFirst({
    where: { id, restaurantId: session.user.restaurantId },
    include: {
      lignes: { include: { booking: true, contestation: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!facture) notFound();

  const joursRestants = joursRestantsContestation(facture.genereeLe);
  const lignesDisponibles = facture.lignes
    .filter((ligne) => !ligne.contestation)
    .map((ligne) => ({
      id: ligne.id,
      dateFormatee: `${ligne.booking.date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })} à ${ligne.booking.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
      montantFormate: formaterMontant(ligne.montantCentimes),
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/espace-restaurant/factures/${facture.id}`}
          className="text-sm text-[var(--color-ink-muted)] hover:underline"
        >
          ← Retour à la facture
        </Link>
        <h2 className={`${EYEBROW} mt-3`}>Contester des lignes de facture</h2>
      </div>

      <div className={CARTE}>
        {joursRestants === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Le délai de contestation de cette facture est dépassé.
          </p>
        ) : lignesDisponibles.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-muted)]">
            Toutes les lignes de cette facture sont déjà contestées.
          </p>
        ) : (
          <DeposerContestationForm
            action={deposerContestation.bind(null, facture.id)}
            lignes={lignesDisponibles}
          />
        )}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { deposerContestation } from "./actions";
import { DeposerContestationForm } from "@/components/DeposerContestationForm";
import { EnteteEspace } from "@/components/EnteteEspace";
import { authRestaurant } from "@/lib/auth";
import { formaterDateReservation, formaterMontant, joursRestantsContestation } from "@/lib/facturation";
import { CARTE, ETAT_VIDE, pastilleEtat } from "@/lib/ui";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Contester une facture" };

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
      dateFormatee: formaterDateReservation(ligne.booking.date),
      montantFormate: formaterMontant(ligne.montantCentimes),
    }));

  return (
    <>
      <Link
        href={`/espace-restaurant/factures/${facture.id}`}
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-pro)] hover:underline"
      >
        ← Retour à la facture
      </Link>

      <EnteteEspace
        titre="Contester des lignes de facture"
        description="Cochez les réservations que vous estimez facturées à tort et indiquez un motif pour chacune. L'équipe Partenaires instruit le dossier."
        actions={
          joursRestants > 0 ? (
            <span className={pastilleEtat("attention")}>
              {joursRestants} jour{joursRestants > 1 ? "s" : ""} pour contester
            </span>
          ) : (
            <span className={pastilleEtat("neutre")}>Délai expiré</span>
          )
        }
      />

      {joursRestants === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Délai de contestation dépassé
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            Cette facture ne peut plus être contestée. Contactez l&apos;équipe Partenaires si vous
            pensez qu&apos;il y a une erreur.
          </p>
        </div>
      ) : lignesDisponibles.length === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Toutes les lignes sont déjà contestées
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            Il n&apos;y a plus de réservation contestable sur cette facture.
          </p>
        </div>
      ) : (
        <div className={`${CARTE} max-w-3xl`}>
          <DeposerContestationForm
            action={deposerContestation.bind(null, facture.id)}
            lignes={lignesDisponibles}
          />
        </div>
      )}
    </>
  );
}

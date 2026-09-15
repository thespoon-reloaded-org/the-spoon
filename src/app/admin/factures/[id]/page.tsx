import { notFound } from "next/navigation";

import { FactureDocument } from "@/components/FactureDocument";
import { joursRestantsContestation } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";

/** Détail d'une facture côté BO admin — même document que côté restaurant, sans scope restaurant (le staff voit tout). */
export default async function FactureAdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const facture = await prisma.facture.findUnique({
    where: { id },
    include: {
      restaurant: { select: { nom: true, adresse: true } },
      lignes: { include: { booking: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!facture) notFound();

  return (
    <FactureDocument
      facture={facture}
      joursRestants={joursRestantsContestation(facture.genereeLe)}
      retour={{ href: "/admin/factures", label: "Facturation" }}
    />
  );
}

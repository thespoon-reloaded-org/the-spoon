/**
 * Formatage des montants, isolé de `facturation.ts` (qui importe Prisma) pour
 * rester utilisable partout — y compris dans un module de rendu ou un
 * composant client, sans tirer `pg` dans le bundle du navigateur. Même
 * raisonnement que `contestation-labels.ts`.
 *
 * Les montants sont toujours stockés en centimes : un euro décimal en base
 * finirait par arrondir de travers une facture.
 */
export function formaterMontant(centimes: number): string {
  return (centimes / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

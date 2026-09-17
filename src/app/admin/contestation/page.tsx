import type { Metadata } from "next";

import { EnteteEspace } from "@/components/EnteteEspace";
import { SeuilContestationForm } from "@/components/SeuilContestationForm";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { getConfigContestation } from "@/lib/contestation";
import { formaterMontant } from "@/lib/facturation";
import { CARTE } from "@/lib/ui";

export const metadata: Metadata = { title: "Contestations" };

/**
 * Réglage du seuil de crédit d'office ("Montant contesté dérivé & seuil de
 * crédit d'office") — seul paramètre configurable de l'epic "Contestations &
 * litiges" pour l'instant. La garde d'accès est faite une fois dans le layout
 * parent.
 */
export default async function ContestationAdminPage() {
  await exigerSessionStaff();

  const config = await getConfigContestation();

  return (
    <>
      <EnteteEspace
        titre="Contestations"
        description={`Sous ${formaterMontant(
          config.seuilCreditOfficeCentimes,
        )}, un dossier de contestation est crédité d'office, sans instruction : le coût d'instruire dépasse le montant en jeu.`}
      />

      <div className={`${CARTE} max-w-xl`}>
        <SeuilContestationForm seuilActuelEuros={config.seuilCreditOfficeCentimes / 100} />
      </div>
    </>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SeuilContestationForm } from "@/components/SeuilContestationForm";
import { authAdmin } from "@/lib/auth";
import { getConfigContestation } from "@/lib/contestation";
import { CARTE, EYEBROW } from "@/lib/ui";

/**
 * Réglage du seuil de crédit d'office ("Montant contesté dérivé & seuil de
 * crédit d'office") — seul paramètre configurable de l'epic "Contestations &
 * litiges" pour l'instant.
 */
export default async function ContestationAdminPage() {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const config = await getConfigContestation();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className={EYEBROW}>BO Admin</p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        Contestations
      </h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        En dessous de ce montant, un dossier de contestation est crédité d&apos;office, sans instruction.
      </p>

      <div className={`mt-6 ${CARTE}`}>
        <SeuilContestationForm seuilActuelEuros={config.seuilCreditOfficeCentimes / 100} />
      </div>
    </main>
  );
}

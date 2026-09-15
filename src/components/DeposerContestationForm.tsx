"use client";

import { useActionState } from "react";

import type { EtatDepotContestation } from "@/app/espace-restaurant/factures/[id]/contester/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import { LABELS_MOTIF_CONTESTATION } from "@/lib/contestation-labels";
import { BOUTON_PRIMAIRE, CHAMP, CHAMP_FICHIER, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatDepotContestation = {};

const MOTIFS = Object.entries(LABELS_MOTIF_CONTESTATION) as [keyof typeof LABELS_MOTIF_CONTESTATION, string][];

/**
 * Vue d'une ligne prête à afficher côté client — date/montant déjà formatés
 * par la page serveur (contester/page.tsx), pour ne pas importer
 * src/lib/facturation.ts (qui tire `prisma`/`pg`) dans ce composant client.
 */
type LigneDisponible = {
  id: string;
  dateFormatee: string;
  montantFormate: string;
};

export function DeposerContestationForm({
  action,
  lignes,
}: {
  action: (etatPrecedent: EtatDepotContestation, formData: FormData) => Promise<EtatDepotContestation>;
  lignes: LigneDisponible[];
}) {
  const [etat, formAction, enCours] = useActionState(action, ETAT_INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {lignes.map((ligne) => (
          <label
            key={ligne.id}
            className="flex cursor-pointer flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-[var(--color-line-strong)] bg-white p-4 transition-colors hover:border-[var(--color-ink-muted)] has-[:checked]:border-[var(--color-pro)] has-[:checked]:bg-[var(--color-pro-tint)]"
          >
            <input
              type="checkbox"
              name="ligneIds"
              value={ligne.id}
              className="h-4 w-4 accent-[var(--color-pro)]"
            />
            <div className="min-w-[180px] flex-1 text-sm text-[var(--color-ink)]">
              {ligne.dateFormatee} · <span className="font-semibold">{ligne.montantFormate}</span>
            </div>
            <select name={`motif-${ligne.id}`} defaultValue="" className={`w-64 ${CHAMP}`}>
              <option value="" disabled>
                Motif de la contestation…
              </option>
              {MOTIFS.map(([valeur, libelle]) => (
                <option key={valeur} value={valeur}>
                  {libelle}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <label className={LABEL_CHAMP}>
        Commentaire (facultatif)
        <textarea
          name="commentaire"
          rows={4}
          maxLength={2000}
          placeholder="Précisez le contexte pour l'équipe Partenaires…"
          className={CHAMP}
        />
      </label>

      <label className={LABEL_CHAMP}>
        Pièces jointes (facultatif)
        <input
          type="file"
          name="piecesJointes"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          className={CHAMP_FICHIER}
        />
        <span className="text-xs font-normal text-[var(--color-ink-muted)]">
          Image ou PDF, 5 Mo max par fichier.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={enCours} className={BOUTON_PRIMAIRE}>
          {enCours ? "Envoi…" : "Déposer le dossier"}
        </button>
        {etat.erreur && <MessageFormulaire type="erreur">{etat.erreur}</MessageFormulaire>}
      </div>
    </form>
  );
}

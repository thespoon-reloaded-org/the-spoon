"use client";

import { useState, useTransition } from "react";

import { BOUTON_PRIMAIRE, BOUTON_SECONDAIRE, CHAMP, LABEL_CHAMP } from "@/lib/ui";

import { marquerMailEnvoye } from "./actions";

/**
 * Le brouillon rédigé par l'agent, modifiable avant envoi. L'envoi se fait
 * depuis la messagerie du staff (lien `mailto:`) : aucun mail ne part d'ici.
 */
export function BrouillonMail({
  id,
  email,
  objet: objetInitial,
  corps: corpsInitial,
  envoye,
}: {
  id: string;
  email: string;
  objet: string;
  corps: string;
  envoye: boolean;
}) {
  const [objet, setObjet] = useState(objetInitial);
  const [corps, setCorps] = useState(corpsInitial);
  const [copie, setCopie] = useState(false);
  const [enCours, demarrer] = useTransition();

  const lien = `mailto:${email}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;

  return (
    <div className="flex flex-col gap-3">
      <label className={LABEL_CHAMP}>
        Objet
        <input className={CHAMP} value={objet} onChange={(e) => setObjet(e.target.value)} />
      </label>
      <label className={LABEL_CHAMP}>
        Message
        <textarea
          className={`${CHAMP} min-h-48`}
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <a href={lien} className={BOUTON_SECONDAIRE}>
          Ouvrir dans ma messagerie
        </a>
        <button
          type="button"
          className={BOUTON_SECONDAIRE}
          onClick={async () => {
            await navigator.clipboard.writeText(corps);
            setCopie(true);
          }}
        >
          {copie ? "Copié" : "Copier le message"}
        </button>
        {!envoye && (
          <button
            type="button"
            className={BOUTON_PRIMAIRE}
            disabled={enCours}
            onClick={() => demarrer(() => marquerMailEnvoye(id))}
          >
            Marquer comme envoyé
          </button>
        )}
      </div>
    </div>
  );
}

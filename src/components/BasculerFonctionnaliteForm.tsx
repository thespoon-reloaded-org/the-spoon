"use client";

import { useActionState } from "react";

import {
  basculerFonctionnalite,
  type EtatFonctionnalite,
} from "@/app/formateur/fonctionnalites/actions";
import { MessageFormulaire } from "@/components/MessageFormulaire";
import type { CleFonctionnalite } from "@/generated/prisma";
import { BOUTON_DANGER_DISCRET, BOUTON_PRIMAIRE } from "@/lib/ui";

const ETAT_INITIAL: EtatFonctionnalite = {};

/** Un bouton : couper une fonctionnalité active, rallumer une fonctionnalité coupée. */
export function BasculerFonctionnaliteForm({
  cle,
  active,
}: {
  cle: CleFonctionnalite;
  active: boolean;
}) {
  const [etat, action, enCours] = useActionState(basculerFonctionnalite, ETAT_INITIAL);

  return (
    <form action={action} className="flex flex-col items-start gap-3 sm:items-end">
      <input type="hidden" name="cle" value={cle} />
      <input type="hidden" name="active" value={active ? "non" : "oui"} />
      <button
        type="submit"
        disabled={enCours}
        className={active ? BOUTON_DANGER_DISCRET : BOUTON_PRIMAIRE}
      >
        {enCours ? "Un instant…" : active ? "Couper pour tout TheSpoon" : "Rallumer"}
      </button>
      <MessageFormulaire type="succes" message={etat.message} />
      <MessageFormulaire type="erreur" message={etat.erreur} />
    </form>
  );
}

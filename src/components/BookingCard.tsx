"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { creerReservation, type EtatReservation } from "@/app/restaurants/[id]/actions";
import { CRENEAUX_HORAIRES, TAILLES_TABLE, type JourReservable } from "@/lib/creneaux";

const CHIP =
  "rounded-[13px] border-[1.5px] px-3 py-2.5 text-center text-sm font-semibold cursor-pointer select-none transition-colors";
const CHIP_INACTIF = `${CHIP} border-[var(--color-line-strong)] text-[var(--color-ink)]`;
const CHIP_ACTIF = `${CHIP} border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-cream)]`;
const BOUTON_CONFIRMER =
  "rounded-full bg-[var(--color-accent)] px-7 py-4 text-center font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] disabled:opacity-60";

const ETAT_INITIAL: EtatReservation = {};

export function BookingCard({
  restaurantId,
  estConnecte,
  jours,
}: {
  restaurantId: string;
  estConnecte: boolean;
  jours: JourReservable[];
}) {
  const [couverts, setCouverts] = useState<number>(TAILLES_TABLE[1].valeur);
  const [jourIso, setJourIso] = useState(jours[0]?.iso ?? "");
  const [creneau, setCreneau] = useState<string>(CRENEAUX_HORAIRES[3]);
  const [etat, action, enCours] = useActionState(creerReservation.bind(null, restaurantId), ETAT_INITIAL);

  if (etat.ok) {
    const jour = jours.find((j) => j.iso === jourIso);
    return (
      <div className="flex flex-col gap-2 rounded-[30px] border border-[var(--color-line)] bg-white p-7 text-center">
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
          Réservation confirmée 🥄
        </p>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {couverts} pers. · {jour?.jourSemaine} {jour?.numero} · {creneau}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-[30px] border border-[var(--color-line)] bg-white p-7">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[var(--color-ink)]">
          Réserver une table
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-muted)]">Confirmation immédiate · sans frais</p>
      </div>

      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="jourIso" value={jourIso} />
        <input type="hidden" name="creneau" value={creneau} />
        <input type="hidden" name="couverts" value={couverts} />

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
            CONVIVES
          </span>
          <div className="flex gap-2">
            {TAILLES_TABLE.map((t) => (
              <button
                key={t.valeur}
                type="button"
                onClick={() => setCouverts(t.valeur)}
                className={`flex-1 ${couverts === t.valeur ? CHIP_ACTIF : CHIP_INACTIF}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
            DATE
          </span>
          <div className="flex gap-2">
            {jours.map((j) => (
              <button
                key={j.iso}
                type="button"
                onClick={() => setJourIso(j.iso)}
                className={`flex-1 ${jourIso === j.iso ? CHIP_ACTIF : CHIP_INACTIF}`}
              >
                <span className="block text-[10px] uppercase opacity-70">{j.jourSemaine}</span>
                <span className="block font-[family-name:var(--font-display)] text-base">{j.numero}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-[var(--color-ink-muted)]">
            CRÉNEAUX
          </span>
          <div className="grid grid-cols-4 gap-2">
            {CRENEAUX_HORAIRES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCreneau(c)}
                className={creneau === c ? CHIP_ACTIF : CHIP_INACTIF}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {etat.erreur && <p className="text-sm text-red-600">{etat.erreur}</p>}

        {estConnecte ? (
          <button type="submit" disabled={enCours} className={BOUTON_CONFIRMER}>
            {enCours ? "Confirmation…" : "Confirmer la réservation"}
          </button>
        ) : (
          <Link href="/connexion" className={BOUTON_CONFIRMER}>
            Se connecter pour réserver
          </Link>
        )}

        <p className="text-center text-xs text-[var(--color-ink-muted)]">
          Vous ne serez pas débité · annulation gratuite
        </p>
      </form>
    </div>
  );
}

"use client";

import { useActionState } from "react";

import {
  envoyerDemandeContactRestaurateur,
  type EtatDemandeContact,
} from "@/app/(site)/devenir-partenaire/actions";
import { IconeValide } from "@/components/Icones";
import { CHAMP, LABEL_CHAMP } from "@/lib/ui";

const ETAT_INITIAL: EtatDemandeContact = {};

const BOUTON =
  "w-full rounded-full bg-[var(--color-pro)] px-7 py-3.5 text-center font-[family-name:var(--font-display)] text-[15px] font-bold text-[var(--color-cream)] transition-colors hover:bg-[var(--color-pro-deep)] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Formulaire de prise de contact pour un restaurateur pas encore partenaire.
 * Public, sans session — voir `envoyerDemandeContactRestaurateur`. Les
 * demandes déposées ici sont visibles depuis la Console staff
 * (`/admin/contacts-restaurateurs`).
 */
export function ContactRestaurateurForm() {
  const [etat, action, enCours] = useActionState(envoyerDemandeContactRestaurateur, ETAT_INITIAL);

  if (etat.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[28px] border border-[var(--color-line-strong)] bg-white p-8 text-center shadow-[var(--shadow-carte)]">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-success-tint)] text-[var(--color-success)]">
          <IconeValide taille={24} />
        </span>
        <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
          Demande envoyée
        </p>
        <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
          Merci, l&apos;équipe TheSpoon revient vers vous par email pour la suite.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-[28px] border border-[var(--color-line-strong)] bg-white p-8 shadow-[var(--shadow-carte)]"
    >
      <label className={LABEL_CHAMP}>
        Votre nom
        <input
          type="text"
          name="nom"
          required
          maxLength={100}
          className={CHAMP}
          placeholder="Jeanne Dupont"
        />
      </label>

      <label className={LABEL_CHAMP}>
        Email professionnel
        <input
          type="email"
          name="email"
          required
          maxLength={200}
          className={CHAMP}
          placeholder="contact@monrestaurant.fr"
        />
      </label>

      <label className={LABEL_CHAMP}>
        Nom de l&apos;établissement
        <input
          type="text"
          name="etablissement"
          required
          maxLength={150}
          className={CHAMP}
          placeholder="Le nom de votre restaurant"
        />
      </label>

      <label className={LABEL_CHAMP}>
        Adresse de l&apos;établissement
        <input
          type="text"
          name="adresse"
          required
          maxLength={250}
          autoComplete="street-address"
          className={CHAMP}
          placeholder="12 rue de la Paix, 75002 Paris"
        />
      </label>

      <label className={LABEL_CHAMP}>
        SIREN de l&apos;entreprise
        <input
          type="text"
          name="siren"
          required
          inputMode="numeric"
          maxLength={11}
          className={CHAMP}
          placeholder="123 456 789"
        />
      </label>

      <label className={LABEL_CHAMP}>
        Lien Google My Business (facultatif)
        <input
          type="url"
          name="urlGoogleMyBusiness"
          maxLength={500}
          className={CHAMP}
          placeholder="https://maps.app.goo.gl/…"
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={LABEL_CHAMP}>
          Proposez-vous des menus qui se mangent à la cuillère ?
        </legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
            <input
              type="radio"
              name="menusALaCuillere"
              value="oui"
              required
              className="h-4 w-4 accent-[var(--color-pro)]"
            />
            Oui
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
            <input
              type="radio"
              name="menusALaCuillere"
              value="non"
              required
              className="h-4 w-4 accent-[var(--color-pro)]"
            />
            Non
          </label>
        </div>
      </fieldset>

      <label className={LABEL_CHAMP}>
        Votre demande
        <textarea
          name="message"
          required
          maxLength={2000}
          rows={4}
          className={CHAMP}
          placeholder="Ville, type de cuisine, ce que vous cherchez…"
        />
      </label>

      {etat.erreur && (
        <p
          role="alert"
          className="rounded-xl bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]"
        >
          {etat.erreur}
        </p>
      )}

      <button type="submit" disabled={enCours} className={BOUTON}>
        {enCours ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}

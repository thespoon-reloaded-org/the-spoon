import type { Metadata } from "next";
import Link from "next/link";

import { ContactRestaurateurForm } from "@/components/ContactRestaurateurForm";
import { IconeFleche } from "@/components/Icones";

export const metadata: Metadata = { title: "Devenir partenaire — TheSpoon" };

/**
 * Prise de contact pour un restaurateur pas encore référencé sur TheSpoon.
 * Il n'y a pas d'inscription en ligne (les comptes sont ouverts par TheSpoon,
 * voir `/connexion-restaurant`) : cette page ne crée pas de compte, elle
 * dépose juste une demande que la Console staff peut lire et rappeler.
 */
export default function DevenirPartenairePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-14 md:px-10 md:py-20">
      <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--color-pro-accent)] px-4 py-2 text-[13px] font-bold text-[var(--color-pro-deep)]">
        ESPACE RESTAURATEUR
      </span>
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight text-[var(--color-ink)] md:text-4xl">
        Référencez votre établissement
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
        TheSpoon ouvre les comptes restaurateur à la main lors du référencement d&apos;un
        établissement — laissez-nous vos coordonnées, l&apos;équipe TheSpoon vous recontacte pour la
        suite.
      </p>

      <div className="mt-8 max-w-xl">
        <ContactRestaurateurForm />
      </div>

      <Link
        href="/connexion-restaurant"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-pro)] hover:underline"
      >
        Déjà partenaire ? Connectez-vous
        <IconeFleche taille={15} />
      </Link>
    </div>
  );
}

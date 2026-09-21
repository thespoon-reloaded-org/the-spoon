import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";

import { creerContactRestaurant } from "@/app/admin/restaurants/actions";
import { ContactRestaurantForm } from "@/components/ContactRestaurantForm";
import { EnteteEspace } from "@/components/EnteteEspace";
import { NoteCuilleres } from "@/components/NoteCuilleres";
import { PhotoCouverture } from "@/components/PhotoCouverture";
import { LIBELLE_ROLE_CONTACT } from "@/lib/contacts";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { photoRestaurant } from "@/lib/images";
import { formaterHoraires } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";
import {
  BOUTON_SECONDAIRE,
  CARTE,
  ETAT_VIDE,
  EYEBROW,
  TITRE_SECTION,
  pastilleEtat,
  type EtatPastille,
} from "@/lib/ui";
import type { Booking } from "@/generated/prisma";

/**
 * `generateMetadata` et la page ont besoin du même restaurant. Sans `cache`,
 * Next.js exécute les deux fonctions pour une même requête et Prisma part
 * deux fois en base — la mémoïsation de Next ne couvre que `fetch`.
 */
const lireRestaurant = cache((id: string) =>
  prisma.restaurant.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { nom: "asc" } },
      plagesOuverture: true,
      bookings: { include: { user: true }, orderBy: { date: "desc" }, take: 10 },
      journalAudit: { include: { staff: true }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  }),
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurant = await lireRestaurant(id);
  return { title: restaurant?.nom ?? "Restaurant" };
}

/** Même mapping que src/app/espace-restaurant/reservations/page.tsx (STATUT). */
const STATUT_RESERVATION: Record<Booking["statut"], { label: string; etat: EtatPastille }> = {
  CONFIRMEE: { label: "Confirmée", etat: "neutre" },
  ANNULEE: { label: "Annulée", etat: "danger" },
  HONOREE: { label: "Honorée", etat: "succes" },
  NO_SHOW: { label: "No-show", etat: "danger" },
};

/** Libellé affiché pour chaque champ pouvant apparaître dans un diff du journal d'audit. */
const LABEL_CHAMP: Record<string, string> = {
  nom: "Nom",
  ville: "Ville",
  cuisine: "Cuisine",
  adresse: "Adresse",
  horaires: "Horaires",
  description: "Description",
  capacite: "Capacité",
  contact: "Contact",
};

/** Libellé affiché pour chaque action du journal d'audit. */
const LABEL_ACTION_AUDIT: Record<string, string> = {
  CREATION: "Création",
  MODIFICATION: "Modification",
  AJOUT_CONTACT: "Ajout d'un contact",
};

type DiffChamp = { champ: string; avant: unknown; apres: unknown };

function formatterValeur(valeur: unknown) {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  return String(valeur);
}

function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={EYEBROW}>{libelle}</dt>
      <dd className="mt-1 text-[15px] text-[var(--color-ink)]">{children}</dd>
    </div>
  );
}

/**
 * Fiche détail d'un partenaire — infos, contacts, réservations récentes,
 * journal d'audit. La garde d'accès est faite une fois dans le layout parent.
 */
export default async function FicheRestaurantAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerSessionStaff();

  const { id } = await params;

  const restaurant = await lireRestaurant(id);
  if (!restaurant) notFound();

  // Déclarés par le partenaire sur "Mes disponibilités" — la Console staff les
  // lit, elle ne les écrit pas (voir `CHAMPS_SUIVIS` côté actions).
  const horaires = formaterHoraires(restaurant.plagesOuverture);

  return (
    <>
      <Link
        href="/admin/restaurants"
        className="mb-4 inline-block text-sm font-semibold text-[var(--color-staff)] hover:underline"
      >
        ← Tous les restaurants
      </Link>

      <EnteteEspace
        titre={restaurant.nom}
        description={`${restaurant.cuisine} · ${restaurant.ville}`}
        actions={
          <>
            <Link href={`/restaurants/${id}`} className={BOUTON_SECONDAIRE}>
              Fiche publique
            </Link>
            <Link href={`/admin/restaurants/${id}/modifier`} className={BOUTON_SECONDAIRE}>
              Modifier
            </Link>
          </>
        }
      />

      <div className={`${CARTE} flex flex-col gap-5 sm:flex-row`}>
        <span className="relative h-[150px] w-full shrink-0 overflow-hidden rounded-xl sm:w-[220px]">
          <PhotoCouverture
            photo={photoRestaurant(restaurant)}
            alt={restaurant.nom}
            sizes="(max-width: 640px) 100vw, 220px"
          />
        </span>

        <dl className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Info libelle="Adresse">{restaurant.adresse}</Info>
          <Info libelle="Horaires">
            {horaires.length > 0
              ? horaires.map((ligne) => <span key={ligne} className="block">{ligne}</span>)
              : "Non déclarés — tous les créneaux sont proposés"}
          </Info>
          <Info libelle="Capacité">
            {restaurant.capacite ? `${restaurant.capacite} couverts` : "—"}
          </Info>
          <Info libelle="Note">
            <NoteCuilleres
              note={restaurant.noteCuilleres}
              nombreAvis={restaurant.nombreAvis}
              taille="petit"
            />
          </Info>
          <Info libelle="Délai d'annulation">
            {restaurant.delaiAnnulationHeures
              ? `${restaurant.delaiAnnulationHeures} h avant le créneau`
              : "Non défini"}
          </Info>
          {restaurant.description && (
            <div className="sm:col-span-2">
              <dt className={EYEBROW}>Description</dt>
              <dd className="mt-1 text-[15px] leading-relaxed text-[var(--color-ink)]">
                {restaurant.description}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-4`}>Contacts</h2>
        {restaurant.contacts.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Aucun contact enregistré — personne ne peut ouvrir l&apos;espace restaurateur de cet
              établissement.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {restaurant.contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-line-strong)] bg-white px-5 py-3.5"
              >
                <span className="font-semibold text-[var(--color-ink)]">{contact.nom}</span>
                <span className="text-sm text-[var(--color-ink-muted)]">{contact.email}</span>
                <span className={pastilleEtat("neutre")}>{LIBELLE_ROLE_CONTACT[contact.role]}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={`${CARTE} mt-4`}>
          <h3 className={`${EYEBROW} mb-4`}>Ajouter un contact</h3>
          <ContactRestaurantForm action={creerContactRestaurant.bind(null, id)} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-4`}>Réservations récentes</h2>
        {restaurant.bookings.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Aucune réservation pour l&apos;instant.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {restaurant.bookings.map((reservation) => (
              <li
                key={reservation.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-line-strong)] bg-white px-5 py-3.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-ink)]">
                  {reservation.user.name}
                </span>
                <span className="text-[var(--color-ink-muted)]">
                  {reservation.date.toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  à{" "}
                  {reservation.date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-[var(--color-ink-muted)]">
                  {reservation.couverts} couvert{reservation.couverts > 1 ? "s" : ""}
                </span>
                <span className={pastilleEtat(STATUT_RESERVATION[reservation.statut].etat)}>
                  {STATUT_RESERVATION[reservation.statut].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-4`}>Historique des modifications</h2>
        {restaurant.journalAudit.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="text-sm text-[var(--color-ink-muted)]">Aucune modification tracée.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {restaurant.journalAudit.map((entree) => (
              <li
                key={entree.id}
                className="rounded-2xl border border-[var(--color-line-strong)] bg-white px-5 py-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--color-ink)]">
                    {LABEL_ACTION_AUDIT[entree.action] ?? entree.action} par {entree.staff.nom}
                  </span>
                  <span className="text-[var(--color-ink-muted)]">
                    {entree.createdAt.toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    à{" "}
                    {entree.createdAt.toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {Array.isArray(entree.champsModifies) && entree.champsModifies.length > 0 && (
                  <ul className="mt-2.5 flex flex-col gap-1 text-[var(--color-ink-muted)]">
                    {(entree.champsModifies as unknown as DiffChamp[]).map((diff) => (
                      <li key={diff.champ}>
                        <span className="font-medium text-[var(--color-ink)]">
                          {LABEL_CHAMP[diff.champ] ?? diff.champ}
                        </span>{" "}
                        : {formatterValeur(diff.avant)} → {formatterValeur(diff.apres)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

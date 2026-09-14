import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { authAdmin } from "@/lib/auth";
import { BOUTON_SECONDAIRE, CARTE, EYEBROW } from "@/lib/ui";
import { prisma } from "@/lib/prisma";
import type { Booking } from "@/generated/prisma";

/** Même mapping que src/app/espace-restaurant/reservations/page.tsx (STATUT). */
const STATUT_RESERVATION: Record<Booking["statut"], { label: string; classe: string }> = {
  CONFIRMEE: { label: "Confirmée", classe: "text-[var(--color-ink)]" },
  ANNULEE: { label: "Annulée", classe: "text-red-600" },
  HONOREE: { label: "Honorée", classe: "text-green-700" },
  NO_SHOW: { label: "No-show", classe: "text-[var(--color-accent)]" },
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
};

type DiffChamp = { champ: string; avant: unknown; apres: unknown };

function formatterValeur(valeur: unknown) {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  return String(valeur);
}

/**
 * Fiche détail d'un partenaire — infos, contacts, réservations récentes.
 * Pas de section factures : l'epic Facturation & commission n'existe pas
 * encore, l'afficher aurait été fictif (même logique que "Fiche
 * établissement" côté dîneur, qui n'affiche pas de filtre "dispo").
 */
export default async function FicheRestaurantAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [session, restaurant] = await Promise.all([
    authAdmin.api.getSession({ headers: await headers() }),
    prisma.restaurant.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { nom: "asc" } },
        bookings: {
          include: { user: true },
          orderBy: { date: "desc" },
          take: 10,
        },
        journalAudit: {
          include: { staff: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    }),
  ]);
  if (!session) redirect("/connexion-admin");
  if (!restaurant) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-[var(--color-ink-muted)] hover:underline">
          ← Retour à la console
        </Link>
        <Link href={`/admin/restaurants/${id}/modifier`} className={BOUTON_SECONDAIRE}>
          Modifier
        </Link>
      </div>

      <h1 className="mt-6 font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-ink)]">
        {restaurant.nom}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        {restaurant.cuisine} · {restaurant.ville}
      </p>

      <dl className={`mt-6 grid grid-cols-2 gap-4 text-sm ${CARTE}`}>
        <div>
          <dt className={EYEBROW}>ADRESSE</dt>
          <dd className="mt-0.5 text-[var(--color-ink)]">{restaurant.adresse}</dd>
        </div>
        <div>
          <dt className={EYEBROW}>HORAIRES</dt>
          <dd className="mt-0.5 text-[var(--color-ink)]">{restaurant.horaires ?? "—"}</dd>
        </div>
        <div>
          <dt className={EYEBROW}>CAPACITÉ</dt>
          <dd className="mt-0.5 text-[var(--color-ink)]">
            {restaurant.capacite ? `${restaurant.capacite} couverts` : "—"}
          </dd>
        </div>
        <div>
          <dt className={EYEBROW}>NOTE</dt>
          <dd className="mt-0.5 text-[var(--color-ink)]">
            {restaurant.noteCuilleres
              ? `${restaurant.noteCuilleres.toFixed(1)} 🥄 (${restaurant.nombreAvis} avis)`
              : "Pas encore d'avis"}
          </dd>
        </div>
        {restaurant.description && (
          <div className="col-span-2">
            <dt className={EYEBROW}>DESCRIPTION</dt>
            <dd className="mt-0.5 text-[var(--color-ink)]">{restaurant.description}</dd>
          </div>
        )}
      </dl>

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
          Contacts
        </h2>
        {restaurant.contacts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucun contact enregistré.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {restaurant.contacts.map((contact) => (
              <li
                key={contact.id}
                className={`flex items-center justify-between p-4 text-sm ${CARTE}`}
              >
                <span className="font-semibold text-[var(--color-ink)]">{contact.nom}</span>
                <span className="text-[var(--color-ink-muted)]">{contact.email}</span>
                <span className="text-[var(--color-ink-muted)]">
                  {contact.role === "GERANT" ? "Gérant" : "Chef de salle"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
          Réservations récentes
        </h2>
        {restaurant.bookings.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucune réservation pour l&apos;instant.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {restaurant.bookings.map((reservation) => (
              <li
                key={reservation.id}
                className={`flex items-center justify-between p-4 text-sm ${CARTE}`}
              >
                <span className="font-semibold text-[var(--color-ink)]">{reservation.user.name}</span>
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
                <span className={`font-semibold ${STATUT_RESERVATION[reservation.statut].classe}`}>
                  {STATUT_RESERVATION[reservation.statut].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
          Historique des modifications
        </h2>
        {restaurant.journalAudit.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Aucune modification tracée.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {restaurant.journalAudit.map((entree) => (
              <li key={entree.id} className={`p-4 text-sm ${CARTE}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-ink)]">
                    {entree.action === "CREATION" ? "Création" : "Modification"} par{" "}
                    {entree.staff.nom}
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
                  <ul className="mt-2 flex flex-col gap-1 text-[var(--color-ink-muted)]">
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
          </ul>
        )}
      </section>
    </main>
  );
}

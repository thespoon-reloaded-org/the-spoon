import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { IconeChevron, IconeFleche } from "@/components/Icones";
import { NoteCuilleres } from "@/components/NoteCuilleres";
import { authRestaurant } from "@/lib/auth";
import { formaterMoisFacture, formaterMontant } from "@/lib/facturation";
import { prisma } from "@/lib/prisma";
import { CARTE, CARTE_CLIQUABLE, ETAT_VIDE, TITRE_SECTION, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

/** Bornes du jour courant, en heure locale — la journée de service, pas 24 h glissantes. */
function bornesDuJour(maintenant: Date) {
  const debut = new Date(maintenant);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 1);
  return { debut, fin };
}

function Indicateur({
  libelle,
  valeur,
  precision,
  href,
}: {
  libelle: string;
  valeur: React.ReactNode;
  precision?: string;
  href?: string;
}) {
  const contenu = (
    <>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        {libelle}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-none tracking-tight text-[var(--color-ink)]">
        {valeur}
      </p>
      {precision && <p className="mt-1.5 text-sm text-[var(--color-ink-muted)]">{precision}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARTE_CLIQUABLE}>
        {contenu}
      </Link>
    );
  }
  return <div className={CARTE}>{contenu}</div>;
}

/**
 * Point d'entrée de l'espace restaurant.
 *
 * `/espace-restaurant` renvoyait jusqu'ici directement sur l'onglet
 * « Réservations reçues ». Avec un menu latéral, la première entrée doit dire
 * ce qui se passe aujourd'hui — sinon le restaurateur doit ouvrir quatre
 * écrans pour savoir combien de couverts il sert ce soir. Rien de nouveau
 * n'est calculé ici : c'est une lecture des données que les autres écrans
 * affichent déjà en détail.
 */
export default async function TableauDeBordPage() {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return null; // garde déjà faite par le layout, satisfait TypeScript

  const restaurantId = session.user.restaurantId;
  const maintenant = new Date();
  const { debut, fin } = bornesDuJour(maintenant);

  const [restaurant, reservationsDuJour, prochaines, aSignaler, nombrePlats, derniereFacture] =
    await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { nom: true, noteCuilleres: true, nombreAvis: true, capacite: true },
      }),
      prisma.booking.findMany({
        where: { restaurantId, statut: "CONFIRMEE", date: { gte: debut, lt: fin } },
        include: { user: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.booking.count({
        where: { restaurantId, statut: "CONFIRMEE", date: { gte: fin } },
      }),
      prisma.booking.count({
        where: { restaurantId, statut: "CONFIRMEE", date: { lt: maintenant } },
      }),
      prisma.platCuillere.count({ where: { restaurantId } }),
      prisma.facture.findFirst({
        where: { restaurantId },
        orderBy: { mois: "desc" },
        select: { id: true, mois: true, montantTotalCentimes: true },
      }),
    ]);

  const couvertsDuJour = reservationsDuJour.reduce((total, r) => total + r.couverts, 0);

  return (
    <>
      <EnteteEspace
        titre={`Bonjour ${session.user.name.split(" ")[0]}`}
        description="Votre service du jour et l'état de vos réservations, en un coup d'œil."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicateur
          libelle="Couverts aujourd'hui"
          valeur={couvertsDuJour}
          precision={
            restaurant?.capacite
              ? `sur ${restaurant.capacite} places`
              : `${reservationsDuJour.length} réservation${reservationsDuJour.length > 1 ? "s" : ""}`
          }
          href="/espace-restaurant/reservations"
        />
        <Indicateur
          libelle="À venir"
          valeur={prochaines}
          precision="réservations confirmées"
          href="/espace-restaurant/reservations"
        />
        <Indicateur
          libelle="À signaler"
          valeur={aSignaler}
          precision={
            aSignaler > 0 ? "créneaux passés non pointés" : "tout est à jour, bravo"
          }
          href="/espace-restaurant/reservations"
        />
        <Indicateur
          libelle="Note en cuillères"
          valeur={
            <NoteCuilleres
              note={restaurant?.noteCuilleres ?? null}
              nombreAvis={restaurant?.nombreAvis ?? 0}
              taille="grand"
            />
          }
          precision={`${nombrePlats} plat${nombrePlats > 1 ? "s" : ""} sur la carte`}
          href="/espace-restaurant/menu"
        />
      </div>

      {aSignaler > 0 && (
        <Link
          href="/espace-restaurant/reservations"
          className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-warning)]/25 bg-[var(--color-warning-tint)] px-5 py-4 transition-colors hover:border-[var(--color-warning)]/50"
        >
          <span className="text-sm text-[var(--color-warning)]">
            <strong className="font-semibold">
              {aSignaler} réservation{aSignaler > 1 ? "s" : ""} passée{aSignaler > 1 ? "s" : ""}
            </strong>{" "}
            {aSignaler > 1 ? "attendent" : "attend"} d&apos;être pointée
            {aSignaler > 1 ? "s" : ""} honorée ou no-show — c&apos;est ce geste qui alimente la
            facturation.
          </span>
          <span className="shrink-0 text-[var(--color-warning)]">
            <IconeFleche taille={18} />
          </span>
        </Link>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className={TITRE_SECTION}>Le service du jour</h2>
          <Link
            href="/espace-restaurant/reservations"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-pro)] hover:underline"
          >
            Toutes les réservations
            <IconeChevron taille={15} />
          </Link>
        </div>

        {reservationsDuJour.length === 0 ? (
          <div className={ETAT_VIDE}>
            <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
              Aucune réservation aujourd&apos;hui
            </p>
            <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
              Vérifiez que vos créneaux sont bien ouverts dans « Disponibilités ».
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {reservationsDuJour.map((reservation) => (
              <li
                key={reservation.id}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-line-strong)] bg-white px-5 py-3.5"
              >
                <span className="w-14 shrink-0 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                  {reservation.date.toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-[var(--color-ink)]">
                  {reservation.user.name}
                </span>
                <span className={pastilleEtat("neutre")}>
                  {reservation.couverts} couvert{reservation.couverts > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {derniereFacture && (
        <section className="mt-10">
          <h2 className={`${TITRE_SECTION} mb-4`}>Dernière facture</h2>
          <Link
            href={`/espace-restaurant/factures/${derniereFacture.id}`}
            className={`${CARTE_CLIQUABLE} flex items-center justify-between gap-4`}
          >
            <span>
              <span className="block font-semibold capitalize text-[var(--color-ink)]">
                {formaterMoisFacture(derniereFacture.mois)}
              </span>
              <span className="text-sm text-[var(--color-ink-muted)]">
                Commission TheSpoon sur les couverts servis
              </span>
            </span>
            <span className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
              {formaterMontant(derniereFacture.montantTotalCentimes)}
            </span>
          </Link>
        </section>
      )}
    </>
  );
}

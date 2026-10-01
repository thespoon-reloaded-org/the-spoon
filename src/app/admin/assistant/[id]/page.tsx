import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EnteteEspace } from "@/components/EnteteEspace";
import { VerdictProposition } from "@/components/VerdictProposition";
import { formaterJourEtHeure } from "@/lib/fuseau";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { prisma } from "@/lib/prisma";
import { CARTE, PASTILLE, TITRE_SECTION } from "@/lib/ui";

export const metadata: Metadata = { title: "Proposition de l'assistant" };

type RestaurantLu = {
  id: string;
  nom: string;
  ville: string;
  cuisine: string;
  noteCuilleres: number | null;
  nombreAvis: number;
};

function LigneRestaurant({ restaurant, rang }: { restaurant: RestaurantLu; rang?: number }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {rang !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-staff)] text-xs font-bold text-white">
            {rang}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold text-[var(--color-ink)]">{restaurant.nom}</p>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {restaurant.cuisine} · {restaurant.ville} ·{" "}
            {restaurant.noteCuilleres !== null
              ? `${restaurant.noteCuilleres.toFixed(1)} (${restaurant.nombreAvis} avis)`
              : "pas encore d'avis"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-4 text-sm font-semibold">
        <Link
          href={`/admin/restaurants/${restaurant.id}`}
          className="text-[var(--color-staff)] hover:underline"
        >
          Fiche admin
        </Link>
        <Link
          href={`/restaurants/${restaurant.id}`}
          target="_blank"
          className="text-[var(--color-ink-soft)] hover:underline"
        >
          Page publique ↗
        </Link>
      </div>
    </li>
  );
}

/**
 * Une proposition de l'assistant, en détail : ce que le dîneur demandait, ce
 * que l'assistant a répondu, son verdict, et la liste des restaurants
 * recommandés dans l'ordre du classement. Les restaurants éligibles mais
 * écartés (voir `PropositionAssistant.candidatIds`) disent ce que
 * l'assistant aurait pu proposer à la place.
 */
export default async function PropositionAssistantAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerSessionStaff();
  const { id } = await params;

  const proposition = await prisma.propositionAssistant.findUnique({ where: { id } });
  if (!proposition) notFound();

  const ecartesIds = proposition.candidatIds.filter(
    (candidat) => !proposition.restaurantIds.includes(candidat),
  );
  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: [...proposition.restaurantIds, ...ecartesIds] } },
    select: {
      id: true,
      nom: true,
      ville: true,
      cuisine: true,
      noteCuilleres: true,
      nombreAvis: true,
    },
  });
  const parId = new Map(restaurants.map((r) => [r.id, r]));
  // Un restaurant supprimé depuis n'a plus de fiche : on le compte sans l'afficher.
  const recommandes = proposition.restaurantIds.flatMap((rid) => parId.get(rid) ?? []);
  const supprimes = proposition.restaurantIds.length - recommandes.length;
  const ecartes = ecartesIds.flatMap((rid) => parId.get(rid) ?? []);

  return (
    <>
      <Link
        href="/admin/assistant"
        className="text-sm font-semibold text-[var(--color-ink-soft)] hover:underline"
      >
        ← Assistant de recherche
      </Link>

      <div className="mt-4">
        <EnteteEspace
          titre="Proposition de l'assistant"
          description={`Servie le ${formaterJourEtHeure(proposition.createdAt)}.`}
          actions={<VerdictProposition verdict={proposition.verdict} />}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className={CARTE}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Demande du dîneur
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[var(--color-ink)]">{proposition.demande}</p>
        </section>
        <section className={CARTE}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
            Réponse de l&apos;assistant
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[var(--color-ink-soft)]">
            {proposition.message}
          </p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className={`${TITRE_SECTION} mb-3`}>
          Restaurants recommandés{" "}
          <span className={PASTILLE}>{proposition.restaurantIds.length}</span>
        </h2>
        <ol className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line-strong)] bg-white">
          {recommandes.map((r, i) => (
            <LigneRestaurant key={r.id} restaurant={r} rang={i + 1} />
          ))}
        </ol>
        {supprimes > 0 && (
          <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
            {supprimes} restaurant{supprimes > 1 ? "s" : ""} recommandé{supprimes > 1 ? "s" : ""}{" "}
            depuis supprimé{supprimes > 1 ? "s" : ""} du catalogue.
          </p>
        )}
      </section>

      {ecartes.length > 0 && (
        <section className="mt-8">
          <h2 className={`${TITRE_SECTION} mb-1`}>
            Éligibles non proposés <span className={PASTILLE}>{ecartes.length}</span>
          </h2>
          <p className="mb-3 text-sm text-[var(--color-ink-muted)]">
            Renvoyés par les recherches de l&apos;assistant, mais écartés de son classement.
          </p>
          <ul className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line-strong)] bg-white">
            {ecartes.map((r) => (
              <LigneRestaurant key={r.id} restaurant={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

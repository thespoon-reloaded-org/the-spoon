import type { Metadata } from "next";
import Link from "next/link";

import { EnteteEspace } from "@/components/EnteteEspace";
import { VerdictProposition } from "@/components/VerdictProposition";
import type { Prisma } from "@/generated/prisma";
import { formaterJourEtHeure } from "@/lib/fuseau";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { prisma } from "@/lib/prisma";
import { CARTE, ETAT_VIDE } from "@/lib/ui";

export const metadata: Metadata = { title: "Assistant de recherche" };

/** Au-delà, la page deviendrait illisible : les plus récentes suffisent à suivre l'usage. */
const LIGNES_MAX = 200;

const FILTRES = [
  { valeur: undefined, label: "Toutes" },
  { valeur: "aimee", label: "Aimées" },
  { valeur: "pas-aimee", label: "Pas aimées" },
  { valeur: "sans-avis", label: "Sans avis" },
] as const;

type Filtre = (typeof FILTRES)[number]["valeur"];

function filtreDepuis(brut: string | undefined): Filtre {
  return FILTRES.find((f) => f.valeur === brut)?.valeur;
}

function conditionFiltre(filtre: Filtre): Prisma.PropositionAssistantWhereInput {
  if (filtre === "aimee") return { verdict: "AIME" };
  if (filtre === "pas-aimee") return { verdict: "AIME_PAS" };
  if (filtre === "sans-avis") return { verdict: null };
  return {};
}

function pourcentage(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)} %`;
}

function Indicateur({
  libelle,
  valeur,
  detail,
}: {
  libelle: string;
  valeur: string;
  detail?: string;
}) {
  return (
    <div className={CARTE}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        {libelle}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--color-ink)]">
        {valeur}
      </p>
      {detail && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{detail}</p>}
    </div>
  );
}

/**
 * Les propositions servies par l'assistant de recherche de l'accueil et le
 * verdict des dîneurs dessus (cœur plein / cœur brisé, voir
 * `PropositionAssistant`). De quoi suivre ce que l'assistant recommande et
 * ce qu'en pensent les dîneurs, avant d'y toucher — le détail de chaque
 * proposition donne la liste des restaurants recommandés.
 */
export default async function AssistantAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ avis?: string }>;
}) {
  await exigerSessionStaff();
  const filtre = filtreDepuis((await searchParams).avis);

  const [propositions, parVerdict] = await Promise.all([
    prisma.propositionAssistant.findMany({
      where: conditionFiltre(filtre),
      orderBy: { createdAt: "desc" },
      take: LIGNES_MAX,
      select: {
        id: true,
        createdAt: true,
        demande: true,
        verdict: true,
        restaurantIds: true,
        candidatIds: true,
      },
    }),
    prisma.propositionAssistant.groupBy({ by: ["verdict"], _count: true }),
  ]);

  const compte = (v: "AIME" | "AIME_PAS" | null) =>
    parVerdict.find((ligne) => ligne.verdict === v)?._count ?? 0;
  const aimees = compte("AIME");
  const pasAimees = compte("AIME_PAS");
  const votes = aimees + pasAimees;
  const total = votes + compte(null);

  return (
    <>
      <EnteteEspace
        titre="Assistant de recherche"
        description="Les recommandations servies par le chat de l'accueil et l'avis des dîneurs dessus, de la plus récente à la plus ancienne."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Indicateur libelle="Propositions servies" valeur={String(total)} />
        <Indicateur
          libelle="Taux de vote"
          valeur={pourcentage(votes, total)}
          detail={`${votes} vote${votes > 1 ? "s" : ""}`}
        />
        <Indicateur
          libelle="Cœurs pleins"
          valeur={pourcentage(aimees, votes)}
          detail={`${aimees} aimée${aimees > 1 ? "s" : ""} · ${pasAimees} pas aimée${pasAimees > 1 ? "s" : ""}`}
        />
      </div>

      <nav aria-label="Filtrer par avis" className="mb-4 flex flex-wrap gap-2">
        {FILTRES.map((f) => {
          const actif = f.valeur === filtre;
          return (
            <Link
              key={f.label}
              href={f.valeur ? `/admin/assistant?avis=${f.valeur}` : "/admin/assistant"}
              aria-current={actif ? "page" : undefined}
              className={
                actif
                  ? "rounded-full bg-[var(--color-staff)] px-4 py-1.5 text-sm font-semibold text-white"
                  : "rounded-full border-[1.5px] border-[var(--color-line-strong)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-staff)]"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {propositions.length === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Aucune proposition {filtre ? "pour ce filtre" : "pour le moment"}
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            Chaque top 10 servi par le chat de l&apos;accueil apparaîtra ici, avec l&apos;avis du
            dîneur s&apos;il en donne un.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-line-strong)] bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--color-line-strong)] bg-[var(--color-staff-tint)] text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Date
                </th>
                <th scope="col" className="px-4 py-3">
                  Demande du dîneur
                </th>
                <th scope="col" className="px-4 py-3">
                  Avis
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Recos
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Détail</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {propositions.map((p) => (
                <tr key={p.id} className="align-top hover:bg-[var(--color-page)]">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-ink-muted)]">
                    {formaterJourEtHeure(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink)]">
                    <span className="line-clamp-2">{p.demande}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <VerdictProposition verdict={p.verdict} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--color-ink)]">
                    {p.restaurantIds.length}
                    {/* Les éligibles ne sont gardés que depuis la mesure des biais. */}
                    {p.candidatIds.length > 0 && (
                      <span className="text-[var(--color-ink-muted)]">
                        {" "}
                        / {p.candidatIds.length} éligibles
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/admin/assistant/${p.id}`}
                      className="font-semibold text-[var(--color-staff)] hover:underline"
                    >
                      Voir les recos →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {propositions.length === LIGNES_MAX && (
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          Les {LIGNES_MAX} plus récentes seulement.
        </p>
      )}
    </>
  );
}

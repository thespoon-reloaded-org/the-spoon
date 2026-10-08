import type { Metadata } from "next";

import { BasculerFonctionnaliteForm } from "@/components/BasculerFonctionnaliteForm";
import { EnteteEspace } from "@/components/EnteteEspace";
import { JournalConsoleFormateur } from "@/components/JournalConsoleFormateur";
import type { CleFonctionnalite } from "@/generated/prisma";
import { assistantDisponible } from "@/lib/chatbot/agent";
import { lireFonctionnalites } from "@/lib/fonctionnalites";
import { formaterJourEtHeure } from "@/lib/fuseau";
import { exigerSessionFormateur } from "@/lib/garde-formateur";
import { prisma } from "@/lib/prisma";
import { CARTE, ETAT_VIDE, TITRE_SECTION, pastilleEtat } from "@/lib/ui";

export const metadata: Metadata = { title: "Fonctionnalités" };

/**
 * Couper et rallumer des fonctionnalités, pour tout TheSpoon — la base est
 * partagée entre la production et les Deploy Previews.
 */
export default async function FonctionnalitesPage() {
  await exigerSessionFormateur();

  const [fonctionnalites, journal] = await Promise.all([
    lireFonctionnalites(),
    prisma.journalFormateur.findMany({
      where: { fonctionnalite: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, resume: true, createdAt: true, formateur: { select: { nom: true } } },
    }),
  ]);

  // Ce qui rend une fonctionnalité absente quel que soit son interrupteur :
  // le dire évite de chercher pourquoi la rallumer ne la fait pas revenir.
  const absenteMalgreTout: Partial<Record<CleFonctionnalite, string>> = {
    ASSISTANT_RECHERCHE: assistantDisponible()
      ? undefined
      : "Aucune clé d'API n'est configurée sur cet environnement : l'assistant reste absent, même allumé.",
  };

  return (
    <>
      <EnteteEspace
        titre="Fonctionnalités"
        description="Coupez une fonctionnalité le temps d'un exercice. La base est partagée : elle est coupée pour tout TheSpoon, production comprise, jusqu'à ce qu'un formateur la rallume."
      />

      <ul className="flex flex-col gap-4">
        {fonctionnalites.map((f) => (
          <li key={f.cle} className={CARTE}>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 max-w-xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className={TITRE_SECTION}>{f.libelle}</h2>
                  <span className={pastilleEtat(f.active ? "succes" : "danger")}>
                    {f.active ? "Active" : "Coupée"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
                  {f.description}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  <strong className="font-semibold text-[var(--color-ink-soft)]">
                    Une fois coupée :
                  </strong>{" "}
                  {f.quandCoupee}
                </p>
                {absenteMalgreTout[f.cle] && (
                  <p className="mt-3 rounded-xl bg-[var(--color-warning-tint)] px-3.5 py-2.5 text-sm text-[var(--color-warning)]">
                    {absenteMalgreTout[f.cle]}
                  </p>
                )}
                {f.modifiee && (
                  <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
                    {f.active ? "Rallumée" : "Coupée"} par {f.modifiee.par} le{" "}
                    {formaterJourEtHeure(f.modifiee.le)}
                  </p>
                )}
              </div>
              <BasculerFonctionnaliteForm cle={f.cle} active={f.active} />
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-5`}>Journal</h2>
        {journal.length > 0 ? (
          <JournalConsoleFormateur lignes={journal} />
        ) : (
          <div className={ETAT_VIDE}>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Aucune fonctionnalité n&apos;a encore été coupée.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

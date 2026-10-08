import type { Metadata } from "next";

import { DeclencherEvenementForm } from "@/components/DeclencherEvenementForm";
import { EnteteEspace } from "@/components/EnteteEspace";
import { JournalConsoleFormateur } from "@/components/JournalConsoleFormateur";
import type { EvenementFormation } from "@/generated/prisma";
import { EVENEMENTS } from "@/lib/evenements-formation";
import { exigerSessionFormateur } from "@/lib/garde-formateur";
import { prisma } from "@/lib/prisma";
import { CARTE, ETAT_VIDE, TITRE_SECTION } from "@/lib/ui";

export const metadata: Metadata = { title: "Événements" };

/**
 * Faire arriver des demandes, des réservations, des avis et des
 * contestations pendant une session — dans la vraie base, datés de
 * maintenant (voir src/lib/evenements-formation.ts).
 */
export default async function EvenementsPage() {
  await exigerSessionFormateur();

  const [restaurants, journal] = await Promise.all([
    prisma.restaurant.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, ville: true },
    }),
    prisma.journalFormateur.findMany({
      where: { evenement: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, resume: true, createdAt: true, formateur: { select: { nom: true } } },
    }),
  ]);

  return (
    <>
      <EnteteEspace
        titre="Événements"
        description="Faites arriver ce qui arrive à TheSpoon, par lots. Tout s'écrit dans la vraie base, daté de maintenant, et y reste — exactement comme si des dîneurs et des restaurateurs l'avaient fait."
      />

      <ul className="grid gap-4 md:grid-cols-2">
        {(Object.keys(EVENEMENTS) as EvenementFormation[]).map((cle) => {
          const evenement = EVENEMENTS[cle];
          return (
            <li key={cle} className={`${CARTE} flex flex-col gap-4`}>
              <div>
                <h2 className={TITRE_SECTION}>{evenement.libelle}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {evenement.description}
                </p>
              </div>
              <DeclencherEvenementForm
                evenement={cle}
                quantiteMax={evenement.quantiteMax}
                restaurants={evenement.parRestaurant ? restaurants : undefined}
                avecNote={cle === "AVIS"}
              />
            </li>
          );
        })}
      </ul>

      <section className="mt-10">
        <h2 className={`${TITRE_SECTION} mb-5`}>Journal</h2>
        {journal.length > 0 ? (
          <JournalConsoleFormateur lignes={journal} />
        ) : (
          <div className={ETAT_VIDE}>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Aucun événement déclenché pour l&apos;instant.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

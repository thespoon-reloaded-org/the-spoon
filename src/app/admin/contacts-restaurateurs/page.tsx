import type { Metadata } from "next";
import Link from "next/link";

import type { StatutDemande } from "@/generated/prisma";
import { EnteteEspace } from "@/components/EnteteEspace";
import { exigerSessionStaff } from "@/lib/garde-staff";
import { formaterAnciennete } from "@/lib/contestation";
import { prisma } from "@/lib/prisma";
import { CRITERES, type Criteres, LIBELLES_CRITERES } from "@/lib/qualification";
import { EYEBROW, ETAT_VIDE, type EtatPastille, pastilleEtat } from "@/lib/ui";

import { BrouillonMail } from "./BrouillonMail";

export const metadata: Metadata = { title: "Demandes restaurateurs" };

/**
 * Les demandes de contact déposées par des restaurateurs pas encore
 * partenaires — depuis la landing ou l'écran de connexion restaurant (voir
 * `/devenir-partenaire`), du plus récent au plus ancien. Chacune porte le
 * verdict de l'agent de qualification (`pnpm agent:qualifier`) et un
 * brouillon de mail que le staff relit puis envoie de sa messagerie.
 *
 * La garde d'accès est faite une fois dans le layout parent.
 */
const STATUTS: Record<StatutDemande, { libelle: string; etat: EtatPastille }> = {
  A_ANALYSER: { libelle: "À analyser", etat: "neutre" },
  ACCEPTEE: { libelle: "Acceptée", etat: "succes" },
  INFOS_MANQUANTES: { libelle: "Infos manquantes", etat: "attention" },
  REFUSEE: { libelle: "Refusée", etat: "danger" },
  MAIL_ENVOYE: { libelle: "Mail envoyé", etat: "marque" },
};

const VERDICTS: Record<Criteres[keyof Criteres]["verdict"], EtatPastille> = {
  OK: "succes",
  KO: "danger",
  INCONNU: "attention",
};

/** Par défaut, tout ce qui n'a pas encore reçu de réponse. */
const FILTRES = [
  { valeur: undefined, libelle: "À traiter" },
  ...(Object.keys(STATUTS) as StatutDemande[]).map((s) => ({
    valeur: s,
    libelle: STATUTS[s].libelle,
  })),
  { valeur: "toutes", libelle: "Toutes" },
];

export default async function ContactsRestaurateursAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  await exigerSessionStaff();

  const { statut } = await searchParams;
  const filtre = statut && statut in STATUTS ? (statut as StatutDemande) : undefined;
  const demandes = await prisma.demandeContactRestaurateur.findMany({
    where:
      statut === "toutes"
        ? undefined
        : filtre
          ? { statut: filtre }
          : { statut: { not: "MAIL_ENVOYE" } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <EnteteEspace
        titre="Demandes restaurateurs"
        description="Les prises de contact de restaurateurs pas encore référencés, du plus récent au plus ancien."
      />

      <nav className="mb-6 flex flex-wrap gap-2">
        {FILTRES.map(({ valeur, libelle }) => {
          const actif = valeur === (statut === "toutes" ? "toutes" : filtre);
          return (
            <Link
              key={libelle}
              href={valeur ? `?statut=${valeur}` : "?"}
              className={pastilleEtat(actif ? "marque" : "neutre")}
            >
              {libelle}
            </Link>
          );
        })}
      </nav>

      {demandes.length === 0 ? (
        <div className={ETAT_VIDE}>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
            Aucune demande pour le moment
          </p>
          <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">
            Les demandes déposées depuis la landing ou l&apos;écran de connexion restaurant
            apparaîtront ici.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {demandes.map((demande) => (
            <li
              key={demande.id}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--color-line-strong)] bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                    {demande.etablissement}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                    {demande.nom} ·{" "}
                    <a href={`mailto:${demande.email}`} className="underline">
                      {demande.email}
                    </a>
                  </p>
                  {demande.adresse && (
                    <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
                      {demande.adresse}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={pastilleEtat(STATUTS[demande.statut].etat)}>
                    {STATUTS[demande.statut].libelle}
                  </span>
                  <span className="text-sm text-[var(--color-ink-muted)]">
                    {formaterAnciennete(demande.createdAt)}
                  </span>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-[var(--color-ink-soft)]">
                {demande.message}
              </p>
              {demande.analyse ? (
                <details className="border-t border-[var(--color-line)] pt-3">
                  <summary className={`${EYEBROW} cursor-pointer`}>Analyse et brouillon</summary>
                  <ul className="mt-3 flex flex-col gap-2">
                    {CRITERES.map((c) => {
                      const jugement = (demande.analyse as Criteres)[c];
                      return (
                        <li key={c} className="text-sm text-[var(--color-ink-soft)]">
                          <span className={`${pastilleEtat(VERDICTS[jugement.verdict])} mr-2`}>
                            {jugement.verdict}
                          </span>
                          <strong>{LIBELLES_CRITERES[c]}</strong> — {jugement.justification}
                          {jugement.sources.map((url, i) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1 underline"
                            >
                              [{i + 1}]
                            </a>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4">
                    <BrouillonMail
                      id={demande.id}
                      email={demande.email}
                      objet={demande.brouillonObjet ?? ""}
                      corps={demande.brouillonCorps ?? ""}
                      envoye={demande.statut === "MAIL_ENVOYE"}
                    />
                  </div>
                </details>
              ) : (
                <p className={EYEBROW}>En attente d&apos;analyse</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

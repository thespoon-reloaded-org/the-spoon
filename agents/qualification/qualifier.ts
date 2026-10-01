/**
 * Boucle de l'agent de qualification, sans dépendance directe au SDK ni au
 * réseau : `index.ts` branche le vrai Claude Agent SDK et l'API admin, les
 * tests branchent des doublures.
 */
import { type AnalyseDemande, schemaAnalyseDemande } from "../../src/lib/qualification";

export type Demande = {
  id: string;
  nom: string;
  email: string;
  etablissement: string;
  adresse: string | null;
  message: string;
};

export type Dependances = {
  listerAAnalyser: () => Promise<Demande[]>;
  /** Sortie brute de l'agent pour une demande — validée ici, pas par lui. */
  analyser: (demande: Demande) => Promise<unknown>;
  enregistrer: (id: string, analyse: AnalyseDemande) => Promise<void>;
  journal?: (ligne: string) => void;
};

/** Les champs de la demande, balisés comme données et non comme consignes. */
export function messageDemande(d: Demande): string {
  const champ = (nom: string, valeur: string | null) =>
    `<${nom}>${(valeur ?? "(non renseigné)").replaceAll("<", "‹")}</${nom}>`;
  return [
    "Qualifie cette demande de référencement.",
    "<demande>",
    champ("etablissement", d.etablissement),
    champ("adresse", d.adresse),
    champ("contact", d.nom),
    champ("message", d.message),
    "</demande>",
  ].join("\n");
}

/** Une demande en échec n'arrête pas les autres ; elle reste à analyser. */
export async function qualifierDemandes(deps: Dependances) {
  const journal = deps.journal ?? console.log;
  const demandes = await deps.listerAAnalyser();
  let analysees = 0;
  let erreurs = 0;
  for (const demande of demandes) {
    try {
      const resultat = schemaAnalyseDemande.safeParse(await deps.analyser(demande));
      if (!resultat.success) throw new Error(`sortie invalide : ${resultat.error.message}`);
      await deps.enregistrer(demande.id, resultat.data);
      analysees++;
      journal(`✓ ${demande.etablissement}`);
    } catch (erreur) {
      erreurs++;
      journal(`✗ ${demande.etablissement} : ${erreur instanceof Error ? erreur.message : erreur}`);
    }
  }
  journal(`${analysees} analysée(s), ${erreurs} erreur(s).`);
  return { analysees, erreurs };
}

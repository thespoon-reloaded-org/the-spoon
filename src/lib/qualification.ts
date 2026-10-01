/**
 * Qualification des demandes de référencement (« Devenir partenaire ») :
 * les cinq critères jugés par l'agent (`agents/qualification/`), et la règle
 * qui en déduit le statut. La règle est ici, dans le code, et pas laissée au
 * modèle : le texte d'une demande est une saisie libre, l'agent peut se
 * tromper ou être manipulé, le statut reste prévisible.
 */
import { z } from "zod";

/** Phase 1 : Paris intra-muros. Codes postaux, à étendre ici seulement. */
export const ZONES_CIBLES = [
  ...Array.from({ length: 20 }, (_, i) => `750${String(i + 1).padStart(2, "0")}`),
  "75116",
];

/** Adresse du support, proposée au restaurateur quand il manque des infos. */
export const SUPPORT_EMAIL = "support@thespoon.com";

/** Page de l'étape 2 (menu, photos, accessibilité…) — spec à venir. */
export const ETAPE_2_URL = "https://thespoon.com/devenir-partenaire/etape-2";

export const CRITERES = ["existence", "localisation", "reputation", "menu", "capacite"] as const;
export type Critere = (typeof CRITERES)[number];

export const LIBELLES_CRITERES: Record<Critere, string> = {
  existence: "Existence",
  localisation: "Localisation",
  reputation: "Avis et réputation",
  menu: "Menu à la cuillère",
  capacite: "Capacité d'accueil",
};

const schemaCritere = z.object({
  verdict: z.enum(["OK", "KO", "INCONNU"]),
  justification: z.string().trim().min(1).max(600),
  sources: z.array(z.string().url().max(500)).max(10).default([]),
});
export type JugementCritere = z.infer<typeof schemaCritere>;

/** Ce que l'agent renvoie pour une demande. Pas de statut : il est calculé. */
export const schemaAnalyseDemande = z
  .object({
    criteres: z.object({
      existence: schemaCritere,
      localisation: schemaCritere,
      reputation: schemaCritere,
      menu: schemaCritere,
      capacite: schemaCritere,
    }),
    brouillonObjet: z.string().trim().min(1).max(200),
    brouillonCorps: z.string().trim().min(1).max(5000),
  })
  .strip();
export type AnalyseDemande = z.infer<typeof schemaAnalyseDemande>;
export type Criteres = AnalyseDemande["criteres"];

export type StatutQualifie = "ACCEPTEE" | "INFOS_MANQUANTES" | "REFUSEE";

/** Code postal trouvé dans l'adresse, ou `null` si elle n'en a pas. */
export function codePostal(adresse: string): string | null {
  return adresse.match(/\b\d{5}\b/)?.[0] ?? null;
}

/**
 * Double vérification de la localisation : si l'adresse porte un code postal
 * hors zone, le critère est `KO` quoi qu'en dise l'agent.
 */
export function verifierLocalisation(criteres: Criteres, adresse: string | null): Criteres {
  const cp = adresse ? codePostal(adresse) : null;
  if (!cp || ZONES_CIBLES.includes(cp)) return criteres;
  return {
    ...criteres,
    localisation: {
      verdict: "KO",
      justification: `Code postal ${cp} hors des zones cibles (Paris).`,
      sources: criteres.localisation.sources,
    },
  };
}

/**
 * Un `KO` éliminatoire (existence, localisation, menu, capacité) refuse ; à
 * défaut, un critère `INCONNU` demande plus d'infos ; sinon la demande est
 * acceptée. La réputation seule ne refuse pas : un `KO` dessus reste à
 * l'appréciation du staff, qui relit chaque brouillon.
 */
export function deciderStatut(criteres: Criteres): StatutQualifie {
  const eliminatoires: Critere[] = ["existence", "localisation", "menu", "capacite"];
  if (eliminatoires.some((c) => criteres[c].verdict === "KO")) return "REFUSEE";
  if (CRITERES.some((c) => criteres[c].verdict !== "OK")) return "INFOS_MANQUANTES";
  return "ACCEPTEE";
}

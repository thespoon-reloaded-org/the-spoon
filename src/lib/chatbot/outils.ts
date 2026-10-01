import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { Allergene, Prisma } from "@/generated/prisma";
import { CRENEAUX_HORAIRES } from "@/lib/creneaux";
import { ALLERGENES, LIBELLE_ALLERGENE, VALEURS_ALLERGENES } from "@/lib/allergenes";
import { creneauOuvert } from "@/lib/disponibilites";
import { jourIsoValide } from "@/lib/fuseau";
import { formaterHoraires } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";

/**
 * Outils de lecture de l'assistant de recherche.
 *
 * Aucun critère n'est figé côté code : l'agent traduit la demande du dîneur en
 * filtres libres (ville, cuisine, mots-clés, allergènes, budget, jour et
 * heure…) et peut enchaîner plusieurs requêtes. Mais il ne parle jamais à la
 * base en SQL : chaque outil est une requête Prisma paramétrée, en lecture
 * seule, sur les seules données déjà publiques (fiche, carte, horaires, texte
 * des avis). Ni dîneurs, ni réservations, ni factures n'y sont exposés — la
 * route est ouverte à tout visiteur.
 */

/** Plafond de candidats rendus à l'agent par recherche. */
const LIMITE_MAX = 25;

const ENTREE_RECHERCHE = z.object({
  villes: z.array(z.string().trim().min(1)).max(5).optional(),
  cuisines: z.array(z.string().trim().min(1)).max(5).optional(),
  mots_cles: z.array(z.string().trim().min(2).max(40)).max(8).optional(),
  sans_allergenes: z.array(z.enum(VALEURS_ALLERGENES)).max(14).optional(),
  prix_plat_max_euros: z.number().positive().max(500).optional(),
  note_min: z.number().min(0).max(5).optional(),
  jour: z.string().optional(),
  heure: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  tri: z.enum(["note", "avis"]).optional(),
  limite: z.number().int().min(1).max(LIMITE_MAX).optional(),
});

const ENTREE_DETAILS = z.object({ restaurant_id: z.string().min(1) });

export const ENTREE_PRESENTATION = z.object({
  message: z.string().trim().min(1).max(600),
  restaurants: z
    .array(z.object({ id: z.string().min(1), raison: z.string().trim().min(1).max(220) }))
    .max(10),
  // Pré-remplissage de la carte de réservation. Une valeur mal formée est
  // simplement ignorée : elle ne vaut pas de faire échouer tout le classement.
  reservation: z
    .object({
      jour: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .catch(undefined),
      creneau: z.enum(CRENEAUX_HORAIRES).optional().catch(undefined),
      couverts: z.number().int().min(1).max(20).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

export type EntreePresentation = z.infer<typeof ENTREE_PRESENTATION>;

export const OUTILS: Anthropic.Tool[] = [
  {
    name: "lister_valeurs",
    description:
      "Liste ce qui existe réellement dans la base : villes et types de cuisine (avec le nombre de restaurants) et les 14 allergènes filtrables. À appeler en premier pour faire correspondre les mots du dîneur (« italien », « Lyon », « sans gluten ») aux valeurs exactes.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "rechercher_restaurants",
    description:
      "Cherche des restaurants selon n'importe quelle combinaison de filtres, tous optionnels, et renvoie jusqu'à 25 candidats avec nom, ville, cuisine, note, nombre d'avis et six plats, ceux qui répondent aux critères sur les plats en premier (marqués « correspond »). Les filtres se cumulent (ET) ; au sein d'une liste, une seule valeur suffit (OU). Si aucun résultat, assouplis un filtre et relance. Les allergènes se filtrent sur les plats dont le restaurant a déclaré les allergènes : « sans_allergenes » garde les restaurants proposant au moins un tel plat, sans garantir le reste de la carte.",
    input_schema: {
      type: "object",
      properties: {
        villes: {
          type: "array",
          items: { type: "string" },
          description: "Villes exactes (voir lister_valeurs).",
        },
        cuisines: {
          type: "array",
          items: { type: "string" },
          description: "Cuisines exactes (voir lister_valeurs).",
        },
        mots_cles: {
          type: "array",
          items: { type: "string" },
          description:
            "Mots recherchés dans le nom, la description du restaurant et dans les plats (nom, description) — ex. « risotto », « végétarien », « terrasse », « ramen ». Un seul suffit à retenir un restaurant.",
        },
        sans_allergenes: {
          type: "array",
          items: { type: "string", enum: ALLERGENES },
          description: "Allergènes à éviter.",
        },
        prix_plat_max_euros: {
          type: "number",
          description: "Budget : le restaurant doit avoir un plat principal à ce prix ou moins.",
        },
        note_min: { type: "number", description: "Note minimale en cuillères (0 à 5)." },
        jour: { type: "string", description: "Date AAAA-MM-JJ où le restaurant doit être ouvert." },
        heure: { type: "string", description: "Heure HH:MM (avec « jour »)." },
        tri: { type: "string", enum: ["note", "avis"], description: "Défaut « note »." },
        limite: { type: "integer", description: "Nombre de candidats, 25 max." },
      },
    },
  },
  {
    name: "details_restaurant",
    description:
      "Détail d'un restaurant : description, horaires, carte (plats, prix, allergènes déclarés) et quelques avis récents. Sert à départager des candidats ou à vérifier un critère précis.",
    input_schema: {
      type: "object",
      properties: { restaurant_id: { type: "string" } },
      required: ["restaurant_id"],
    },
  },
  {
    name: "presenter_top10",
    description:
      "Termine la recherche : donne le classement final (10 restaurants au plus, du meilleur au moins bon) avec, pour chacun, une raison courte liée à la demande du dîneur. Appelle-le une seule fois, avec des id obtenus via les autres outils. Si rien ne correspond, passe une liste vide et explique-le dans « message ».",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Réponse au dîneur, 1 à 3 phrases, en français." },
        restaurants: {
          type: "array",
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              raison: {
                type: "string",
                description: "Pourquoi il répond à la demande, ≤ 150 caractères.",
              },
            },
            required: ["id", "raison"],
          },
        },
        reservation: {
          type: "object",
          description:
            "Ce que le dîneur a dit de sa réservation, pour pré-remplir le bouton Réserver. Seulement ce qu'il a exprimé ; omets ce qu'il n'a pas dit.",
          properties: {
            jour: { type: "string", description: "AAAA-MM-JJ, dans les 5 prochains jours." },
            creneau: {
              type: "string",
              enum: [...CRENEAUX_HORAIRES],
              description: "Le créneau le plus proche de l'heure demandée.",
            },
            couverts: { type: "integer", description: "Nombre de convives." },
          },
        },
      },
      required: ["message", "restaurants"],
    },
  },
];

function tronquer(texte: string | null, max: number): string | null {
  if (texte === null) return null;
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

async function listerValeurs() {
  const [villes, cuisines] = await Promise.all([
    prisma.restaurant.groupBy({ by: ["ville"], _count: true, orderBy: { ville: "asc" } }),
    prisma.restaurant.groupBy({ by: ["cuisine"], _count: true, orderBy: { cuisine: "asc" } }),
  ]);
  return {
    villes: villes.map((v) => ({ valeur: v.ville, restaurants: v._count })),
    cuisines: cuisines.map((c) => ({ valeur: c.cuisine, restaurants: c._count })),
    allergenes: ALLERGENES.map((a) => ({ valeur: a, libelle: LIBELLE_ALLERGENE[a] })),
  };
}

/** Plat dont le restaurant a déclaré les allergènes, et qui n'en contient aucun des exclus. */
function platSansAllergenes(
  plat: { allergenes: Allergene[] | null; allergenesDeclaresLe: Date | null },
  exclus: Allergene[],
): boolean {
  if (plat.allergenesDeclaresLe === null) return false;
  return !(plat.allergenes ?? []).some((a) => exclus.includes(a));
}

/**
 * Un plat répond-il à l'un des critères qui portent sur les plats
 * (mots-clés, allergènes, budget) ? `false` quand aucun n'est posé : rien ne
 * distingue alors un plat d'un autre.
 */
function platCorrespond(
  plat: {
    nom: string;
    description: string | null;
    categorie: string;
    prixCentimes: number;
    allergenes: Allergene[] | null;
    allergenesDeclaresLe: Date | null;
  },
  entree: z.infer<typeof ENTREE_RECHERCHE>,
): boolean {
  const criteres: boolean[] = [];
  if (entree.mots_cles?.length) {
    const texte = `${plat.nom} ${plat.description ?? ""}`.toLowerCase();
    criteres.push(entree.mots_cles.some((mot) => texte.includes(mot.toLowerCase())));
  }
  if (entree.sans_allergenes?.length) {
    criteres.push(platSansAllergenes(plat, entree.sans_allergenes));
  }
  if (entree.prix_plat_max_euros !== undefined) {
    criteres.push(
      plat.categorie === "PLAT" &&
        plat.prixCentimes > 0 &&
        plat.prixCentimes <= Math.round(entree.prix_plat_max_euros * 100),
    );
  }
  // Un seul suffit : le mot-clé peut viser un plat et le budget un autre.
  return criteres.some(Boolean);
}

async function rechercher(brut: unknown, dejaProposes: string[]) {
  const entree = ENTREE_RECHERCHE.parse(brut);
  if (entree.jour !== undefined && !jourIsoValide(entree.jour)) {
    return { erreur: "« jour » doit être une date AAAA-MM-JJ valide." };
  }

  const et: Prisma.RestaurantWhereInput[] = [];
  // « Autre proposition » : ce qui a déjà été montré n'est même pas renvoyé à
  // l'agent, plutôt que de compter sur lui pour l'écarter.
  if (dejaProposes.length > 0) et.push({ id: { notIn: dejaProposes } });
  if (entree.villes?.length) {
    et.push({ OR: entree.villes.map((v) => ({ ville: { equals: v, mode: "insensitive" } })) });
  }
  if (entree.cuisines?.length) {
    et.push({ OR: entree.cuisines.map((c) => ({ cuisine: { equals: c, mode: "insensitive" } })) });
  }
  if (entree.note_min !== undefined) et.push({ noteCuilleres: { gte: entree.note_min } });
  if (entree.mots_cles?.length) {
    et.push({
      OR: entree.mots_cles.flatMap((mot) => [
        { nom: { contains: mot, mode: "insensitive" as const } },
        { description: { contains: mot, mode: "insensitive" as const } },
        {
          platsCuillere: {
            some: {
              OR: [
                { nom: { contains: mot, mode: "insensitive" as const } },
                { description: { contains: mot, mode: "insensitive" as const } },
              ],
            },
          },
        },
      ]),
    });
  }
  if (entree.sans_allergenes?.length) {
    // Préfiltre seulement : l'exclusion elle-même se fait en mémoire (voir
    // `platSansAllergenes`) — la colonne est nullable et un plat déclaré
    // « aucun allergène » peut y valoir NULL, que `NOT has` écarterait.
    et.push({ platsCuillere: { some: { allergenesDeclaresLe: { not: null } } } });
  }
  if (entree.prix_plat_max_euros !== undefined) {
    et.push({
      platsCuillere: {
        some: {
          categorie: "PLAT",
          prixCentimes: { gt: 0, lte: Math.round(entree.prix_plat_max_euros * 100) },
        },
      },
    });
  }

  const filtreHoraire = entree.jour !== undefined && entree.heure !== undefined;
  const exclus = entree.sans_allergenes ?? [];
  const filtreEnMemoire = filtreHoraire || exclus.length > 0;
  const limite = entree.limite ?? 10;

  const restaurants = await prisma.restaurant.findMany({
    where: { AND: et },
    orderBy:
      entree.tri === "avis"
        ? [{ nombreAvis: "desc" }, { noteCuilleres: { sort: "desc", nulls: "last" } }]
        : [{ noteCuilleres: { sort: "desc", nulls: "last" } }, { nombreAvis: "desc" }],
    // Horaires et allergènes se filtrent en mémoire (voir ci-dessous) : on prend de la marge.
    take: filtreEnMemoire ? LIMITE_MAX * 4 : limite,
    select: {
      id: true,
      nom: true,
      ville: true,
      cuisine: true,
      description: true,
      noteCuilleres: true,
      nombreAvis: true,
      plagesOuverture: { select: { jourSemaine: true, debutMinutes: true, finMinutes: true } },
      // Les exceptions du seul jour demandé (congés, fermeture ou ouverture
      // ponctuelle) — la même règle que la carte de réservation, sinon
      // l'agent annoncerait ouvert un créneau que la carte montre fermé.
      exceptionsHoraires: {
        where: { jour: entree.jour ?? "" },
        select: { jour: true, creneau: true, ouvert: true },
      },
      platsCuillere: {
        orderBy: { createdAt: "asc" },
        select: {
          nom: true,
          description: true,
          categorie: true,
          prixCentimes: true,
          allergenes: true,
          allergenesDeclaresLe: true,
        },
      },
    },
  });

  const retenus = restaurants
    .filter(
      (r) =>
        !filtreHoraire ||
        creneauOuvert({
          plages: r.plagesOuverture,
          exceptions: r.exceptionsHoraires,
          jourIso: entree.jour!,
          creneau: entree.heure!,
        }),
    )
    .filter(
      (r) => exclus.length === 0 || r.platsCuillere.some((p) => platSansAllergenes(p, exclus)),
    )
    .slice(0, limite);

  return {
    nombre: retenus.length,
    restaurants: retenus.map((r) => ({
      id: r.id,
      nom: r.nom,
      ville: r.ville,
      cuisine: r.cuisine,
      note_cuilleres: r.noteCuilleres,
      nombre_avis: r.nombreAvis,
      description: tronquer(r.description, 200),
      // Les plats qui ont fait retenir le restaurant d'abord : sans ça, le
      // risotto qui justifiait le choix pouvait tomber au-delà des six montrés.
      plats: [...r.platsCuillere]
        .sort((a, b) => Number(platCorrespond(b, entree)) - Number(platCorrespond(a, entree)))
        .slice(0, 6)
        .map((p) => ({
          nom: p.nom,
          categorie: p.categorie,
          prix_euros: p.prixCentimes > 0 ? p.prixCentimes / 100 : null,
          ...(platCorrespond(p, entree) ? { correspond: true } : {}),
        })),
    })),
  };
}

async function details(brut: unknown) {
  const { restaurant_id } = ENTREE_DETAILS.parse(brut);
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurant_id },
    select: {
      id: true,
      nom: true,
      ville: true,
      cuisine: true,
      adresse: true,
      description: true,
      capacite: true,
      noteCuilleres: true,
      nombreAvis: true,
      plagesOuverture: { select: { jourSemaine: true, debutMinutes: true, finMinutes: true } },
      platsCuillere: {
        orderBy: { createdAt: "asc" },
        select: {
          nom: true,
          description: true,
          categorie: true,
          prixCentimes: true,
          allergenes: true,
          allergenesDeclaresLe: true,
        },
      },
      // Texte seul : jamais l'auteur de l'avis.
      avis: {
        where: { commentaire: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { noteCuilleres: true, commentaire: true },
      },
    },
  });
  if (!r) return { erreur: "Restaurant introuvable." };

  const horaires = formaterHoraires(r.plagesOuverture);
  return {
    id: r.id,
    nom: r.nom,
    ville: r.ville,
    cuisine: r.cuisine,
    adresse: r.adresse,
    description: r.description,
    capacite: r.capacite,
    note_cuilleres: r.noteCuilleres,
    nombre_avis: r.nombreAvis,
    horaires: horaires.length > 0 ? horaires : "non renseignés",
    plats: r.platsCuillere.map((p) => ({
      nom: p.nom,
      description: tronquer(p.description, 160),
      categorie: p.categorie,
      prix_euros: p.prixCentimes > 0 ? p.prixCentimes / 100 : null,
      allergenes:
        p.allergenesDeclaresLe === null
          ? "non déclarés"
          : (p.allergenes ?? []).map((a) => a.toLowerCase()),
    })),
    avis_recents: r.avis.map((a) => ({
      note: a.noteCuilleres,
      commentaire: tronquer(a.commentaire, 240),
    })),
  };
}

/**
 * Exécute un outil de lecture (hors `presenter_top10`, que l'agent traite
 * lui-même). Une entrée invalide ou une erreur de base revient à l'agent
 * comme résultat d'erreur — il peut se corriger — et jamais comme exception
 * qui ferait tomber la requête du visiteur.
 */
export async function executerOutil(
  nom: string,
  entree: unknown,
  dejaProposes: string[] = [],
): Promise<{ contenu: string; erreur: boolean }> {
  try {
    let resultat: unknown;
    switch (nom) {
      case "lister_valeurs":
        resultat = await listerValeurs();
        break;
      case "rechercher_restaurants":
        resultat = await rechercher(entree, dejaProposes);
        break;
      case "details_restaurant":
        resultat = await details(entree);
        break;
      default:
        return { contenu: `Outil inconnu : ${nom}`, erreur: true };
    }
    return { contenu: JSON.stringify(resultat), erreur: false };
  } catch (erreur) {
    if (erreur instanceof z.ZodError) {
      return { contenu: `Paramètres invalides : ${z.prettifyError(erreur)}`, erreur: true };
    }
    console.error(`Outil du chatbot « ${nom} » en échec :`, erreur);
    return { contenu: "La base n'a pas répondu, réessaie.", erreur: true };
  }
}

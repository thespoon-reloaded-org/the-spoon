/**
 * Ce qu'un formateur fait arriver à TheSpoon pendant une session : des
 * demandes de référencement, des réservations, des avis, des contestations,
 * par lots, comme s'ils venaient de restaurateurs et de dîneurs.
 *
 * Même règle que l'API d'administration, pour la même raison : **on ne
 * fabrique que des états que le produit aurait pu atteindre**. Chaque
 * événement passe par la fonction qu'emprunte l'écran correspondant —
 * formulaire « Devenir partenaire », création de réservation, dépôt d'avis,
 * dépôt de contestation — et en hérite les règles. Quand le produit n'en
 * permet pas autant que demandé (créneaux pleins, pas assez de dîneurs
 * servis, plus de facture contestable), l'événement en crée moins et le dit,
 * plutôt que d'inventer un état impossible.
 *
 * Tout est daté de maintenant : ce qui arrive pendant la session arrive
 * maintenant. Les choix (qui, où, combien de couverts) se font en deux temps :
 * une planification pure, testable sans base, puis l'écriture.
 */
import type {
  EvenementFormation,
  MotifContestation,
  RoleContactRestaurant,
} from "@/generated/prisma";
import { creerAvis, creerReservations } from "@/lib/api-admin/creations";
import type { SaisieReservation } from "@/lib/api-admin/schemas";
import { creerDossierContestation, delaiContestationExpire } from "@/lib/contestation";
import {
  CRENEAUX_HORAIRES,
  CRENEAUX_SOIR,
  NB_JOURS_RESERVABLES,
  construireDateCreneau,
  estDansLaFenetreReservable,
  genererJoursReservables,
} from "@/lib/creneaux";
import {
  schemaDemandeContact,
  type SaisieDemandeContact,
} from "@/lib/demande-contact-restaurateur";
import { deposerDemandesRestaurateur } from "@/lib/demandes-restaurateur";
import { creneauOuvert, type Exception } from "@/lib/disponibilites";
import { DELAI_CONTESTATION_JOURS } from "@/lib/facturation";
import { ajouterJours, aujourdHuiIso, debutDeJournee } from "@/lib/fuseau";
import type { Plage } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";
import { capaciteEffective } from "@/lib/reservation";

export type FicheEvenement = {
  libelle: string;
  description: string;
  /** Par déclenchement — de quoi tenir dans le délai d'une fonction Netlify. */
  quantiteMax: number;
  /** Le formateur peut viser un restaurant ; sans choix, tous sont candidats. */
  parRestaurant: boolean;
};

export const EVENEMENTS: Record<EvenementFormation, FicheEvenement> = {
  DEMANDES_REFERENCEMENT: {
    libelle: "Demandes de référencement",
    description:
      "Des restaurateurs pas encore partenaires remplissent le formulaire « Devenir partenaire ». Les demandes arrivent dans la file du staff, à qualifier — certaines ne proposent pas de menu à la cuillère.",
    quantiteMax: 20,
    parRestaurant: false,
  },
  RESERVATIONS: {
    libelle: "Réservations",
    description: `Des dîneurs sans réservation à venir réservent pour les ${NB_JOURS_RESERVABLES} prochains jours, sur les créneaux ouverts et dans la capacité de chaque restaurant.`,
    quantiteMax: 50,
    parRestaurant: true,
  },
  AVIS: {
    libelle: "Avis",
    description:
      "Des dîneurs servis ces 30 derniers jours, qui n'avaient pas encore noté le restaurant, laissent leur avis. La note du restaurant est recalculée.",
    quantiteMax: 50,
    parRestaurant: true,
  },
  CONTESTATIONS: {
    libelle: "Contestations",
    description: `Des restaurateurs contestent une à trois lignes d'une facture encore dans son délai de ${DELAI_CONTESTATION_JOURS} jours. Sous le seuil, le dossier est crédité d'office ; au-dessus, il arrive dans la file des litiges.`,
    quantiteMax: 10,
    parRestaurant: true,
  },
};

/** Ce qu'un déclenchement a produit : combien, et la phrase du journal. */
export type ResultatEvenement = { creees: number; resume: string };

// ---------------------------------------------------------------------------
// Tirages
// ---------------------------------------------------------------------------

/** Un nombre dans [0, 1[ — `Math.random` en vrai, une suite fixe en test. */
export type Tirage = () => number;

/** Ce qu'un test fixe ; en vrai, maintenant et le hasard. */
export type OptionsDeclenchement = { maintenant?: Date; tirer?: Tirage };

function parmi<T>(liste: readonly T[], tirer: Tirage): T {
  return liste[Math.floor(tirer() * liste.length)]!;
}

function pondere<T>(options: readonly (readonly [T, number])[], tirer: Tirage): T {
  const total = options.reduce((somme, [, poids]) => somme + poids, 0);
  let reste = tirer() * total;
  for (const [valeur, poids] of options) {
    reste -= poids;
    if (reste < 0) return valeur;
  }
  return options[options.length - 1]![0];
}

function melanger<T>(liste: readonly T[], tirer: Tirage): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(tirer() * (i + 1));
    [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  }
  return copie;
}

function pluriel(n: number, singulier: string, forme = `${singulier}s`): string {
  return `${n} ${n > 1 ? forme : singulier}`;
}

/**
 * « 12 réservations prises », ou « 3 réservations prises sur 12 demandées »
 * quand le produit n'en permettait pas autant — la raison suit, en fin de
 * phrase. Les formes sont données accordées : le français ne se devine pas.
 */
function compte(
  creees: number,
  demandees: number,
  [singulier, forme]: readonly [string, string],
  demande: "demandés" | "demandées",
) {
  const fait = pluriel(creees, singulier, forme);
  return creees < demandees ? `${fait} sur ${demandees} ${demande}` : fait;
}

function raisonSiManque(creees: number, demandees: number, raison: string): string {
  return creees < demandees ? ` — ${raison}` : "";
}

async function nomRestaurant(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { nom: true },
  });
  return restaurant?.nom ?? "ce restaurant";
}

// ---------------------------------------------------------------------------
// Demandes de référencement
// ---------------------------------------------------------------------------

const PRENOMS = [
  "Camille",
  "Léa",
  "Inès",
  "Sarah",
  "Julie",
  "Clara",
  "Margaux",
  "Yasmine",
  "Mei",
  "Sofia",
  "Thomas",
  "Nicolas",
  "Julien",
  "Antoine",
  "Hugo",
  "Karim",
  "Mehdi",
  "Paul",
  "Louis",
  "Bastien",
];

const NOMS = [
  "Martin",
  "Bernard",
  "Dubois",
  "Lefèvre",
  "Moreau",
  "Laurent",
  "Garcia",
  "Roux",
  "Fournier",
  "Girard",
  "Bonnet",
  "Mercier",
  "Chevalier",
  "Nguyen",
  "Haddad",
  "Rossi",
  "Lambert",
  "Faure",
  "Perrin",
  "Benali",
];

/** Des établissements qui n'existent pas, à des adresses qui, elles, existent. */
const ETABLISSEMENTS = [
  { nom: "Le Comptoir des Halles", adresse: "12 rue Montorgueil, 75002 Paris" },
  { nom: "La Table de Jeanne", adresse: "48 rue des Martyrs, 75009 Paris" },
  { nom: "Bouillon Saint-Paul", adresse: "7 rue Saint-Paul, 75004 Paris" },
  { nom: "Chez Mémé Louise", adresse: "23 rue de la Roquette, 75011 Paris" },
  { nom: "L'Assiette Creuse", adresse: "91 avenue Parmentier, 75011 Paris" },
  { nom: "Le Petit Mijoté", adresse: "5 rue Mouffetard, 75005 Paris" },
  { nom: "Soupes & Cie", adresse: "16 rue de Charonne, 75011 Paris" },
  { nom: "La Marmite du Canal", adresse: "102 quai de Jemmapes, 75010 Paris" },
  { nom: "Bistrot des Pentes", adresse: "14 montée de la Grande-Côte, 69001 Lyon" },
  { nom: "Le Bouchon d'Ainay", adresse: "8 rue Vaubecour, 69002 Lyon" },
  { nom: "La Cocotte Croix-Rousse", adresse: "3 place de la Croix-Rousse, 69004 Lyon" },
  { nom: "Le Panier du Vieux-Port", adresse: "27 quai de Rive-Neuve, 13007 Marseille" },
  { nom: "La Bouillabaisse d'Endoume", adresse: "54 rue d'Endoume, 13007 Marseille" },
  { nom: "Le Garbure", adresse: "11 rue des Faures, 33000 Bordeaux" },
  { nom: "Chez Babette", adresse: "36 rue Notre-Dame, 33000 Bordeaux" },
  { nom: "Le Cassoulet Rose", adresse: "19 rue du Taur, 31000 Toulouse" },
  { nom: "La Crêperie du Bouffay", adresse: "9 rue de la Juiverie, 44000 Nantes" },
  { nom: "Le Potager de Wazemmes", adresse: "41 rue des Sarrazins, 59000 Lille" },
  { nom: "La Winstub du Pont", adresse: "6 rue des Moulins, 67000 Strasbourg" },
  { nom: "Le Pot-au-Feu Niçois", adresse: "15 rue Droite, 06300 Nice" },
];

const MESSAGES_DEMANDE = [
  "Bonjour, nous servons chaque midi un menu du jour à la cuillère (velouté, plat mijoté, dessert) et nous aimerions recevoir des réservations en ligne. Pouvez-vous nous rappeler ?",
  "Bonjour, je gère {etablissement}, une quarantaine de couverts. On me conseille TheSpoon : quelles sont les conditions pour être référencé ?",
  "Nous avons ouvert il y a un an et la salle est pleine le week-end, beaucoup moins en semaine. Nous voudrions apparaître sur TheSpoon.",
  "Bonjour, restaurant familial, cuisine maison. Je voudrais savoir combien coûte le référencement et comment se passe la facturation.",
  "Bonjour, nous changeons de plateforme de réservation. Est-il possible de rejoindre TheSpoon dès le mois prochain ?",
  "Bonjour, nous proposons surtout des plats à partager et des grillades. Est-ce que ça correspond à ce que vous référencez ?",
];

/** Minuscules, sans accents ni espaces : de quoi bâtir une adresse email. */
function sansAccents(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Le formulaire « Devenir partenaire » tel qu'un restaurateur le remplirait,
 * validé par le même schéma que le formulaire : ce qui passe ici aurait
 * passé là-bas. Un sur cinq ne propose pas de menu à la cuillère — le staff
 * a des demandes à refuser, pas seulement à accepter.
 */
export function genererDemandes(quantite: number, tirer: Tirage): SaisieDemandeContact[] {
  const etablissements = melanger(ETABLISSEMENTS, tirer);
  return Array.from({ length: quantite }, (_, i) => {
    const etablissement = etablissements[i % etablissements.length]!;
    const prenom = parmi(PRENOMS, tirer);
    const nom = parmi(NOMS, tirer);
    const siren = String(Math.floor(300_000_000 + tirer() * 600_000_000));
    return schemaDemandeContact.parse({
      nom: `${prenom} ${nom}`,
      // Le domaine `.example` est réservé : l'adresse n'atteindra jamais personne.
      email: `${sansAccents(prenom)}.${sansAccents(nom)}@${sansAccents(etablissement.nom)}.example`,
      etablissement: etablissement.nom,
      adresse: etablissement.adresse,
      siren,
      urlGoogleMyBusiness: "",
      menusALaCuillere: tirer() < 0.8 ? "oui" : "non",
      message: parmi(MESSAGES_DEMANDE, tirer).replace("{etablissement}", etablissement.nom),
    });
  });
}

export async function declencherDemandes(
  quantite: number,
  { tirer = Math.random }: OptionsDeclenchement = {},
): Promise<ResultatEvenement> {
  const demandes = genererDemandes(quantite, tirer);
  await deposerDemandesRestaurateur(demandes);
  return {
    creees: demandes.length,
    resume: `${pluriel(demandes.length, "demande de référencement déposée", "demandes de référencement déposées")}.`,
  };
}

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

export type RestaurantPlanifiable = {
  id: string;
  createdAt: Date;
  /** Capacité effective (voir `capaciteEffective`). */
  capacite: number;
  plages: Plage[];
  exceptions: Exception[];
};

/** Clé d'occupation d'un créneau : même découpage que `creerReservations`. */
export function cleOccupation(restaurantId: string, date: Date): string {
  return `${restaurantId}|${date.toISOString()}`;
}

/** La taille des tables, comme on la voit en salle : beaucoup de deux. */
const COUVERTS = [
  [2, 50],
  [4, 18],
  [3, 12],
  [1, 8],
  [5, 6],
  [6, 6],
] as const;

/** On réserve plus volontiers le soir que le midi. */
const POIDS_SOIR = 1;
const POIDS_MIDI = 0.65;

/**
 * Qui réserve quoi : un dîneur différent par réservation, sur un créneau
 * ouvert de la fenêtre réservable, sans dépasser ce qui reste de capacité.
 * Une table qui ne tient plus nulle part se replie sur la plus grande qui
 * tient encore ; s'il ne reste plus rien, on s'arrête là. `manqueDe` dit
 * pourquoi on s'est arrêté avant la quantité demandée : plus de dîneurs, plus
 * de place, ou aucun créneau ouvert du tout (fermeture).
 */
export function planifierReservations({
  quantite,
  restaurants,
  occupation,
  dineurIds,
  maintenant,
  tirer,
}: {
  quantite: number;
  restaurants: RestaurantPlanifiable[];
  /** Couverts déjà pris par créneau, par `cleOccupation`. */
  occupation: Map<string, number>;
  dineurIds: string[];
  maintenant: Date;
  tirer: Tirage;
}): {
  reservations: SaisieReservation[];
  manqueDe: "fermeture" | "creneaux" | "dineurs" | null;
} {
  const jours = genererJoursReservables(maintenant).map((jour) => jour.iso);
  const creneaux = restaurants.flatMap((restaurant) =>
    jours.flatMap((jour) =>
      CRENEAUX_HORAIRES.flatMap((creneau) => {
        const date = construireDateCreneau(jour, creneau)!;
        const ouvert =
          creneauOuvert({
            plages: restaurant.plages,
            exceptions: restaurant.exceptions,
            jourIso: jour,
            creneau,
          }) &&
          estDansLaFenetreReservable(date, maintenant) &&
          date.getTime() > restaurant.createdAt.getTime();
        if (!ouvert) return [];
        const cle = cleOccupation(restaurant.id, date);
        const poids = (CRENEAUX_SOIR as readonly string[]).includes(creneau)
          ? POIDS_SOIR
          : POIDS_MIDI;
        return [{ restaurantId: restaurant.id, jour, creneau, cle, poids }];
      }),
    ),
  );
  const capaciteParRestaurant = new Map(restaurants.map((r) => [r.id, r.capacite]));
  const restant = new Map(
    creneaux.map((c) => [
      c.cle,
      capaciteParRestaurant.get(c.restaurantId)! - (occupation.get(c.cle) ?? 0),
    ]),
  );
  const dineurs = melanger(dineurIds, tirer);
  if (creneaux.length === 0) return { reservations: [], manqueDe: "fermeture" };

  const reservations: SaisieReservation[] = [];
  while (reservations.length < quantite) {
    const dineurId = dineurs[reservations.length];
    if (!dineurId) return { reservations, manqueDe: "dineurs" };

    const voulus = pondere(COUVERTS, tirer);
    const couverts = Array.from({ length: voulus }, (_, i) => voulus - i).find((n) =>
      creneaux.some((c) => restant.get(c.cle)! >= n),
    );
    if (couverts === undefined) return { reservations, manqueDe: "creneaux" };

    const possibles = creneaux.filter((c) => restant.get(c.cle)! >= couverts);
    const choisi = pondere(
      possibles.map((c) => [c, c.poids] as const),
      tirer,
    );
    restant.set(choisi.cle, restant.get(choisi.cle)! - couverts);
    reservations.push({
      restaurantId: choisi.restaurantId,
      dineurId,
      jour: choisi.jour,
      creneau: choisi.creneau,
      couverts,
      statut: "CONFIRMEE",
      creeLe: maintenant,
    });
  }
  return { reservations, manqueDe: null };
}

export async function declencherReservations(
  { quantite, restaurantId }: { quantite: number; restaurantId: string | null },
  {
    maintenant = new Date(),
    tirer = Math.random,
    parmiDineurs,
  }: OptionsDeclenchement & {
    /**
     * Restreint le vivier de dîneurs. Pour les tests : la base de test est
     * partagée, et un dîneur emprunté à un autre test peut disparaître avec
     * lui en cours de route.
     */
    parmiDineurs?: string[];
  } = {},
): Promise<ResultatEvenement> {
  const jours = genererJoursReservables(maintenant).map((jour) => jour.iso);
  const filtre = restaurantId ? { id: restaurantId } : {};
  const restaurants = await prisma.restaurant.findMany({
    where: filtre,
    select: {
      id: true,
      createdAt: true,
      capacite: true,
      plagesOuverture: { select: { jourSemaine: true, debutMinutes: true, finMinutes: true } },
      exceptionsHoraires: {
        where: { jour: { gte: jours[0]!, lte: jours[jours.length - 1]! } },
        select: { jour: true, creneau: true, ouvert: true },
      },
    },
  });
  const ids = restaurants.map((r) => r.id);
  const finFenetre = debutDeJournee(
    ajouterJours(aujourdHuiIso(maintenant), NB_JOURS_RESERVABLES + 1),
  );
  const [occupes, dineurs] = await Promise.all([
    prisma.booking.groupBy({
      by: ["restaurantId", "date"],
      where: {
        restaurantId: { in: ids },
        statut: { not: "ANNULEE" },
        date: { gt: maintenant, lt: finFenetre },
      },
      _sum: { couverts: true },
    }),
    // Un dîneur qui a déjà une table à venir ne réserve pas une deuxième
    // fois dans la même vague.
    prisma.user.findMany({
      where: {
        ...(parmiDineurs ? { id: { in: parmiDineurs } } : {}),
        createdAt: { lt: maintenant },
        bookings: { none: { statut: "CONFIRMEE", date: { gt: maintenant } } },
      },
      select: { id: true },
    }),
  ]);

  const { reservations, manqueDe } = planifierReservations({
    quantite,
    restaurants: restaurants.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      capacite: capaciteEffective(r.capacite),
      plages: r.plagesOuverture,
      exceptions: r.exceptionsHoraires,
    })),
    occupation: new Map(
      occupes.map((o) => [cleOccupation(o.restaurantId, o.date), o._sum.couverts ?? 0]),
    ),
    dineurIds: dineurs.map((d) => d.id),
    maintenant,
    tirer,
  });
  if (reservations.length > 0) await creerReservations(reservations, maintenant);

  const ou = restaurantId
    ? `pour ${await nomRestaurant(restaurantId)}`
    : `dans ${pluriel(new Set(reservations.map((r) => r.restaurantId)).size, "restaurant")}`;
  const raison = {
    dineurs: "pas assez de dîneurs sans réservation à venir",
    fermeture: `aucun créneau ouvert sur les ${NB_JOURS_RESERVABLES} prochains jours`,
    creneaux: "plus de place sur les créneaux ouverts",
  }[manqueDe ?? "creneaux"];
  return {
    creees: reservations.length,
    resume: `${compte(reservations.length, quantite, ["réservation prise", "réservations prises"], "demandées")} ${ou}, pour les ${NB_JOURS_RESERVABLES} prochains jours${raisonSiManque(reservations.length, quantite, raison)}.`,
  };
}

// ---------------------------------------------------------------------------
// Avis
// ---------------------------------------------------------------------------

/** Note choisie par le formateur, ou tirée comme sur la plateforme. */
export type NoteAvis = 1 | 2 | 3 | 4 | 5 | "realiste";

/** La plupart des dîneurs sont contents ; quelques soirées ratées. */
const NOTES = [
  [5, 34],
  [4, 36],
  [3, 16],
  [2, 8],
  [1, 6],
] as const;

const COMMENTAIRES_AVIS: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  5: [
    "Une vraie adresse, service aux petits soins. On reviendra.",
    "Tout était parfait, de l'entrée au dessert.",
    "Coup de cœur pour le plat du jour. Ambiance chaleureuse.",
  ],
  4: [
    "Très bon moment, un peu d'attente entre les plats.",
    "Cuisine soignée, rapport qualité-prix correct.",
    "Bonne adresse, portions généreuses. Salle un peu bruyante.",
  ],
  3: [
    "Correct sans plus, un peu fade ce soir-là.",
    "Service lent, mais la cuisine était bonne.",
    "Un peu cher pour ce que c'est.",
  ],
  2: [
    "Plats servis tièdes, service expéditif. Dommage.",
    "Déçus par le plat principal, le dessert rattrapait un peu.",
  ],
  1: [
    "Notre table n'était pas prête à l'heure réservée, vingt minutes au bar.",
    "Réservation introuvable à notre arrivée, on nous a placés au fond.",
  ],
};

/** Un dîneur servi dans ce restaurant, avec son service le plus récent. */
export type PassageServi = { restaurantId: string; userId: string; email: string; date: Date };

/** Quels passages donnent un avis : on parle plus volontiers quand c'est frais. */
const FENETRE_AVIS_JOURS = 30;

/**
 * Un avis par (dîneur, restaurant) jamais noté, choisi parmi les passages
 * les plus récents. On écrit plus volontiers quand on a été déçu.
 */
export function choisirAvis({
  quantite,
  passages,
  dejaNotes,
  note,
  maintenant,
  tirer,
}: {
  quantite: number;
  passages: PassageServi[];
  /** Paires `restaurantId|userId` qui ont déjà un avis. */
  dejaNotes: Set<string>;
  note: NoteAvis;
  maintenant: Date;
  tirer: Tirage;
}) {
  const parPaire = new Map<string, PassageServi>();
  for (const passage of passages) {
    const cle = `${passage.restaurantId}|${passage.userId}`;
    if (dejaNotes.has(cle)) continue;
    const connu = parPaire.get(cle);
    if (!connu || connu.date < passage.date) parPaire.set(cle, passage);
  }
  const recents = [...parPaire.values()]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, Math.max(quantite * 3, 30));

  return melanger(recents, tirer)
    .slice(0, quantite)
    .map((passage) => {
      const cuilleres = note === "realiste" ? pondere(NOTES, tirer) : note;
      const commente = tirer() < (cuilleres <= 2 ? 0.9 : 0.6);
      return {
        restaurantId: passage.restaurantId,
        dineurEmail: passage.email,
        noteCuilleres: cuilleres,
        commentaire: commente ? parmi(COMMENTAIRES_AVIS[cuilleres], tirer) : null,
        creeLe: maintenant,
      };
    });
}

export async function declencherAvis(
  {
    quantite,
    restaurantId,
    note,
  }: { quantite: number; restaurantId: string | null; note: NoteAvis },
  { maintenant = new Date(), tirer = Math.random }: OptionsDeclenchement = {},
): Promise<ResultatEvenement> {
  const servis = await prisma.booking.findMany({
    where: {
      ...(restaurantId ? { restaurantId } : {}),
      statut: { in: ["HONOREE", "CONFIRMEE"] },
      date: {
        lte: maintenant,
        gte: debutDeJournee(ajouterJours(aujourdHuiIso(maintenant), -FENETRE_AVIS_JOURS)),
      },
    },
    select: { restaurantId: true, userId: true, date: true, user: { select: { email: true } } },
  });
  const existants = await prisma.avis.findMany({
    where: {
      restaurantId: { in: [...new Set(servis.map((s) => s.restaurantId))] },
      userId: { in: [...new Set(servis.map((s) => s.userId))] },
    },
    select: { restaurantId: true, userId: true },
  });

  const avis = choisirAvis({
    quantite,
    passages: servis.map((s) => ({
      restaurantId: s.restaurantId,
      userId: s.userId,
      email: s.user.email,
      date: s.date,
    })),
    dejaNotes: new Set(existants.map((a) => `${a.restaurantId}|${a.userId}`)),
    note,
    maintenant,
    tirer,
  });
  if (avis.length > 0) await creerAvis(avis, maintenant);

  const ou = restaurantId
    ? `pour ${await nomRestaurant(restaurantId)}`
    : `dans ${pluriel(new Set(avis.map((a) => a.restaurantId)).size, "restaurant")}`;
  const moyenne =
    avis.length > 0
      ? `, ${(avis.reduce((somme, a) => somme + a.noteCuilleres, 0) / avis.length).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} cuillères en moyenne`
      : "";
  const raison = `pas d'autre dîneur servi ces ${FENETRE_AVIS_JOURS} derniers jours sans avis`;
  return {
    creees: avis.length,
    resume: `${compte(avis.length, quantite, ["avis laissé", "avis laissés"], "demandés")} ${ou}${moyenne}${raisonSiManque(avis.length, quantite, raison)}.`,
  };
}

// ---------------------------------------------------------------------------
// Contestations
// ---------------------------------------------------------------------------

const MOTIFS = [
  ["NO_SHOW", 35],
  ["COUVERTS_SURCOMPTES", 25],
  ["ANNULATION_TARDIVE", 15],
  ["DOUBLON", 10],
  ["HORS_PLATEFORME", 10],
  ["AUTRE", 5],
] as const satisfies readonly (readonly [MotifContestation, number])[];

const COMMENTAIRES_CONTESTATION: Record<MotifContestation, string[]> = {
  NO_SHOW: [
    "Ces clients ne se sont jamais présentés, le signalement a été fait par erreur.",
    "Table restée vide toute la soirée, voir notre cahier de salle.",
  ],
  COUVERTS_SURCOMPTES: [
    "La table était de deux personnes, pas de quatre.",
    "Nous avons servi moins de couverts que ce qui est facturé.",
  ],
  ANNULATION_TARDIVE: [
    "Le client a annulé par téléphone le jour même, nous n'avons pas pu relouer la table.",
  ],
  DOUBLON: ["Le même client apparaît deux fois pour le même service."],
  HORS_PLATEFORME: ["Ce client avait réservé directement chez nous par téléphone."],
  AUTRE: ["Merci de vérifier ces lignes, elles ne correspondent pas à notre planning."],
};

export type FactureContestable = {
  id: string;
  restaurantId: string;
  genereeLe: Date;
  /** Lignes pas encore contestées. */
  ligneIds: string[];
  contacts: { id: string; role: RoleContactRestaurant }[];
};

/**
 * Un dossier par facture encore contestable — délai ouvert, au moins une
 * ligne libre, un contact pour la déposer. Le gérant dépose de préférence ;
 * un dossier porte sur une à trois lignes, pour un même motif.
 */
export function choisirContestations({
  quantite,
  factures,
  maintenant,
  tirer,
}: {
  quantite: number;
  factures: FactureContestable[];
  maintenant: Date;
  tirer: Tirage;
}) {
  const contestables = factures.filter(
    (f) =>
      !delaiContestationExpire(f.genereeLe, maintenant) &&
      f.ligneIds.length > 0 &&
      f.contacts.length > 0,
  );
  return melanger(contestables, tirer)
    .slice(0, quantite)
    .map((facture) => {
      const nbLignes = Math.min(
        pondere(
          [
            [1, 60],
            [2, 30],
            [3, 10],
          ] as const,
          tirer,
        ),
        facture.ligneIds.length,
      );
      const motif = pondere(MOTIFS, tirer);
      const contact = facture.contacts.find((c) => c.role === "GERANT") ?? facture.contacts[0]!;
      return {
        factureId: facture.id,
        restaurantId: facture.restaurantId,
        restaurantContactId: contact.id,
        lignes: melanger(facture.ligneIds, tirer)
          .slice(0, nbLignes)
          .map((ligneFactureId) => ({ ligneFactureId, motif })),
        commentaire: tirer() < 0.8 ? parmi(COMMENTAIRES_CONTESTATION[motif], tirer) : null,
      };
    });
}

export async function declencherContestations(
  { quantite, restaurantId }: { quantite: number; restaurantId: string | null },
  { maintenant = new Date(), tirer = Math.random }: OptionsDeclenchement = {},
): Promise<ResultatEvenement> {
  const factures = await prisma.facture.findMany({
    where: {
      ...(restaurantId ? { restaurantId } : {}),
      // Large d'un jour : `delaiContestationExpire` tranche ensuite au plus juste.
      genereeLe: {
        gte: debutDeJournee(
          ajouterJours(aujourdHuiIso(maintenant), -(DELAI_CONTESTATION_JOURS + 1)),
        ),
      },
    },
    select: {
      id: true,
      restaurantId: true,
      genereeLe: true,
      lignes: { where: { contestation: { is: null } }, select: { id: true } },
      restaurant: { select: { contacts: { select: { id: true, role: true } } } },
    },
  });

  const dossiers = choisirContestations({
    quantite,
    factures: factures.map((f) => ({
      id: f.id,
      restaurantId: f.restaurantId,
      genereeLe: f.genereeLe,
      ligneIds: f.lignes.map((l) => l.id),
      contacts: f.restaurant.contacts,
    })),
    maintenant,
    tirer,
  });

  // Un dossier à la fois, par la fonction du dépôt depuis l'espace
  // restaurant : délai, lignes, double contestation et seuil y sont jugés.
  // Chaque dossier a sa propre transaction : une panne en cours de lot laisse
  // déposés ceux d'avant. On s'arrête là et on rend le compte, pour que le
  // journal dise ce qui existe vraiment en base.
  const deposes: string[] = [];
  const refus: string[] = [];
  let panne = false;
  for (const dossier of dossiers) {
    let resultat;
    try {
      resultat = await creerDossierContestation(dossier);
    } catch (erreur) {
      console.error("Contestation de formation en échec :", erreur);
      panne = true;
      break;
    }
    if (resultat.ok) deposes.push(resultat.dossierId);
    else refus.push(resultat.erreur);
  }
  const creditesOffice = await prisma.dossier.count({
    where: { id: { in: deposes }, statut: "CREDITE_OFFICE" },
  });

  const ou = restaurantId
    ? `pour ${await nomRestaurant(restaurantId)}`
    : `sur ${pluriel(deposes.length, "facture")}`;
  const office =
    creditesOffice > 0 ? `, dont ${pluriel(creditesOffice, "créditée", "créditées")} d'office` : "";
  const raison = panne
    ? "le dépôt s'est interrompu en cours de route, relancez pour compléter"
    : (refus[0] ??
      `pas d'autre facture dans son délai de ${DELAI_CONTESTATION_JOURS} jours avec une ligne à contester`);
  return {
    creees: deposes.length,
    resume: `${compte(deposes.length, quantite, ["contestation déposée", "contestations déposées"], "demandées")} ${ou}${office}${raisonSiManque(deposes.length, quantite, raison)}.`,
  };
}

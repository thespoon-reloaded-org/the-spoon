/**
 * Génère le jeu de formation : une fonction pure de (maintenant, graine).
 * Même graine, même jour : même jeu, à la réservation près — c'est ce qui
 * permet de relire le plan avant de l'injecter, et de reprendre une injection
 * interrompue sans rien recréer.
 *
 * Le jeu respecte, par construction, chaque règle que l'API d'administration
 * vérifie (voir src/lib/api-admin/creations.ts) : créneaux ouverts,
 * capacité, 1 à 6 couverts, fenêtre de 5 jours vue du jour de la prise,
 * dates dans l'ordre, délai de contestation, seuil de crédit d'office.
 * L'API reste le juge : ce qu'elle refuse, le générateur l'a mal fait.
 *
 * Ce qui fait le réalisme, et qui n'est écrit nulle part ailleurs :
 * - la demande suit la semaine (vendredi et samedi soir), la saison (Paris se
 *   vide en août, la côte se remplit), et la croissance de la plateforme ;
 * - les restaurants arrivent au fil de l'eau, avec une montée en charge ;
 * - quelques restaurants signalent mal — tard, ou pas du tout — et ce sont
 *   eux qui contestent le plus ;
 * - la plupart des dîneurs réservent une ou deux fois, quelques habitués
 *   beaucoup plus ;
 * - les litiges se déposent dans le mois qui suit la facture, et ceux du
 *   dernier mois sont encore en cours d'instruction.
 */
import { CRENEAUX_MIDI, CRENEAUX_SOIR } from "../../src/lib/creneaux";
import {
  ajouterJours,
  aujourdHuiIso,
  instantLocalDeJour,
  jourSemaineIso,
  moisAdjacent,
  moisIso,
} from "../../src/lib/fuseau";
import { creneauDansLesHoraires, type Plage } from "../../src/lib/horaires";

import {
  CUISINES,
  NOMS,
  PRENOMS,
  RESTAURANTS,
  STAFF,
  type Allergene,
  type Categorie,
} from "./donnees";

// ---------------------------------------------------------------------------
// Aléa reproductible
// ---------------------------------------------------------------------------

/** mulberry32 : petit, rapide, assez bon pour tirer un jeu de données. */
export function aleaSeme(graine: number) {
  let etat = graine >>> 0;
  const suivant = () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entre = (min: number, max: number) => min + (max - min) * suivant();
  const entier = (min: number, max: number) => Math.floor(entre(min, max + 1));
  const chance = (p: number) => suivant() < p;
  const parmi = <T>(liste: readonly T[]): T => liste[Math.floor(suivant() * liste.length)]!;
  const pondere = <T>(options: readonly (readonly [T, number])[]): T => {
    const total = options.reduce((s, [, poids]) => s + poids, 0);
    let tirage = suivant() * total;
    for (const [valeur, poids] of options) {
      tirage -= poids;
      if (tirage < 0) return valeur;
    }
    return options[options.length - 1]![0];
  };
  /** Loi de Poisson (Knuth) — assez juste pour des moyennes de quelques unités. */
  const poisson = (moyenne: number) => {
    const limite = Math.exp(-moyenne);
    let k = 0;
    let produit = suivant();
    while (produit > limite) {
      k++;
      produit *= suivant();
    }
    return k;
  };
  const normale = () => Math.sqrt(-2 * Math.log(1 - suivant())) * Math.cos(2 * Math.PI * suivant());
  return { suivant, entre, entier, chance, parmi, pondere, poisson, normale };
}

type Alea = ReturnType<typeof aleaSeme>;

// ---------------------------------------------------------------------------
// Ce que le plan contient — exactement les corps des appels à l'API
// ---------------------------------------------------------------------------

const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;

export type PlanStaff = { nom: string; email: string; role: string; creeLe: string };

export type PlanRestaurant = {
  cle: string;
  negligent: boolean;
  corps: {
    nom: string;
    ville: string;
    cuisine: string;
    adresse: string;
    description: string;
    capacite: number;
    delaiAnnulationHeures: number | null;
    creeLe: string;
    plats: {
      nom: string;
      description: string;
      categorie: Categorie;
      prixCentimes: number;
      allergenes?: Allergene[];
    }[];
    horaires: { jourSemaine: number; debut: string; fin: string }[];
    contacts: { nom: string; email: string; role: "GERANT" | "CHEF_DE_SALLE" }[];
  };
};

export type PlanDineur = {
  persona: boolean;
  corps: { nom: string; email: string; creeLe: string };
};

export type PlanReservation = {
  cle: string;
  restaurant: string;
  corps: {
    dineurEmail: string;
    jour: string;
    creneau: string;
    couverts: number;
    statut: "CONFIRMEE" | "ANNULEE" | "HONOREE" | "NO_SHOW";
    couvertsServis?: number;
    signaleeLe?: string;
    creeLe: string;
  };
};

export type PlanEtape =
  | { type: "PRISE_EN_CHARGE"; par: string; le: string }
  | { type: "COMPLEMENT"; par: string; le: string; message: string }
  | {
      type: "DECISION";
      par: string;
      le: string;
      issue: "ACCORDE" | "PARTIEL" | "REFUSE" | "ESCALADE";
      montantAccordeCentimes?: number;
      imputation?: "THESPOON" | "CLIENT";
      motif: string;
    };

export type PlanDossier = {
  cle: string;
  restaurant: string;
  mois: string;
  contactEmail: string;
  lignes: { reservation: string; motif: string }[];
  montantCentimes: number;
  /** Sous le seuil supposé (cumul sur la facture) : crédité d'office au dépôt. */
  creditOffice: boolean;
  commentaire: string | null;
  deposeLe: string;
  etapes: PlanEtape[];
};

export type PlanAvis = {
  restaurant: string;
  corps: { dineurEmail: string; noteCuilleres: number; commentaire: string | null; creeLe: string };
};

export type Plan = {
  graine: number;
  genereLe: string;
  periode: { du: string; au: string };
  staff: PlanStaff[];
  restaurants: PlanRestaurant[];
  dineurs: PlanDineur[];
  reservations: PlanReservation[];
  avis: PlanAvis[];
  moisFactures: string[];
  dossiers: PlanDossier[];
};

// ---------------------------------------------------------------------------
// Paramètres du réalisme — tout ce qu'on voudrait régler est ici
// ---------------------------------------------------------------------------

/** Demande relative selon le jour (0 = lundi). */
const DEMANDE_JOUR = [0.55, 0.7, 0.8, 0.95, 1.25, 1.4, 0.9];
/** Le midi pèse moins que le soir, sauf le dimanche (brunch). */
const DEMANDE_MIDI = 0.65;
const DEMANDE_MIDI_DIMANCHE = 1.0;
/** Saison : Paris se vide en juillet-août, la côte se remplit. */
const SAISON: Record<string, Record<number, number>> = {
  Paris: { 4: 0.95, 5: 1.0, 6: 1.05, 7: 0.85, 8: 0.55, 9: 1.05, 10: 1.0 },
  Lyon: { 4: 0.95, 5: 1.0, 6: 1.05, 7: 0.85, 8: 0.7, 9: 1.05, 10: 1.0 },
  Lille: { 4: 0.95, 5: 1.0, 6: 1.0, 7: 0.85, 8: 0.7, 9: 1.05, 10: 1.0 },
  Bordeaux: { 4: 0.9, 5: 1.0, 6: 1.1, 7: 1.15, 8: 1.1, 9: 1.0, 10: 0.95 },
  Marseille: { 4: 0.9, 5: 1.0, 6: 1.15, 7: 1.25, 8: 1.2, 9: 1.0, 10: 0.95 },
  Nantes: { 4: 0.9, 5: 1.0, 6: 1.05, 7: 1.0, 8: 0.9, 9: 1.0, 10: 0.95 },
};
/** Croissance de la plateforme, par mois écoulé depuis le début de la période. */
const CROISSANCE_MENSUELLE = 0.025;
/** Un nouveau restaurant atteint son rythme en quatre semaines. */
const MONTEE_EN_CHARGE_JOURS = 28;

/** Taille des tables réservées. */
const TAILLES: readonly (readonly [number, number])[] = [
  [1, 4],
  [2, 48],
  [3, 12],
  [4, 22],
  [5, 6],
  [6, 8],
];

/** Poids des créneaux dans un service : on dîne à 20h, on déjeune à 12h30. */
const POIDS_CRENEAU: Record<string, number> = {
  "12:00": 3,
  "12:30": 4,
  "13:00": 3,
  "13:30": 1,
  "18:30": 1,
  "19:00": 2,
  "19:30": 4,
  "20:00": 5,
  "20:30": 5,
  "21:00": 3,
  "21:30": 2,
  "22:00": 1,
};

/** Formules d'horaires, avec leur fréquence. Les créneaux vont de 12h à 22h. */
type Formule = "classique" | "7/7" | "soir" | "semaine" | "brunch";

const FORMULES_HORAIRES: readonly (readonly [Formule, number])[] = [
  ["classique", 45],
  ["7/7", 20],
  ["soir", 15],
  ["semaine", 10],
  ["brunch", 10],
];

function horairesDeLaFormule(formule: Formule) {
  const midi = (j: number) => ({ jourSemaine: j, debut: "12:00", fin: "14:30" });
  const soir = (j: number) => ({ jourSemaine: j, debut: "19:00", fin: "22:30" });
  const jours = (...liste: number[]) => liste;
  switch (formule) {
    case "classique":
      return jours(1, 2, 3, 4, 5).flatMap((j) => [midi(j), soir(j)]);
    case "7/7":
      return jours(0, 1, 2, 3, 4, 5, 6).flatMap((j) => [
        midi(j),
        { jourSemaine: j, debut: "18:30", fin: "23:00" },
      ]);
    case "soir":
      return jours(0, 1, 2, 3, 4, 5).map((j) => ({ jourSemaine: j, debut: "19:00", fin: "23:30" }));
    case "semaine":
      return jours(0, 1, 2, 3, 4).flatMap((j) => [
        { jourSemaine: j, debut: "12:00", fin: "15:00" },
        soir(j),
      ]);
    case "brunch":
      return [
        ...jours(2, 3, 4, 5, 6).map((j) => ({ jourSemaine: j, debut: "12:00", fin: "15:00" })),
        ...jours(3, 4, 5).map(soir),
      ];
  }
}

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

// ---------------------------------------------------------------------------
// Génération
// ---------------------------------------------------------------------------

const sansAccents = (texte: string) =>
  texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const iso = (d: Date) => d.toISOString();
const plusTot = (a: Date, b: Date) => (a.getTime() < b.getTime() ? a : b);

type RestaurantInterne = PlanRestaurant & {
  arrivee: Date;
  plages: Plage[];
  demande: number;
  /** Note moyenne vers laquelle tendent ses avis. */
  qualite: number;
  capacite: number;
  contacts: { email: string; role: string }[];
};

type Dineur = { email: string; nom: string; ville: string; poids: number; persona: boolean };

export function genererJeu({ maintenant, graine }: { maintenant: Date; graine: number }): Plan {
  const alea = aleaSeme(graine);
  const aujourdhui = aujourdHuiIso(maintenant);
  // Six mois : du 1er du mois, cinq mois avant celui-ci, jusqu'à aujourd'hui
  // — plus les cinq jours réservables qui viennent.
  const du = `${moisAdjacent(moisIso(maintenant), -5)}-01`;
  const au = ajouterJours(aujourdhui, 5);
  const debut = instantLocalDeJour(du);

  // --- Staff : l'équipe est là avant l'historique qu'elle instruit.
  const staff: PlanStaff[] = STAFF.map((m, i) => ({
    ...m,
    creeLe: iso(new Date(debut.getTime() - (400 - i * 45) * JOUR_MS)),
  }));

  // --- Restaurants : 34 déjà partenaires au début de la période, 16 arrivés en cours de route.
  const indices = RESTAURANTS.map((_, i) => i);
  const arrivesEnCours = new Set([...indices].sort(() => alea.suivant() - 0.5).slice(0, 16));
  const joursPeriode = (maintenant.getTime() - debut.getTime()) / JOUR_MS;
  const negligents = new Set([...indices].sort(() => alea.suivant() - 0.5).slice(0, 3));

  const restaurants: RestaurantInterne[] = RESTAURANTS.map((fiche, i) => {
    const cuisine = CUISINES[fiche.cuisine]!;
    const arrivee = arrivesEnCours.has(i)
      ? // Plus d'arrivées au début qu'à la fin : la plateforme recrute, puis se remplit.
        new Date(
          debut.getTime() +
            Math.pow(alea.suivant(), 1.4) * (joursPeriode - 10) * JOUR_MS +
            alea.entre(9, 18) * HEURE_MS,
        )
      : new Date(debut.getTime() - alea.entre(20, 420) * JOUR_MS + alea.entre(9, 18) * HEURE_MS);
    const formule =
      fiche.cuisine === "Gastronomique" ? "classique" : alea.pondere(FORMULES_HORAIRES);
    const horaires = horairesDeLaFormule(formule);
    const declareAllergenes = alea.chance(0.7);
    const plats = [...cuisine.plats]
      .sort(() => alea.suivant() - 0.5)
      .slice(0, Math.min(cuisine.plats.length, alea.entier(5, 8)))
      .map((plat) => ({
        nom: plat.nom,
        description: plat.description,
        categorie: plat.categorie,
        // ±10 % autour du prix de référence, au demi-euro.
        prixCentimes: Math.round(plat.prix * alea.entre(0.9, 1.1) * 2) * 50,
        ...(declareAllergenes ? { allergenes: plat.allergenes } : {}),
      }));
    const slug = sansAccents(fiche.nom);
    const gerant = `${alea.parmi(PRENOMS)} ${alea.parmi(NOMS)}`;
    const contacts: PlanRestaurant["corps"]["contacts"] = [
      {
        nom: gerant,
        email: `${sansAccents(gerant.split(" ")[0]!)}@${slug}.example`,
        role: "GERANT",
      },
    ];
    if (alea.chance(0.4) || fiche.capacite >= 80) {
      const chef = `${alea.parmi(PRENOMS)} ${alea.parmi(NOMS)}`;
      let email = `${sansAccents(chef.split(" ")[0]!)}@${slug}.example`;
      if (email === contacts[0]!.email) email = `salle@${slug}.example`;
      contacts.push({ nom: chef, email, role: "CHEF_DE_SALLE" });
    }
    // Demande de base : quelques tables par service, très variable d'une
    // adresse à l'autre ; bornée par la taille de la salle.
    const demande = Math.min(Math.exp(Math.log(1.6) + 0.6 * alea.normale()), fiche.capacite / 9, 6);
    return {
      cle: `${fiche.nom}|${fiche.ville}`,
      negligent: negligents.has(i),
      arrivee,
      plages: horaires.map((h) => ({
        jourSemaine: h.jourSemaine,
        debutMinutes: minutes(h.debut),
        finMinutes: h.fin === "24:00" ? 1440 : minutes(h.fin),
      })),
      demande: Math.max(0.3, demande),
      // Les notes des plateformes penchent vers le haut ; un restaurant qui
      // soigne mal ses réservations le paie un peu dans ses avis.
      qualite: Math.min(
        4.8,
        Math.max(3.2, 4.2 + 0.35 * alea.normale() - (negligents.has(i) ? 0.4 : 0)),
      ),
      capacite: fiche.capacite,
      contacts,
      corps: {
        nom: fiche.nom,
        ville: fiche.ville,
        cuisine: fiche.cuisine === "Végétal" ? "Végé" : fiche.cuisine,
        adresse: fiche.adresse,
        description: alea.parmi(cuisine.descriptions),
        capacite: fiche.capacite,
        delaiAnnulationHeures: alea.pondere([
          [null, 50],
          [24, 30],
          [4, 12],
          [2, 8],
        ] as const),
        creeLe: iso(arrivee),
        plats,
        horaires,
        contacts,
      },
    };
  });

  // --- Dîneurs : un vivier par ville, à la mesure de ses restaurants.
  const nbParVille = new Map<string, number>();
  for (const r of restaurants)
    nbParVille.set(r.corps.ville, (nbParVille.get(r.corps.ville) ?? 0) + 1);
  const dineursParVille = new Map<string, Dineur[]>();
  const emailsPris = new Set<string>();
  const domaines = ["example.com", "example.org", "example.net"];
  for (const [ville, nb] of nbParVille) {
    const taille = Math.round(nb * 95);
    const vivier: Dineur[] = [];
    for (let rang = 1; rang <= taille; rang++) {
      const prenom = alea.parmi(PRENOMS);
      const nom = alea.parmi(NOMS);
      const base = `${sansAccents(prenom)}.${sansAccents(nom)}`;
      let email = `${base}@${alea.parmi(domaines)}`;
      for (let n = 2; emailsPris.has(email); n++) email = `${base}${n}@${alea.parmi(domaines)}`;
      emailsPris.add(email);
      // Loi de Zipf : quelques habitués, beaucoup de réservations uniques.
      vivier.push({
        email,
        nom: `${prenom} ${nom}`,
        ville,
        poids: 1 / Math.pow(rang, 0.85),
        persona: false,
      });
    }
    dineursParVille.set(ville, vivier);
  }
  const tirerDineur = (ville: string) => {
    const vivier = dineursParVille.get(ville)!;
    return alea.pondere(vivier.map((d) => [d, d.poids] as const));
  };

  // --- Réservations, jour par jour, service par service.
  const reservations: (PlanReservation & {
    date: Date;
    creeLeDate: Date;
    negligent: boolean;
    signaleeTard: boolean;
  })[] = [];
  const dejaReserveLeJour = new Set<string>(); // dîneur|jour : on ne dîne pas deux fois le même soir
  const premiereReservation = new Map<string, Date>();

  for (const r of restaurants) {
    const occupation = new Map<string, number>(); // jour|créneau → couverts
    for (let jour = du; jour <= au; jour = ajouterJours(jour, 1)) {
      const js = jourSemaineIso(jour);
      const moisNum = Number(jour.slice(5, 7));
      const saison = SAISON[r.corps.ville]?.[moisNum] ?? 1;
      const moisEcoules = (instantLocalDeJour(jour).getTime() - debut.getTime()) / (30 * JOUR_MS);
      const croissance = 1 + CROISSANCE_MENSUELLE * moisEcoules;
      const joursDepuisArrivee =
        (instantLocalDeJour(jour).getTime() - r.arrivee.getTime()) / JOUR_MS;
      if (joursDepuisArrivee < 1) continue;
      const montee = Math.min(1, 0.3 + (0.7 * joursDepuisArrivee) / MONTEE_EN_CHARGE_JOURS);

      for (const service of [CRENEAUX_MIDI, CRENEAUX_SOIR] as const) {
        const ouverts = service.filter((c) => creneauDansLesHoraires(r.plages, js, c));
        if (ouverts.length === 0) continue;
        const poidsService =
          service === CRENEAUX_MIDI ? (js === 6 ? DEMANDE_MIDI_DIMANCHE : DEMANDE_MIDI) : 1;
        const attendu = r.demande * DEMANDE_JOUR[js]! * poidsService * saison * croissance * montee;
        const nb = alea.poisson(attendu);

        for (let k = 0; k < nb; k++) {
          const creneau = alea.pondere(ouverts.map((c) => [c, POIDS_CRENEAU[c] ?? 1] as const));
          const [h, m] = creneau.split(":").map(Number) as [number, number];
          const date = instantLocalDeJour(jour, h, m);
          const couverts = alea.pondere(TAILLES);

          // Délai de réservation : un tiers le jour même, le reste dans les
          // cinq jours — la fiche restaurant n'en propose pas plus.
          const delai = alea.pondere([
            [alea.entre(1, 8) * HEURE_MS, 30],
            [alea.entre(12, 48) * HEURE_MS, 35],
            [alea.entre(48, 4.8 * 24) * HEURE_MS, 35],
          ] as const);
          let creeLe = new Date(date.getTime() - delai);
          if (creeLe.getTime() < r.arrivee.getTime())
            creeLe = new Date(r.arrivee.getTime() + alea.entre(0.2, 1) * HEURE_MS);
          // Une réservation future n'existe que si elle a déjà été prise.
          if (creeLe.getTime() >= maintenant.getTime() || creeLe.getTime() >= date.getTime())
            continue;

          const dineur = tirerDineur(r.corps.ville);
          const cleJour = `${dineur.email}|${jour}`;
          if (dejaReserveLeJour.has(cleJour)) continue;

          // Statut : ce qu'un restaurant aurait signalé.
          const passee = date.getTime() <= maintenant.getTime();
          let statut: PlanReservation["corps"]["statut"];
          if (!passee) {
            statut = alea.chance(0.07) ? "ANNULEE" : "CONFIRMEE";
          } else if (alea.chance(0.09 + (delai > 3 * JOUR_MS ? 0.04 : 0))) {
            statut = "ANNULEE";
          } else {
            const tropRecent = maintenant.getTime() - date.getTime() < 2 * JOUR_MS;
            const oublie = r.negligent ? alea.chance(0.18) : tropRecent && alea.chance(0.35);
            if (oublie) statut = "CONFIRMEE";
            else
              statut = alea.chance(
                0.04 + (couverts >= 5 ? 0.03 : 0) + (delai > 3 * JOUR_MS ? 0.02 : 0),
              )
                ? "NO_SHOW"
                : "HONOREE";
          }

          const occupe = statut !== "ANNULEE";
          const cleCreneau = `${jour}|${creneau}`;
          if (occupe && (occupation.get(cleCreneau) ?? 0) + couverts > r.capacite) continue;
          if (occupe) occupation.set(cleCreneau, (occupation.get(cleCreneau) ?? 0) + couverts);
          dejaReserveLeJour.add(cleJour);

          let couvertsServis: number | undefined;
          let signaleeLe: string | undefined;
          let signaleeTard = false;
          if (statut === "HONOREE" || statut === "NO_SHOW") {
            if (statut === "HONOREE") {
              couvertsServis = alea.pondere([
                [couverts, 88],
                [Math.max(1, couverts - 1), 7],
                [couverts + 1, 5],
              ] as const);
            }
            const apres = r.negligent
              ? alea.pondere([
                  [alea.entre(2, 6) * HEURE_MS, 30],
                  [alea.entre(3, 20) * JOUR_MS, 70],
                ] as const)
              : alea.pondere([
                  [alea.entre(1, 4) * HEURE_MS, 70],
                  [alea.entre(12, 30) * HEURE_MS, 20],
                  [alea.entre(2, 7) * JOUR_MS, 10],
                ] as const);
            signaleeTard = apres > 2 * JOUR_MS;
            signaleeLe = iso(plusTot(new Date(date.getTime() + apres), maintenant));
          }

          const avant = premiereReservation.get(dineur.email);
          if (!avant || creeLe.getTime() < avant.getTime())
            premiereReservation.set(dineur.email, creeLe);

          reservations.push({
            cle: `${r.cle}|${dineur.email}|${iso(date)}`,
            restaurant: r.cle,
            date,
            creeLeDate: creeLe,
            negligent: r.negligent,
            signaleeTard,
            corps: {
              dineurEmail: dineur.email,
              jour,
              creneau,
              couverts,
              statut,
              ...(couvertsServis !== undefined ? { couvertsServis } : {}),
              ...(signaleeLe ? { signaleeLe } : {}),
              creeLe: iso(creeLe),
            },
          });
        }
      }
    }
  }
  reservations.sort((a, b) => a.date.getTime() - b.date.getTime());

  // --- Dîneurs : inscrits avant leur première réservation ; 12 % de
  // comptes dormants, inscrits sans jamais réserver.
  const plancherInscription = new Date(debut.getTime() - 300 * JOUR_MS);
  const dineurs: PlanDineur[] = [];
  const comptes = new Map<string, number>();
  for (const res of reservations)
    comptes.set(res.corps.dineurEmail, (comptes.get(res.corps.dineurEmail) ?? 0) + 1);
  // Personas : les habitués les plus fidèles de chaque ville, dont on garde
  // les identifiants pour se connecter en formation.
  const personas = new Set<string>();
  for (const [ville, vivier] of dineursParVille) {
    const tries = vivier
      .filter((d) => comptes.has(d.email))
      .sort((a, b) => comptes.get(b.email)! - comptes.get(a.email)!);
    for (const d of tries.slice(0, ville === "Paris" ? 6 : 1)) personas.add(d.email);
  }
  for (const vivier of dineursParVille.values()) {
    for (const d of vivier) {
      const premiere = premiereReservation.get(d.email);
      let creeLe: Date;
      if (premiere) {
        const recul = alea.chance(0.35)
          ? alea.entre(0.02, 1) * HEURE_MS
          : alea.entre(1, 200) * JOUR_MS;
        creeLe = new Date(Math.max(plancherInscription.getTime(), premiere.getTime() - recul));
        if (creeLe.getTime() >= premiere.getTime())
          creeLe = new Date(premiere.getTime() - 10 * 60 * 1000);
      } else {
        if (!alea.chance(0.14)) continue; // pas tout le vivier : les dormants restent minoritaires
        creeLe = new Date(debut.getTime() + alea.suivant() * joursPeriode * JOUR_MS);
      }
      dineurs.push({
        persona: personas.has(d.email),
        corps: { nom: d.nom, email: d.email, creeLe: iso(creeLe) },
      });
    }
  }

  // --- Avis : une minorité de dîneurs servis en laisse un, le plus souvent
  // le soir même ou le lendemain. Un seul par dîneur et par restaurant.
  const avis = genererAvis({ alea, maintenant, restaurants, reservations });

  // --- Factures : chaque mois terminé de la période.
  const moisFactures: string[] = [];
  for (let m = du.slice(0, 7); m < moisIso(maintenant); m = moisAdjacent(m, 1))
    moisFactures.push(m);

  // --- Litiges.
  const dossiers = genererDossiers({
    alea,
    maintenant,
    restaurants,
    reservations,
    moisFactures,
    staff,
  });

  return {
    graine,
    genereLe: iso(maintenant),
    periode: { du, au },
    staff,
    restaurants: restaurants.map(({ cle, negligent, corps }) => ({ cle, negligent, corps })),
    dineurs,
    reservations: reservations.map(({ cle, restaurant, corps }) => ({ cle, restaurant, corps })),
    avis,
    moisFactures,
    dossiers,
  };
}

// ---------------------------------------------------------------------------
// Litiges
// ---------------------------------------------------------------------------

/** Seuil de crédit d'office par défaut (20 €) — voir SEUIL_CREDIT_OFFICE_PAR_DEFAUT_CENTIMES. */
export const SEUIL_SUPPOSE_CENTIMES = 2000;
const COMMISSION_CENTIMES = 250;

const MOTIFS: readonly (readonly [string, number])[] = [
  ["NO_SHOW", 35],
  ["COUVERTS_SURCOMPTES", 25],
  ["ANNULATION_TARDIVE", 15],
  ["DOUBLON", 10],
  ["HORS_PLATEFORME", 10],
  ["AUTRE", 5],
];

const COMMENTAIRES: Record<string, string[]> = {
  NO_SHOW: [
    "Ces clients ne se sont jamais présentés, le signalement a été fait par erreur par un extra.",
    "Table restée vide toute la soirée, nous avons mal cliqué au moment du signalement.",
    "Aucune de ces réservations n'a été honorée, voir notre cahier de salle.",
  ],
  COUVERTS_SURCOMPTES: [
    "La table était de deux personnes, pas de quatre.",
    "Nous avons servi moins de couverts que ce qui est facturé.",
    "Erreur de saisie sur le nombre de couverts servis.",
  ],
  ANNULATION_TARDIVE: [
    "Le client a annulé par téléphone le jour même, nous n'avons pas pu relouer la table.",
    "Annulation reçue une heure avant le service.",
  ],
  DOUBLON: [
    "Le même client apparaît deux fois pour le même service.",
    "Réservation en double, une seule table a été occupée.",
  ],
  HORS_PLATEFORME: [
    "Ce client avait réservé directement chez nous par téléphone.",
    "Habitué de la maison, la réservation ne vient pas de TheSpoon.",
  ],
  AUTRE: ["Merci de vérifier ces lignes, elles ne correspondent pas à notre planning."],
};

const COMPLEMENTS = [
  "Pouvez-vous nous transmettre le cahier de réservations du service concerné ?",
  "Merci de joindre une capture de votre planning de salle pour ces dates.",
  "Pouvez-vous préciser l'heure à laquelle le client vous a prévenu ?",
  "Avez-vous une trace de la réservation prise en direct (téléphone, email) ?",
];

const MOTIFS_DECISION = {
  ACCORDE: [
    "Contestation fondée, les lignes sont créditées.",
    "Vérification faite avec le dîneur : la réservation n'a pas eu lieu.",
    "Pièces reçues et cohérentes, avoir émis.",
  ],
  PARTIEL: [
    "Une partie des lignes est justifiée, le reste correspond à des services honorés.",
    "Écart de couverts confirmé sur une table seulement.",
  ],
  REFUSE: [
    "Le signalement a été fait le soir même et rien ne vient le contredire.",
    "Réservation bien passée par TheSpoon, la commission est due.",
    "Aucun élément transmis à l'appui de la contestation.",
  ],
  ESCALADE: [
    "Volume inhabituel pour ce partenaire, je passe la main.",
    "Cas limite sur la politique d'annulation, à trancher par le responsable.",
  ],
} as const;

function genererDossiers({
  alea,
  maintenant,
  restaurants,
  reservations,
  moisFactures,
  staff,
}: {
  alea: Alea;
  maintenant: Date;
  restaurants: RestaurantInterne[];
  reservations: (PlanReservation & { date: Date; negligent: boolean; signaleeTard: boolean })[];
  moisFactures: string[];
  staff: PlanStaff[];
}): PlanDossier[] {
  const instructeurs = [staff[0]!, staff[1]!, staff[2]!];
  const responsable = staff[3]!;
  const dossiers: PlanDossier[] = [];
  const dernierMois = moisFactures[moisFactures.length - 1];

  // Lignes facturées : les réservations honorées, par restaurant et par mois.
  const facturees = new Map<string, typeof reservations>();
  for (const res of reservations) {
    if (res.corps.statut !== "HONOREE") continue;
    const cle = `${res.restaurant}|${res.corps.jour.slice(0, 7)}`;
    (facturees.get(cle) ?? facturees.set(cle, []).get(cle)!).push(res);
  }

  for (const r of restaurants) {
    for (const mois of moisFactures) {
      const lignes = facturees.get(`${r.cle}|${mois}`);
      if (!lignes || lignes.length === 0) continue;
      // Les restaurants qui signalent mal contestent plus souvent.
      // Un restaurant sur six conteste une facture donnée ; ceux qui signalent
      // mal, presque une fois sur deux.
      // La dernière facture vient d'arriver : c'est elle qu'on relit.
      const recent = mois === moisFactures[moisFactures.length - 1];
      if (!alea.chance(r.negligent ? 0.5 : recent ? 0.35 : 0.17)) continue;
      const emission = instantLocalDeJour(`${moisAdjacent(mois, 1)}-01`, 6);
      const restantes = [...lignes];
      let cumul = 0;
      const nbDossiers = alea.chance(0.15) ? 2 : 1;
      let deposePrecedent = emission;

      for (let n = 0; n < nbDossiers; n++) {
        const motif = alea.pondere(MOTIFS);
        // On conteste rarement une seule table : le restaurant relit sa facture
        // en fin de mois et relève tout ce qui cloche d'un coup.
        const nbLignes = alea.pondere([
          [1, 25],
          [alea.entier(2, 3), 35],
          [alea.entier(4, 7), 28],
          [alea.entier(8, 14), 12],
        ] as const);
        // Un no-show contesté porte d'abord sur les signalements tardifs.
        const candidates =
          motif === "NO_SHOW"
            ? [...restantes].sort((a, b) => Number(b.signaleeTard) - Number(a.signaleeTard))
            : restantes;
        const choisies = (
          motif === "NO_SHOW" ? candidates : [...candidates].sort(() => alea.suivant() - 0.5)
        ).slice(0, nbLignes);
        if (choisies.length === 0) break;
        for (const c of choisies) restantes.splice(restantes.indexOf(c), 1);
        const montant = choisies.reduce(
          (s, c) => s + (c.corps.couvertsServis ?? c.corps.couverts) * COMMISSION_CENTIMES,
          0,
        );

        const deposeLe = new Date(
          Math.max(
            deposePrecedent.getTime() + HEURE_MS,
            emission.getTime() + alea.entre(1, 26) * JOUR_MS + alea.entre(8, 19) * HEURE_MS,
          ),
        );
        if (deposeLe.getTime() >= maintenant.getTime() - HEURE_MS) break;
        if (deposeLe.getTime() > emission.getTime() + 29 * JOUR_MS) break;
        deposePrecedent = deposeLe;
        cumul += montant;

        const creditOffice = cumul < SEUIL_SUPPOSE_CENTIMES;
        const etapes = creditOffice
          ? []
          : genererInstruction({
              alea,
              maintenant,
              deposeLe,
              montant,
              instructeurs,
              responsable,
              recent: mois === dernierMois,
            });
        const contact = r.contacts.find((c) => c.role === "GERANT") ?? r.contacts[0]!;

        dossiers.push({
          cle: `${r.cle}|${mois}|${n}`,
          restaurant: r.cle,
          mois,
          contactEmail: contact.email,
          lignes: choisies.map((c) => ({ reservation: c.cle, motif })),
          montantCentimes: montant,
          creditOffice,
          commentaire: alea.chance(0.8) ? alea.parmi(COMMENTAIRES[motif]!) : null,
          deposeLe: iso(deposeLe),
          etapes,
        });
      }
    }
  }
  return dossiers;
}

function genererInstruction({
  alea,
  maintenant,
  deposeLe,
  montant,
  instructeurs,
  responsable,
  recent,
}: {
  alea: Alea;
  maintenant: Date;
  deposeLe: Date;
  montant: number;
  instructeurs: PlanStaff[];
  responsable: PlanStaff;
  recent: boolean;
}): PlanEtape[] {
  // Le dernier mois facturé est encore en cours : une partie des dossiers
  // attend dans la file, prise en charge ou non.
  const avancement = recent
    ? alea.pondere([
        ["file", 30],
        ["pris", 25],
        ["complement", 25],
        ["tranche", 20],
      ] as const)
    : "tranche";
  if (avancement === "file") return [];

  const etapes: PlanEtape[] = [];
  const instructeur = alea.pondere([
    [instructeurs[0]!, 45],
    [instructeurs[1]!, 35],
    [instructeurs[2]!, 20],
  ] as const);
  let t = deposeLe.getTime();
  const avancer = (min: number, max: number) => {
    t += alea.entre(min, max) * JOUR_MS;
    return t < maintenant.getTime() - HEURE_MS;
  };

  if (!avancer(0.3, 4)) return etapes;
  etapes.push({ type: "PRISE_EN_CHARGE", par: instructeur.email, le: iso(new Date(t)) });
  if (avancement === "pris") return etapes;

  if (avancement === "complement" || alea.chance(0.3)) {
    if (!avancer(0.2, 3)) return etapes;
    etapes.push({
      type: "COMPLEMENT",
      par: instructeur.email,
      le: iso(new Date(t)),
      message: alea.parmi(COMPLEMENTS),
    });
    if (avancement === "complement") return etapes;
  }

  const issue = alea.pondere([
    ["ACCORDE", 32],
    ["PARTIEL", 23],
    ["REFUSE", 33],
    ["ESCALADE", 12],
  ] as const);
  const decision = (par: string, choix: "ACCORDE" | "PARTIEL" | "REFUSE"): PlanEtape => {
    const partielPossible = montant >= 2 * 50;
    const issueFinale = choix === "PARTIEL" && !partielPossible ? "ACCORDE" : choix;
    return {
      type: "DECISION",
      par,
      le: iso(new Date(t)),
      issue: issueFinale,
      ...(issueFinale === "PARTIEL"
        ? {
            montantAccordeCentimes: Math.max(
              50,
              Math.min(montant - 50, Math.round((montant * alea.entre(0.3, 0.8)) / 50) * 50),
            ),
          }
        : {}),
      ...(issueFinale === "ACCORDE" || issueFinale === "PARTIEL"
        ? { imputation: alea.chance(0.55) ? "THESPOON" : "CLIENT" }
        : {}),
      motif: alea.parmi(MOTIFS_DECISION[issueFinale]),
    } as PlanEtape;
  };

  if (!avancer(1, 8)) return etapes;
  if (issue === "ESCALADE") {
    etapes.push({
      type: "DECISION",
      par: instructeur.email,
      le: iso(new Date(t)),
      issue: "ESCALADE",
      motif: alea.parmi(MOTIFS_DECISION.ESCALADE),
    });
    if (!avancer(2, 7)) return etapes;
    etapes.push(
      decision(
        responsable.email,
        alea.pondere([
          ["ACCORDE", 35],
          ["PARTIEL", 35],
          ["REFUSE", 30],
        ] as const),
      ),
    );
  } else {
    etapes.push(decision(instructeur.email, issue));
  }
  return etapes;
}

// ---------------------------------------------------------------------------
// Avis
// ---------------------------------------------------------------------------

const TAUX_AVIS = 0.14;

/**
 * Tournures indépendantes du genre du plat (« la burrata », « le risotto ») :
 * le nom du plat n'est jamais accordé, seulement cité.
 */
const COMMENTAIRES_AVIS: Record<"excellent" | "bon" | "moyen" | "decu", string[]> = {
  excellent: [
    "Mention spéciale pour : {plat}. Service aux petits soins, on reviendra.",
    "Une vraie adresse. {plat} : rien à redire, et une équipe adorable.",
    "Coup de cœur : {plat}. Ambiance chaleureuse.",
    "Tout était parfait, de l'entrée au dessert.",
  ],
  bon: [
    "Très bon moment, mention pour : {plat}. Un peu d'attente entre les plats.",
    "Bonne adresse, portions généreuses. Salle un peu bruyante le samedi.",
    "Cuisine soignée, rapport qualité-prix correct.",
    "Agréable soirée. À goûter : {plat}.",
  ],
  moyen: [
    "Correct sans plus. {plat} : un peu fade ce soir-là.",
    "Service lent ce soir-là, mais la cuisine était bonne.",
    "Un peu cher pour ce que c'est.",
  ],
  decu: [
    "Déçus : notre table n'était pas prête à l'heure réservée.",
    "Plats servis tièdes, service expéditif. Dommage.",
    "Réservation mal enregistrée, on a attendu vingt minutes au bar.",
  ],
};

function genererAvis({
  alea,
  maintenant,
  restaurants,
  reservations,
}: {
  alea: Alea;
  maintenant: Date;
  restaurants: RestaurantInterne[];
  reservations: (PlanReservation & { date: Date })[];
}): PlanAvis[] {
  const parCle = new Map(restaurants.map((r) => [r.cle, r]));
  const dejaDonne = new Set<string>();
  const avis: PlanAvis[] = [];
  for (const res of reservations) {
    if (res.corps.statut !== "HONOREE") continue;
    const paire = `${res.restaurant}|${res.corps.dineurEmail}`;
    if (dejaDonne.has(paire) || !alea.chance(TAUX_AVIS)) continue;
    const creeLe = new Date(
      res.date.getTime() +
        alea.pondere([
          [alea.entre(2, 20) * HEURE_MS, 55],
          [alea.entre(20, 48) * HEURE_MS, 30],
          [alea.entre(2, 10) * JOUR_MS, 15],
        ] as const),
    );
    if (creeLe.getTime() > maintenant.getTime() - HEURE_MS) continue;
    dejaDonne.add(paire);

    const r = parCle.get(res.restaurant)!;
    // Quelques soirées ratées, partout : une table oubliée, une heure d'attente.
    const incident = alea.chance(0.04);
    const note = incident
      ? alea.pondere([
          [1, 60],
          [2, 40],
        ] as const)
      : Math.min(5, Math.max(1, Math.round(r.qualite + 0.85 * alea.normale())));
    const plats = r.corps.plats.filter((p) => p.categorie === "PLAT");
    const plat = (plats.length ? alea.parmi(plats) : alea.parmi(r.corps.plats)).nom;
    const ton = note === 5 ? "excellent" : note === 4 ? "bon" : note === 3 ? "moyen" : "decu";
    // On écrit plus volontiers quand on a été déçu.
    const commente = alea.chance(ton === "decu" ? 0.9 : 0.6);
    const commentaire = commente
      ? alea
          .parmi(COMMENTAIRES_AVIS[ton])
          .replace("{plat}", plat)
          .replace(/^./, (c) => c.toUpperCase())
      : null;
    avis.push({
      restaurant: res.restaurant,
      corps: {
        dineurEmail: res.corps.dineurEmail,
        noteCuilleres: note,
        commentaire,
        creeLe: iso(creeLe),
      },
    });
  }
  return avis;
}

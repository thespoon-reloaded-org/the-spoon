/**
 * Jeu de formation TheSpoon — voir le README, « Jeu de formation ».
 *
 * ```bash
 * pnpm jeu-formation plan                 # génère plan.json et affiche son bilan
 * pnpm jeu-formation bilan                # relit le bilan d'un plan existant
 * pnpm jeu-formation injecter pilote      # 3 restaurants, pour vérifier le rendu
 * pnpm jeu-formation injecter tout        # le reste — reprend là où il s'est arrêté
 * ```
 *
 * Variables : `JEU_FORMATION_DOSSIER` (plan, état et identifiants — hors du
 * dépôt : les identifiants sont des mots de passe), `API_URL` (par défaut
 * http://localhost:3100), `ADMIN_API_TOKEN`, `JEU_FORMATION_GRAINE`.
 *
 * L'injection écrit dans la base derrière `API_URL`, sans retour arrière : un
 * lot envoyé mais dont la réponse s'est perdue bloque la reprise plutôt que
 * de risquer un doublon — voir `envoyerUneFois`.
 */
import "dotenv/config";

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";

import { genererJeu, SEUIL_SUPPOSE_CENTIMES, type Plan, type PlanDossier } from "./generer";

const DOSSIER = path.resolve(process.env.JEU_FORMATION_DOSSIER ?? ".jeu-formation");
const API_URL = (process.env.API_URL ?? "http://localhost:3100").replace(/\/$/, "");
const GRAINE = Number(process.env.JEU_FORMATION_GRAINE ?? 20260924);
const FICHIER_PLAN = path.join(DOSSIER, "plan.json");
const FICHIER_ETAT = path.join(DOSSIER, "etat.json");
const FICHIER_IDENTIFIANTS = path.join(DOSSIER, "identifiants.csv");

const LOT_RESTAURANTS = 10;
const LOT_DINEURS = 50;
const LOT_RESERVATIONS = 500;
const NB_PILOTES = 3;
const AGE_MAX_PLAN_HEURES = 12;

// ---------------------------------------------------------------------------
// Bilan
// ---------------------------------------------------------------------------

function bilan(plan: Plan) {
  const res = plan.reservations;
  const parStatut = compter(res.map((r) => r.corps.statut));
  const facturees = res.filter((r) => r.corps.statut === "HONOREE");
  const parMois = new Map<string, { resas: number; couverts: number }>();
  for (const r of facturees) {
    const m = r.corps.jour.slice(0, 7);
    const e = parMois.get(m) ?? { resas: 0, couverts: 0 };
    e.resas++;
    e.couverts += r.corps.couvertsServis ?? r.corps.couverts;
    parMois.set(m, e);
  }
  const villes = compter(plan.restaurants.map((r) => r.corps.ville));
  const etatDossier = (d: PlanDossier) => {
    const derniere = d.etapes[d.etapes.length - 1];
    if (d.etapes.length === 0) return d.creditOffice ? "crédité d'office" : "en file d'instruction";
    if (derniere?.type === "DECISION" && derniere.issue !== "ESCALADE")
      return `tranché : ${derniere.issue}`;
    if (derniere?.type === "DECISION") return "escaladé";
    return derniere?.type === "COMPLEMENT" ? "complément demandé" : "pris en charge";
  };

  console.log(
    `Période : ${plan.periode.du} → ${plan.periode.au} (plan du ${plan.genereLe}, graine ${plan.graine})`,
  );
  console.log(
    `Restaurants : ${plan.restaurants.length} — ${[...villes].map(([v, n]) => `${v} ${n}`).join(", ")}`,
  );
  console.log(
    `  dont arrivés pendant la période : ${plan.restaurants.filter((r) => r.corps.creeLe >= plan.periode.du).length}`,
  );
  console.log(
    `  dont signalant mal : ${plan.restaurants
      .filter((r) => r.negligent)
      .map((r) => r.corps.nom)
      .join(", ")}`,
  );
  console.log(`  contacts : ${plan.restaurants.reduce((s, r) => s + r.corps.contacts.length, 0)}`);
  console.log(`Staff : ${plan.staff.length}`);
  console.log(
    `Dîneurs : ${plan.dineurs.length} (dont ${plan.dineurs.filter((d) => d.persona).length} personas)`,
  );
  console.log(
    `Réservations : ${res.length} — ${[...parStatut].map(([s, n]) => `${s} ${n} (${pct(n, res.length)})`).join(", ")}`,
  );
  console.log("Facturé par mois (réservations honorées, couverts, commission) :");
  for (const [m, e] of [...parMois].sort()) {
    const facture = plan.moisFactures.includes(m) ? "" : "  — mois en cours, pas encore facturé";
    console.log(
      `  ${m} : ${e.resas} résas, ${e.couverts} couverts, ${(e.couverts * 2.5).toLocaleString("fr-FR")} €${facture}`,
    );
  }
  const notes = plan.avis.map((a) => a.corps.noteCuilleres);
  const moyenne = notes.reduce((a, b) => a + b, 0) / Math.max(1, notes.length);
  console.log(
    `Avis : ${plan.avis.length}, note moyenne ${moyenne.toFixed(2)} — ${[5, 4, 3, 2, 1].map((n) => `${n}★ ${pct(notes.filter((x) => x === n).length, notes.length)}`).join(", ")}`,
  );
  console.log(`Litiges : ${plan.dossiers.length}`);
  for (const [etat, n] of compter(plan.dossiers.map(etatDossier))) console.log(`  ${etat} : ${n}`);
  const montants = plan.dossiers.map((d) => d.montantCentimes / 100).sort((a, b) => a - b);
  if (montants.length)
    console.log(
      `  montants contestés : de ${montants[0]} € à ${montants[montants.length - 1]} €, médiane ${montants[Math.floor(montants.length / 2)]} €`,
    );
}

function compter<T>(valeurs: T[]) {
  const m = new Map<T, number>();
  for (const v of valeurs) m.set(v, (m.get(v) ?? 0) + 1);
  return new Map([...m].sort((a, b) => b[1] - a[1]));
}
const pct = (n: number, total: number) => `${Math.round((100 * n) / total)} %`;

// ---------------------------------------------------------------------------
// Appels à l'API
// ---------------------------------------------------------------------------

class RefusApi extends Error {
  constructor(
    readonly statut: number,
    readonly corps: { erreur?: string; details?: unknown },
  ) {
    super(
      `${statut} ${corps.erreur ?? ""} ${corps.details ? JSON.stringify(corps.details).slice(0, 1500) : ""}`,
    );
  }
}

async function api<T>(methode: "GET" | "POST", chemin: string, corps?: unknown): Promise<T> {
  const jeton = process.env.ADMIN_API_TOKEN;
  if (!jeton) throw new Error("ADMIN_API_TOKEN est requis.");
  const reponse = await fetch(`${API_URL}${chemin}`, {
    method: methode,
    headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const json = await reponse
    .json()
    .catch(() => ({ erreur: `réponse illisible (${reponse.status})` }));
  if (!reponse.ok) throw new RefusApi(reponse.status, json);
  return json as T;
}

// ---------------------------------------------------------------------------
// État de l'injection
// ---------------------------------------------------------------------------

type Etat = {
  api: string;
  graine: number;
  staff: string[];
  restaurants: Record<string, { id: string; contacts: Record<string, string> }>;
  dineurs: string[];
  /** Lots envoyés : `true` confirmé, `false` envoyé sans réponse. */
  lots: Record<string, boolean>;
  /** Réservation du plan → id en base. */
  reservations: Record<string, string>;
  factures: string[];
  /** Avis déjà en base, par `restaurant|dineurEmail`. */
  avis: string[];
  dossiers: Record<string, string>;
};

function lireEtat(plan: Plan): Etat {
  if (!existsSync(FICHIER_ETAT)) {
    return {
      api: API_URL,
      graine: plan.graine,
      staff: [],
      avis: [],
      restaurants: {},
      dineurs: [],
      lots: {},
      reservations: {},
      factures: [],
      dossiers: {},
    };
  }
  const etat = JSON.parse(readFileSync(FICHIER_ETAT, "utf8")) as Etat;
  if (etat.api !== API_URL)
    throw new Error(
      `L'état en cours vise ${etat.api}, pas ${API_URL}. Changer de JEU_FORMATION_DOSSIER.`,
    );
  if (etat.graine !== plan.graine)
    throw new Error("L'état en cours a été produit par un autre plan.");
  return etat;
}

function sauver(etat: Etat) {
  writeFileSync(FICHIER_ETAT, JSON.stringify(etat, null, 1));
}

/**
 * Envoie un lot une seule fois. Marqué « envoyé » avant l'appel, « confirmé »
 * après : un lot resté « envoyé » (coupure, délai dépassé) a peut-être été
 * écrit — le renvoyer risquerait un doublon impossible à supprimer. On
 * s'arrête et on laisse vérifier à la main.
 */
async function envoyerUneFois<T>(
  etat: Etat,
  cle: string,
  appel: () => Promise<T>,
): Promise<T | null> {
  if (etat.lots[cle] === true) return null;
  if (etat.lots[cle] === false) {
    throw new Error(
      `Le lot « ${cle} » a été envoyé sans réponse lors d'un passage précédent : vérifier en base s'il a été écrit, puis le marquer à true (écrit) ou le retirer (pas écrit) dans ${FICHIER_ETAT}.`,
    );
  }
  etat.lots[cle] = false;
  sauver(etat);
  try {
    const resultat = await appel();
    etat.lots[cle] = true;
    sauver(etat);
    return resultat;
  } catch (erreur) {
    // Seul un refus de l'API elle-même (4xx) garantit que rien n'a été écrit
    // (tout-ou-rien). Un 5xx — passerelle Netlify en délai dépassé, fonction
    // coupée — peut suivre une écriture déjà commitée : le lot reste marqué.
    if (erreur instanceof RefusApi && erreur.statut >= 400 && erreur.statut < 500) {
      delete etat.lots[cle];
      sauver(etat);
    }
    throw erreur;
  }
}

function noterIdentifiant(
  univers: string,
  nom: string,
  email: string,
  motDePasse: string | undefined,
  contexte = "",
) {
  if (!motDePasse) return;
  if (!existsSync(FICHIER_IDENTIFIANTS)) {
    writeFileSync(FICHIER_IDENTIFIANTS, "univers;nom;email;mot_de_passe;contexte\n");
    chmodSync(FICHIER_IDENTIFIANTS, 0o600);
  }
  appendFileSync(FICHIER_IDENTIFIANTS, `${univers};${nom};${email};${motDePasse};${contexte}\n`);
}

// ---------------------------------------------------------------------------
// Injection
// ---------------------------------------------------------------------------

/** Le pilote : trois restaurants parisiens qui ont des litiges, dont un qui signale mal. */
function restaurantsPilotes(plan: Plan): string[] {
  const litiges = compter(plan.dossiers.map((d) => d.restaurant));
  const parisiens = plan.restaurants.filter((r) => r.corps.ville === "Paris");
  const avecLitiges = parisiens.filter((r) => litiges.has(r.cle));
  const negligent = avecLitiges.find((r) => r.negligent);
  const autres = avecLitiges
    .filter((r) => !r.negligent)
    .sort((a, b) => litiges.get(b.cle)! - litiges.get(a.cle)!);
  return [...(negligent ? [negligent] : []), ...autres].slice(0, NB_PILOTES).map((r) => r.cle);
}

async function injecter(plan: Plan, lot: "pilote" | "tout") {
  const etat = lireEtat(plan);
  const perimetre = new Set(
    lot === "pilote" ? restaurantsPilotes(plan) : plan.restaurants.map((r) => r.cle),
  );
  console.log(`Injection « ${lot} » vers ${API_URL} : ${perimetre.size} restaurants.`);

  // Le plan fige « maintenant » : injecté longtemps après, l'historique
  // s'arrête à sa date — plus de réservations à venir, des « à venir »
  // devenues passées sans signalement. Pilote et reste s'injectent le même jour.
  const ageHeures = (Date.now() - new Date(plan.genereLe).getTime()) / 3_600_000;
  if (ageHeures > AGE_MAX_PLAN_HEURES && process.env.JEU_FORMATION_PLAN_ANCIEN !== "1") {
    throw new Error(
      Object.keys(etat.restaurants).length === 0
        ? `Plan vieux de ${Math.round(ageHeures)} h : le régénérer (« pnpm jeu-formation plan ») avant d'injecter.`
        : `Plan vieux de ${Math.round(ageHeures)} h, et déjà en partie injecté : le reste de l'historique s'arrêtera au ${plan.genereLe.slice(0, 10)}. Relancer avec JEU_FORMATION_PLAN_ANCIEN=1 pour l'accepter.`,
    );
  }

  // Le plan a décidé quels litiges sont crédités d'office avec un seuil
  // supposé ; un autre seuil en base laisserait des litiges d'avril en file.
  const sommaire = await api<{ seuilCreditOfficeCentimes: number }>("GET", "/api/admin");
  if (sommaire.seuilCreditOfficeCentimes !== SEUIL_SUPPOSE_CENTIMES) {
    throw new Error(
      `Seuil de crédit d'office en base : ${sommaire.seuilCreditOfficeCentimes / 100} €, le plan suppose ${SEUIL_SUPPOSE_CENTIMES / 100} €. Ajuster SEUIL_SUPPOSE_CENTIMES (generer.ts) et régénérer le plan.`,
    );
  }

  // 1. Staff
  const staffAFaire = plan.staff.filter((m) => !etat.staff.includes(m.email));
  if (staffAFaire.length) {
    try {
      const { crees } = await api<{ crees: { email: string; motDePasseGenere?: string }[] }>(
        "POST",
        "/api/admin/staff",
        staffAFaire,
      );
      for (const c of crees)
        noterIdentifiant(
          "staff",
          plan.staff.find((m) => m.email === c.email)!.nom,
          c.email,
          c.motDePasseGenere,
        );
    } catch (erreur) {
      // Déjà là (reprise) : c'est ce qu'on voulait.
      if (!(erreur instanceof RefusApi && erreur.statut === 409)) throw erreur;
    }
    etat.staff.push(...staffAFaire.map((m) => m.email));
    sauver(etat);
    console.log(`  staff : ${staffAFaire.length}`);
  }

  // 2. Restaurants — ceux déjà en base (même nom, même ville) sont repris, jamais recréés.
  const { restaurants: enBase } = await api<{
    restaurants: {
      id: string;
      nom: string;
      ville: string;
      contacts: { id: string; email: string }[];
    }[];
  }>("GET", "/api/admin/restaurants");
  const aCreer = plan.restaurants.filter((r) => perimetre.has(r.cle) && !etat.restaurants[r.cle]);
  for (const r of aCreer) {
    const existant = enBase.find((e) => `${e.nom}|${e.ville}` === r.cle);
    if (existant) {
      etat.restaurants[r.cle] = {
        id: existant.id,
        contacts: Object.fromEntries(existant.contacts.map((c) => [c.email, c.id])),
      };
    }
  }
  const restantsACreer = aCreer.filter((r) => !etat.restaurants[r.cle]);
  for (let i = 0; i < restantsACreer.length; i += LOT_RESTAURANTS) {
    const tranche = restantsACreer.slice(i, i + LOT_RESTAURANTS);
    const reponse = await envoyerUneFois(
      etat,
      `restaurants:${tranche.map((r) => r.cle).join(",")}`,
      () =>
        api<{
          crees: {
            id: string;
            nom: string;
            ville: string;
            contacts: { id: string; email: string; motDePasseGenere?: string }[];
          }[];
        }>(
          "POST",
          "/api/admin/restaurants",
          tranche.map((r) => r.corps),
        ),
    );
    for (const c of reponse?.crees ?? []) {
      const cle = `${c.nom}|${c.ville}`;
      etat.restaurants[cle] = {
        id: c.id,
        contacts: Object.fromEntries(c.contacts.map((k) => [k.email, k.id])),
      };
      for (const k of c.contacts) {
        const nom = plan.restaurants
          .find((r) => r.cle === cle)!
          .corps.contacts.find((x) => x.email === k.email)!.nom;
        noterIdentifiant("restaurant", nom, k.email, k.motDePasseGenere, c.nom);
      }
    }
    sauver(etat);
  }
  console.log(
    `  restaurants : ${restantsACreer.length} créés, ${aCreer.length - restantsACreer.length} repris`,
  );

  // 3. Dîneurs — ceux du périmètre, plus les dormants et les personas avec le lot complet.
  const reservations = plan.reservations.filter((r) => perimetre.has(r.restaurant));
  const utiles = new Set(reservations.map((r) => r.corps.dineurEmail));
  const dejaCrees = new Set(etat.dineurs);
  const dineurs = plan.dineurs.filter(
    (d) => !dejaCrees.has(d.corps.email) && (lot === "tout" || utiles.has(d.corps.email)),
  );
  for (let i = 0; i < dineurs.length; i += LOT_DINEURS) {
    const tranche = dineurs.slice(i, i + LOT_DINEURS);
    try {
      const reponse = await api<{ crees: { email: string; motDePasseGenere?: string }[] }>(
        "POST",
        "/api/admin/dineurs",
        tranche.map((d) => d.corps),
      );
      for (const c of reponse.crees) {
        const d = tranche.find((x) => x.corps.email === c.email)!;
        if (d.persona)
          noterIdentifiant("dineur", d.corps.nom, c.email, c.motDePasseGenere, "persona");
      }
    } catch (erreur) {
      // Un lot déjà écrit (reprise après coupure) répond 409 : ses dîneurs existent.
      if (!(erreur instanceof RefusApi && erreur.statut === 409)) throw erreur;
      const details = (erreur.corps.details ?? []) as { element: number }[];
      if (details.length !== tranche.length) throw erreur;
    }
    etat.dineurs.push(...tranche.map((d) => d.corps.email));
    sauver(etat);
    process.stdout.write(
      `\r  dîneurs : ${Math.min(i + LOT_DINEURS, dineurs.length)}/${dineurs.length}`,
    );
  }
  if (dineurs.length) process.stdout.write("\n");

  // 4. Réservations, dans l'ordre chronologique.
  const aReserver = reservations.filter((r) => !etat.reservations[r.cle]);
  for (let i = 0; i < aReserver.length; i += LOT_RESERVATIONS) {
    const tranche = aReserver.slice(i, i + LOT_RESERVATIONS);
    const cleLot = `reservations:${tranche[0]!.cle}→${tranche[tranche.length - 1]!.cle}`;
    const reponse = await envoyerUneFois(etat, cleLot, () =>
      api<{ crees: { id: string; restaurantId: string; dineurEmail: string; date: string }[] }>(
        "POST",
        "/api/admin/reservations",
        tranche.map((r) => ({ restaurantId: etat.restaurants[r.restaurant]!.id, ...r.corps })),
      ),
    );
    const cleParId = new Map(Object.entries(etat.restaurants).map(([cle, r]) => [r.id, cle]));
    for (const c of reponse?.crees ?? []) {
      etat.reservations[
        `${cleParId.get(c.restaurantId)}|${c.dineurEmail}|${new Date(c.date).toISOString()}`
      ] = c.id;
    }
    sauver(etat);
    process.stdout.write(
      `\r  réservations : ${Math.min(i + LOT_RESERVATIONS, aReserver.length)}/${aReserver.length}`,
    );
  }
  if (aReserver.length) process.stdout.write("\n");

  // 5. Avis — après les réservations : un avis suppose d'avoir été servi.
  const avisDonnes = new Set(etat.avis ?? []);
  const paire = (a: Plan["avis"][number]) => `${a.restaurant}|${a.corps.dineurEmail}`;
  const avis = plan.avis.filter((a) => perimetre.has(a.restaurant) && !avisDonnes.has(paire(a)));
  const LOT_AVIS = 1000;
  for (let i = 0; i < avis.length; i += LOT_AVIS) {
    const tranche = avis.slice(i, i + LOT_AVIS);
    await envoyerUneFois(
      etat,
      `avis:${paire(tranche[0]!)}→${paire(tranche[tranche.length - 1]!)}`,
      () =>
        api(
          "POST",
          "/api/admin/avis",
          tranche.map((a) => ({ restaurantId: etat.restaurants[a.restaurant]!.id, ...a.corps })),
        ),
    );
    etat.avis = [...(etat.avis ?? []), ...tranche.map(paire)];
    sauver(etat);
  }
  if (avis.length) console.log(`  avis : ${avis.length}`);

  // 6. Factures — idempotent, relancé à chaque passage.
  for (const mois of plan.moisFactures) {
    const r = await api<{ facturesCreees: number; lignesAjoutees: number }>(
      "POST",
      "/api/admin/factures",
      { mois },
    );
    console.log(
      `  factures ${mois} : ${r.facturesCreees} créées, ${r.lignesAjoutees} lignes ajoutées`,
    );
    if (!etat.factures.includes(mois)) etat.factures.push(mois);
    sauver(etat);
  }

  // 7. Litiges, un par un.
  const dossiers = plan.dossiers.filter(
    (d) => perimetre.has(d.restaurant) && !etat.dossiers[d.cle],
  );
  const lignesParMois = new Map<string, Map<string, { factureId: string; ligneId: string }>>();
  let refuses = 0;
  for (const d of dossiers) {
    if (!lignesParMois.has(d.mois)) {
      const { factures } = await api<{
        factures: { id: string; lignes: { id: string; bookingId: string }[] }[];
      }>("GET", `/api/admin/factures?mois=${d.mois}`);
      lignesParMois.set(
        d.mois,
        new Map(
          factures.flatMap((f) =>
            f.lignes.map((l) => [l.bookingId, { factureId: f.id, ligneId: l.id }] as const),
          ),
        ),
      );
    }
    const lignes = d.lignes.map((l) => ({
      ...l,
      trouvee: lignesParMois.get(d.mois)!.get(etat.reservations[l.reservation] ?? ""),
    }));
    if (lignes.some((l) => !l.trouvee)) {
      console.log(`  litige ${d.cle} ignoré : une ligne n'est pas sur la facture.`);
      continue;
    }
    const restaurant = etat.restaurants[d.restaurant]!;
    const corps = {
      factureId: lignes[0]!.trouvee!.factureId,
      contactId: restaurant.contacts[d.contactEmail],
      commentaire: d.commentaire,
      lignes: lignes.map((l) => ({ ligneFactureId: l.trouvee!.ligneId, motif: l.motif })),
      deposeLe: d.deposeLe,
      etapes: d.etapes,
    };
    try {
      const reponse = await envoyerUneFois(etat, `dossier:${d.cle}`, () =>
        api<{ cree: { id: string } }>("POST", "/api/admin/dossiers", corps),
      );
      if (reponse) etat.dossiers[d.cle] = reponse.cree.id;
    } catch (erreur) {
      if (!(erreur instanceof RefusApi)) throw erreur;
      // Le seuil réel diffère de celui supposé : le dossier aurait été
      // crédité d'office. On le dépose tel quel, sans instruction.
      if (/crédité d'office/.test(erreur.corps.erreur ?? "")) {
        const reponse = await envoyerUneFois(etat, `dossier:${d.cle}:office`, () =>
          api<{ cree: { id: string } }>("POST", "/api/admin/dossiers", { ...corps, etapes: [] }),
        );
        if (reponse) etat.dossiers[d.cle] = reponse.cree.id;
      } else {
        refuses++;
        console.log(`  litige ${d.cle} refusé : ${erreur.message}`);
      }
    }
    sauver(etat);
  }
  console.log(
    `  litiges : ${dossiers.length - refuses} déposés${refuses ? `, ${refuses} refusés` : ""}`,
  );
  console.log(`Identifiants (contacts, staff, personas) : ${FICHIER_IDENTIFIANTS}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const [commande, lot] = process.argv.slice(2);
  mkdirSync(DOSSIER, { recursive: true });

  if (commande === "plan") {
    const plan = genererJeu({ maintenant: new Date(), graine: GRAINE });
    writeFileSync(FICHIER_PLAN, JSON.stringify(plan));
    console.log(`Plan écrit : ${FICHIER_PLAN}\n`);
    bilan(plan);
    return;
  }
  if (!existsSync(FICHIER_PLAN))
    throw new Error(`Pas de plan dans ${DOSSIER} : lancer d'abord « pnpm jeu-formation plan ».`);
  const plan = JSON.parse(readFileSync(FICHIER_PLAN, "utf8")) as Plan;
  if (commande === "bilan") return bilan(plan);
  if (commande === "injecter" && (lot === "pilote" || lot === "tout")) return injecter(plan, lot);
  throw new Error("Usage : pnpm jeu-formation plan | bilan | injecter pilote|tout");
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exit(1);
});

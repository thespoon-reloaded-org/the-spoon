/**
 * Les écritures de l'API d'administration. Une règle les tient toutes :
 * **l'API ne fabrique que des états que le produit aurait pu atteindre**.
 * Elle raccourcit le chemin (une réservation passée, honorée, sans attendre
 * que le service ait lieu), elle ne le contourne pas : mêmes créneaux, mêmes
 * horaires d'ouverture, même capacité, même fenêtre de réservation, même
 * facturation, même dépôt de contestation que les écrans — et des dates qui
 * se suivent dans l'ordre où le produit les aurait écrites. Des données de
 * formation qui violeraient ces règles apprendraient un produit qui
 * n'existe pas.
 *
 * Chaque appel est tout-ou-rien : une liste avec une erreur n'écrit rien, et
 * la réponse dit quels éléments corriger.
 */
import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import type { z } from "zod";

import { trierAllergenes } from "@/lib/allergenes";
import { recalculerNoteRestaurant, reservationsServies } from "@/lib/avis";
import {
  creerContactAvecAcces,
  genererMotDePasseTemporaire,
  nouveauCompteCredential,
} from "@/lib/comptes";
import {
  creerDossierContestation,
  deciderDossier,
  demanderComplementDossier,
  lireJournalDossier,
  prendreEnChargeDossier,
} from "@/lib/contestation";
import {
  NB_JOURS_RESERVABLES,
  cleCreneau,
  construireDateCreneau,
  estDansLaFenetreReservable,
} from "@/lib/creneaux";
import { creneauOuvert, type Exception } from "@/lib/disponibilites";
import { genererFacturesMois, moisFacture, referenceFacture } from "@/lib/facturation";
import { formaterJourEtHeure, instantLocalDeJour, moisAdjacent } from "@/lib/fuseau";
import { fusionnerPlages, type Plage } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";
import { capaciteEffective } from "@/lib/reservation";

import { ErreurApi } from "./erreurs";
import type {
  EtapeInstruction,
  SaisieReservation,
  schemaContact,
  schemaDineur,
  schemaDossier,
  schemaAvis,
  schemaRestaurant,
  schemaStaff,
} from "./schemas";

/**
 * Sous le délai d'exécution d'une fonction Netlify : une transaction encore
 * ouverte quand la fonction est coupée est annulée, rien n'est écrit, mais
 * le client ne reçoit qu'une erreur de passerelle. Les plafonds par appel
 * (voir les routes) sont choisis pour tenir largement dedans.
 */
const DELAI_TRANSACTION_MS = 20_000;

type Erreur = { element: number; message: string };

function refuserSiErreurs(statut: number, message: string, erreurs: Erreur[]) {
  if (erreurs.length > 0) throw new ErreurApi(statut, message, erreurs);
}

/** Emails présents deux fois dans le même appel. */
function doublonsInternes(emails: string[]): Erreur[] {
  const vus = new Map<string, number>();
  const erreurs: Erreur[] = [];
  emails.forEach((email, element) => {
    if (vus.has(email))
      erreurs.push({ element, message: `${email} apparaît déjà à l'élément ${vus.get(email)}.` });
    else vus.set(email, element);
  });
  return erreurs;
}

/** Une date de création dans le futur n'a pas encore eu lieu. */
function datesFutures(dates: (Date | undefined)[], maintenant: Date): Erreur[] {
  return dates.flatMap((date, element) =>
    date && date.getTime() > maintenant.getTime()
      ? [{ element, message: "creeLe ne peut pas être dans le futur." }]
      : [],
  );
}

/**
 * Hache le mot de passe fourni, ou en génère un. Le mot de passe généré est
 * rendu une seule fois dans la réponse, jamais stocké en clair — même
 * contrat que l'ajout de contact depuis la Console staff.
 */
async function preparerMotDePasse(fourni: string | undefined) {
  const motDePasse = fourni ?? genererMotDePasseTemporaire();
  return { hash: await hashPassword(motDePasse), genere: fourni ? undefined : motDePasse };
}

// ---------------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------------

type SaisieRestaurant = z.output<typeof schemaRestaurant>;
type SaisieContact = z.output<typeof schemaContact>;

/** Emails déjà pris par un contact restaurant, rapportés à l'élément qui les porte. */
async function emailsContactsPris(contacts: { element: number; email: string }[]) {
  const pris = await prisma.restaurantContact.findMany({
    where: { email: { in: contacts.map((c) => c.email) } },
    select: { email: true },
  });
  const emails = new Set(pris.map((p) => p.email));
  return contacts
    .filter((c) => emails.has(c.email))
    .map((c) => ({ element: c.element, message: `${c.email} est déjà un contact restaurant.` }));
}

export async function creerRestaurants(
  saisies: SaisieRestaurant[],
  staffId: string,
  maintenant = new Date(),
) {
  refuserSiErreurs(
    400,
    "Dates de création impossibles.",
    datesFutures(
      saisies.map((r) => r.creeLe),
      maintenant,
    ),
  );
  const contacts = saisies.flatMap((r, element) =>
    r.contacts.map((c) => ({ element, email: c.email })),
  );
  refuserSiErreurs(
    400,
    "Emails de contact en double dans l'appel.",
    doublonsInternes(contacts.map((c) => c.email)).map((e) => ({
      ...e,
      element: contacts[e.element]!.element,
    })),
  );
  refuserSiErreurs(409, "Emails de contact déjà utilisés.", await emailsContactsPris(contacts));

  // Hachage hors transaction : il est lent (scrypt) et n'a rien à verrouiller.
  const motsDePasse = await Promise.all(
    saisies.map((r) => Promise.all(r.contacts.map((c) => preparerMotDePasse(c.motDePasse)))),
  );

  return prisma.$transaction(
    async (tx) => {
      const crees = [];
      for (const [i, saisie] of saisies.entries()) {
        const { plats, horaires, contacts: contactsSaisis, creeLe, ...champs } = saisie;
        // Carte, horaires et trace de création en une seule écriture.
        const restaurant = await tx.restaurant.create({
          data: {
            ...champs,
            createdAt: creeLe,
            platsCuillere: {
              create: plats.map((p) => platAvecDeclaration(p, creeLe ?? maintenant)),
            },
            plagesOuverture: { create: plagesFusionnees(horaires) },
            journalAudit: { create: { staffId, action: "CREATION", createdAt: creeLe } },
          },
        });

        const contactsCrees = [];
        for (const [j, contact] of contactsSaisis.entries()) {
          const motDePasse = motsDePasse[i]![j]!;
          const cree = await creerContactAvecAcces(tx, {
            restaurantId: restaurant.id,
            nom: contact.nom,
            email: contact.email,
            role: contact.role,
            motDePasseHash: motDePasse.hash,
            staffId,
            creeLe,
          });
          contactsCrees.push({
            id: cree.id,
            email: cree.email,
            role: cree.role,
            motDePasseGenere: motDePasse.genere,
          });
        }
        crees.push({
          id: restaurant.id,
          nom: restaurant.nom,
          ville: restaurant.ville,
          creeLe: restaurant.createdAt,
          contacts: contactsCrees,
        });
      }
      return crees;
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

/** `allergenes` absent = non renseigné ; présent, même vide, = déclaré à la création. */
function platAvecDeclaration(
  { allergenes, ...plat }: SaisieRestaurant["plats"][number],
  declareLe: Date,
) {
  return allergenes === undefined
    ? plat
    : { ...plat, allergenes: trierAllergenes(allergenes), allergenesDeclaresLe: declareLe };
}

/** Une plage par service et par jour, fusionnées comme sur « Mes disponibilités ». */
function plagesFusionnees(plages: SaisieRestaurant["horaires"]) {
  const jours = [...new Set(plages.map((p) => p.jourSemaine))];
  return jours.flatMap((jourSemaine) =>
    fusionnerPlages(plages.filter((p) => p.jourSemaine === jourSemaine)).map((p) => ({
      jourSemaine,
      ...p,
    })),
  );
}

/** Ajoute des contacts à un restaurant existant. */
export async function ajouterContacts(
  restaurantId: string,
  saisies: SaisieContact[],
  staffId: string,
) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true },
  });
  if (!restaurant) throw new ErreurApi(404, "Restaurant introuvable.");

  refuserSiErreurs(
    400,
    "Emails en double dans l'appel.",
    doublonsInternes(saisies.map((c) => c.email)),
  );
  refuserSiErreurs(
    409,
    "Emails de contact déjà utilisés.",
    await emailsContactsPris(saisies.map((c, element) => ({ element, email: c.email }))),
  );

  const motsDePasse = await Promise.all(saisies.map((c) => preparerMotDePasse(c.motDePasse)));
  return prisma.$transaction(
    async (tx) => {
      const crees = [];
      for (const [i, contact] of saisies.entries()) {
        const cree = await creerContactAvecAcces(tx, {
          restaurantId,
          nom: contact.nom,
          email: contact.email,
          role: contact.role,
          motDePasseHash: motsDePasse[i]!.hash,
          staffId,
        });
        crees.push({
          id: cree.id,
          email: cree.email,
          role: cree.role,
          motDePasseGenere: motsDePasse[i]!.genere,
        });
      }
      return crees;
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

// ---------------------------------------------------------------------------
// Dîneurs
// ---------------------------------------------------------------------------

function sansUtilisateur<T extends { userId: string }>({ userId: _userId, ...compte }: T) {
  return compte;
}

export async function creerDineurs(
  saisies: z.output<typeof schemaDineur>[],
  maintenant = new Date(),
) {
  refuserSiErreurs(
    400,
    "Dates de création impossibles.",
    datesFutures(
      saisies.map((d) => d.creeLe),
      maintenant,
    ),
  );
  refuserSiErreurs(
    400,
    "Emails en double dans l'appel.",
    doublonsInternes(saisies.map((d) => d.email)),
  );
  const dejaPris = new Set(
    (
      await prisma.user.findMany({
        where: { email: { in: saisies.map((d) => d.email) } },
        select: { email: true },
      })
    ).map((p) => p.email),
  );
  refuserSiErreurs(
    409,
    "Emails de dîneur déjà utilisés.",
    saisies.flatMap((d, element) =>
      dejaPris.has(d.email) ? [{ element, message: `${d.email} a déjà un compte dîneur.` }] : [],
    ),
  );

  const motsDePasse = await Promise.all(saisies.map((d) => preparerMotDePasse(d.motDePasse)));
  return prisma.$transaction(
    async (tx) => {
      const crees = [];
      for (const [i, saisie] of saisies.entries()) {
        // Même forme que `pnpm creer-compte` : id UUID, email vérifié (pas de
        // flux de vérification dans ce projet), compte credential.
        const id = randomUUID();
        const dineur = await tx.user.create({
          data: {
            id,
            name: saisie.nom,
            email: saisie.email,
            emailVerified: true,
            createdAt: saisie.creeLe,
            // Imbriqué : `userId` est porté par la relation, pas par la ligne.
            accounts: {
              create: sansUtilisateur(nouveauCompteCredential(id, motsDePasse[i]!.hash)),
            },
          },
        });
        crees.push({
          id: dineur.id,
          email: dineur.email,
          creeLe: dineur.createdAt,
          motDePasseGenere: motsDePasse[i]!.genere,
        });
      }
      return crees;
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/**
 * Des membres du staff, avec un accès à la Console. Même contrat de mot de
 * passe que les autres comptes ; un mot de passe généré et jamais relevé
 * laisse un compte qui ne se connecte pas — c'est le cas d'un instructeur
 * d'historique, qui n'existe que pour signer son journal.
 */
export async function creerStaff(saisies: z.output<typeof schemaStaff>[], maintenant = new Date()) {
  refuserSiErreurs(
    400,
    "Dates de création impossibles.",
    datesFutures(
      saisies.map((m) => m.creeLe),
      maintenant,
    ),
  );
  refuserSiErreurs(
    400,
    "Emails en double dans l'appel.",
    doublonsInternes(saisies.map((m) => m.email)),
  );
  const dejaPris = new Set(
    (
      await prisma.staff.findMany({
        where: { email: { in: saisies.map((m) => m.email) } },
        select: { email: true },
      })
    ).map((p) => p.email),
  );
  refuserSiErreurs(
    409,
    "Emails de staff déjà utilisés.",
    saisies.flatMap((m, element) =>
      dejaPris.has(m.email) ? [{ element, message: `${m.email} fait déjà partie du staff.` }] : [],
    ),
  );

  const motsDePasse = await Promise.all(saisies.map((m) => preparerMotDePasse(m.motDePasse)));
  return prisma.$transaction(
    async (tx) => {
      const crees = [];
      for (const [i, saisie] of saisies.entries()) {
        const membre = await tx.staff.create({
          data: {
            nom: saisie.nom,
            email: saisie.email,
            role: saisie.role,
            emailVerified: true,
            createdAt: saisie.creeLe,
          },
        });
        await tx.staffAccount.create({
          data: nouveauCompteCredential(membre.id, motsDePasse[i]!.hash),
        });
        crees.push({
          id: membre.id,
          email: membre.email,
          creeLe: membre.createdAt,
          motDePasseGenere: motsDePasse[i]!.genere,
        });
      }
      return crees;
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

/**
 * Délais par défaut d'une réservation d'historique, quand le jeu de données
 * ne les donne pas : réservée la veille, signalée dans la soirée. Ce sont les
 * délais courants, pas des bornes — `creeLe` et `signaleeLe` les remplacent.
 */
const RESERVEE_AVANT_MS = 24 * 60 * 60 * 1000;
const SIGNALEE_APRES_MS = 3 * 60 * 60 * 1000;

export type RestaurantConnu = { createdAt: Date; plages: Plage[]; exceptions: Exception[] };

type ReservationResolue = {
  element: number;
  restaurantId: string;
  userId: string;
  date: Date;
  couverts: number;
  statut: SaisieReservation["statut"];
  couvertsServis: number | null;
  signaleeLe: Date | null;
  createdAt: Date;
};

const plusTard = (...dates: Date[]) => new Date(Math.max(...dates.map((d) => d.getTime())));
const plusTot = (...dates: Date[]) => new Date(Math.min(...dates.map((d) => d.getTime())));

/**
 * Résout chaque saisie en réservation prête à écrire, ou dit pourquoi elle
 * décrit un état que le produit ne sait pas atteindre. Pure : restaurants
 * (horaires compris) et dîneurs connus sont passés en paramètre,
 * `maintenant` aussi.
 */
export function resoudreReservations(
  saisies: SaisieReservation[],
  connus: {
    restaurants: Map<string, RestaurantConnu>;
    dineurParId: Map<string, Date>;
    dineurParEmail: Map<string, { id: string; createdAt: Date }>;
  },
  maintenant: Date,
): { reservations: ReservationResolue[]; erreurs: Erreur[] } {
  const reservations: ReservationResolue[] = [];
  const erreurs: Erreur[] = [];

  saisies.forEach((saisie, element) => {
    const refuser = (message: string) => erreurs.push({ element, message });

    const restaurant = connus.restaurants.get(saisie.restaurantId);
    if (!restaurant) return refuser(`Restaurant ${saisie.restaurantId} introuvable.`);
    const dineur = saisie.dineurEmail
      ? connus.dineurParEmail.get(saisie.dineurEmail)
      : connus.dineurParId.has(saisie.dineurId!)
        ? { id: saisie.dineurId!, createdAt: connus.dineurParId.get(saisie.dineurId!)! }
        : undefined;
    if (!dineur) return refuser(`Dîneur ${saisie.dineurEmail ?? saisie.dineurId} introuvable.`);

    // Même lecture que la carte de réservation : horaires habituels
    // recouverts par les exceptions datées. Vaut pour tous les statuts — une
    // réservation annulée avait, elle aussi, été prise sur un créneau ouvert.
    if (
      !creneauOuvert({
        plages: restaurant.plages,
        exceptions: restaurant.exceptions,
        jourIso: saisie.jour,
        creneau: saisie.creneau,
      })
    ) {
      return refuser(`Le restaurant est fermé le ${saisie.jour} à ${saisie.creneau}.`);
    }

    // Validés par le schéma : jamais null ici.
    const date = construireDateCreneau(saisie.jour, saisie.creneau)!;
    const passee = date.getTime() <= maintenant.getTime();

    // Seul un créneau passé se signale (même garde que `marquerReservation`).
    if ((saisie.statut === "HONOREE" || saisie.statut === "NO_SHOW") && !passee) {
      return refuser(`Une réservation ${saisie.statut} doit porter sur un créneau passé.`);
    }

    // Personne ne réserve chez un restaurant, ni avec un compte, qui
    // n'existe pas encore.
    const existeDepuis = plusTard(restaurant.createdAt, dineur.createdAt);
    if (date.getTime() <= existeDepuis.getTime()) {
      return refuser(
        `Créneau du ${formaterJourEtHeure(date)}, antérieur à l'arrivée du restaurant ou du dîneur sur TheSpoon (${formaterJourEtHeure(existeDepuis)}) — les dater avec creeLe.`,
      );
    }
    // Par défaut la veille, sans remonter avant cette arrivée ni dépasser maintenant.
    const createdAt =
      saisie.creeLe ??
      plusTot(maintenant, plusTard(new Date(date.getTime() - RESERVEE_AVANT_MS), existeDepuis));
    if (createdAt.getTime() > maintenant.getTime()) {
      return refuser("creeLe ne peut pas être dans le futur.");
    }
    if (createdAt.getTime() < existeDepuis.getTime()) {
      return refuser(
        `Réservation prise le ${formaterJourEtHeure(createdAt)}, avant l'arrivée du restaurant ou du dîneur sur TheSpoon (${formaterJourEtHeure(existeDepuis)}) — les dater avec creeLe.`,
      );
    }
    // La fenêtre de la fiche restaurant, vue du jour où la réservation a été prise.
    if (!estDansLaFenetreReservable(date, createdAt)) {
      return refuser(
        `Un créneau se réserve au plus ${NB_JOURS_RESERVABLES} jours à l'avance, et avant qu'il ait lieu (réservation prise le ${formaterJourEtHeure(createdAt)}).`,
      );
    }

    let signaleeLe: Date | null = null;
    if (saisie.statut === "HONOREE" || saisie.statut === "NO_SHOW") {
      signaleeLe =
        saisie.signaleeLe ?? plusTot(maintenant, new Date(date.getTime() + SIGNALEE_APRES_MS));
      if (signaleeLe.getTime() < date.getTime() || signaleeLe.getTime() > maintenant.getTime()) {
        return refuser("signaleeLe doit tomber entre le créneau et maintenant.");
      }
    }

    reservations.push({
      element,
      restaurantId: saisie.restaurantId,
      userId: dineur.id,
      date,
      couverts: saisie.couverts,
      statut: saisie.statut,
      couvertsServis: saisie.couvertsServis ?? null,
      signaleeLe,
      createdAt,
    });
  });

  return { reservations, erreurs };
}

export async function creerReservations(saisies: SaisieReservation[], maintenant = new Date()) {
  const restaurantIdsDemandes = [...new Set(saisies.map((s) => s.restaurantId))];
  const joursDemandes = [...new Set(saisies.map((s) => s.jour))];
  const [restaurants, plages, exceptions, dineursParId, dineursParEmail] = await Promise.all([
    prisma.restaurant.findMany({
      where: { id: { in: restaurantIdsDemandes } },
      select: { id: true, createdAt: true },
    }),
    prisma.plageOuverture.findMany({
      where: { restaurantId: { in: restaurantIdsDemandes } },
      select: { restaurantId: true, jourSemaine: true, debutMinutes: true, finMinutes: true },
    }),
    prisma.exceptionHoraire.findMany({
      where: { restaurantId: { in: restaurantIdsDemandes }, jour: { in: joursDemandes } },
      select: { restaurantId: true, jour: true, creneau: true, ouvert: true },
    }),
    prisma.user.findMany({
      where: { id: { in: saisies.flatMap((s) => (s.dineurId ? [s.dineurId] : [])) } },
      select: { id: true, email: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { email: { in: saisies.flatMap((s) => (s.dineurEmail ? [s.dineurEmail] : [])) } },
      select: { id: true, email: true, createdAt: true },
    }),
  ]);

  const { reservations, erreurs } = resoudreReservations(
    saisies,
    {
      restaurants: new Map(
        restaurants.map((r) => [
          r.id,
          {
            createdAt: r.createdAt,
            plages: plages.filter((p) => p.restaurantId === r.id),
            exceptions: exceptions.filter((e) => e.restaurantId === r.id),
          },
        ]),
      ),
      dineurParId: new Map(dineursParId.map((d) => [d.id, d.createdAt])),
      dineurParEmail: new Map(dineursParEmail.map((d) => [d.email, d])),
    },
    maintenant,
  );
  refuserSiErreurs(400, "Réservations impossibles.", erreurs);
  return prisma.$transaction(
    async (tx) => {
      // Même verrou que `reserverCreneau`, pris dans un ordre stable pour que
      // deux appels concurrents sur les mêmes restaurants ne s'interbloquent pas.
      const capacites = new Map<string, number>();
      for (const restaurantId of [...restaurantIdsDemandes].sort()) {
        const lignes = await tx.$queryRaw<{ capacite: number | null }[]>`
          SELECT capacite FROM "Restaurant" WHERE id = ${restaurantId} FOR UPDATE
        `;
        capacites.set(restaurantId, capaciteEffective(lignes[0]?.capacite ?? null));
      }

      // Capacité : tout ce qui occupe une table sur le créneau — une
      // réservation honorée ou no-show a été confirmée avant de l'être, elle a
      // donc pris sa place. Dans le futur, ça revient exactement à la règle de
      // `reserverCreneau` (seules des CONFIRMEE peuvent y exister).
      const occupantes = reservations.filter((r) => r.statut !== "ANNULEE");
      const existantes = await tx.booking.groupBy({
        by: ["restaurantId", "date"],
        where: {
          statut: { not: "ANNULEE" },
          OR: occupantes.map((r) => ({ restaurantId: r.restaurantId, date: r.date })),
        },
        _sum: { couverts: true },
      });
      const occupation = new Map(
        existantes.map((e) => [`${e.restaurantId}|${e.date.toISOString()}`, e._sum.couverts ?? 0]),
      );
      const depassements: Erreur[] = [];
      for (const r of occupantes) {
        const cle = `${r.restaurantId}|${r.date.toISOString()}`;
        const total = (occupation.get(cle) ?? 0) + r.couverts;
        occupation.set(cle, total);
        const capacite = capacites.get(r.restaurantId)!;
        if (total > capacite) {
          depassements.push({
            element: r.element,
            message: `Créneau ${cleCreneau(r.date).replace("_", " à ")} complet : ${total} couverts pour une capacité de ${capacite}.`,
          });
        }
      }
      refuserSiErreurs(409, "Capacité dépassée.", depassements);

      const creees = await tx.booking.createManyAndReturn({
        data: reservations.map(({ element: _element, ...r }) => r),
        select: { id: true, restaurantId: true, userId: true, date: true, statut: true },
      });
      // L'email du dîneur en retour : c'est par lui qu'un jeu de données
      // désigne ses dîneurs, et qu'il retrouve ce qui a été créé.
      const emailParId = new Map(
        [...dineursParId, ...dineursParEmail].map((d) => [d.id, d.email] as const),
      );
      return creees.map((c) => ({ ...c, dineurEmail: emailParId.get(c.userId)! }));
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

// ---------------------------------------------------------------------------
// Avis
// ---------------------------------------------------------------------------

/** Par défaut, un avis s'écrit le lendemain du service. */
const AVIS_APRES_SERVICE_MS = 20 * 60 * 60 * 1000;

/**
 * Des avis de dîneurs, et la note de chaque restaurant touché recalculée
 * comme après un dépôt depuis la fiche. Un avis ne s'écrit qu'après avoir
 * été servi : le dîneur a, dans ce restaurant, un créneau passé honoré — ou
 * confirmé, pas encore signalé — antérieur à l'avis. Un avis par dîneur et
 * par restaurant, comme sur la fiche ; l'API crée, elle ne remplace pas.
 */
export async function creerAvis(saisies: z.output<typeof schemaAvis>[], maintenant = new Date()) {
  const restaurantIds = [...new Set(saisies.map((a) => a.restaurantId))];
  const emails = [...new Set(saisies.map((a) => a.dineurEmail))];
  const [restaurants, dineurs] = await Promise.all([
    prisma.restaurant.findMany({ where: { id: { in: restaurantIds } }, select: { id: true } }),
    prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }),
  ]);
  const idParEmail = new Map(dineurs.map((d) => [d.email, d.id]));
  const restaurantsConnus = new Set(restaurants.map((r) => r.id));
  const userIds = [...idParEmail.values()];
  const [servis, existants] = await Promise.all([
    prisma.booking.findMany({
      where: {
        restaurantId: { in: restaurantIds },
        userId: { in: userIds },
        ...reservationsServies(maintenant),
      },
      select: { restaurantId: true, userId: true, date: true },
    }),
    prisma.avis.findMany({
      where: { restaurantId: { in: restaurantIds }, userId: { in: userIds } },
      select: { restaurantId: true, userId: true },
    }),
  ]);
  const servicesPar = new Map<string, Date[]>();
  for (const b of servis) {
    const cle = `${b.restaurantId}|${b.userId}`;
    (servicesPar.get(cle) ?? servicesPar.set(cle, []).get(cle)!).push(b.date);
  }
  const dejaDonne = new Set(existants.map((a) => `${a.restaurantId}|${a.userId}`));

  const erreurs: Erreur[] = [];
  const vus = new Set<string>();
  const avis = saisies.flatMap((saisie, element) => {
    const refuser = (message: string) => {
      erreurs.push({ element, message });
      return [];
    };
    if (!restaurantsConnus.has(saisie.restaurantId))
      return refuser(`Restaurant ${saisie.restaurantId} introuvable.`);
    const userId = idParEmail.get(saisie.dineurEmail);
    if (!userId) return refuser(`Dîneur ${saisie.dineurEmail} introuvable.`);
    const cle = `${saisie.restaurantId}|${userId}`;
    if (vus.has(cle))
      return refuser("Un seul avis par dîneur et par restaurant : déjà présent dans l'appel.");
    vus.add(cle);
    if (dejaDonne.has(cle)) return refuser("Ce dîneur a déjà donné son avis sur ce restaurant.");

    const services = (servicesPar.get(cle) ?? []).sort((a, b) => a.getTime() - b.getTime());
    if (services.length === 0) return refuser("Ce dîneur n'a jamais été servi dans ce restaurant.");
    const dernier = services[services.length - 1]!;
    const creeLe =
      saisie.creeLe ??
      new Date(Math.min(maintenant.getTime(), dernier.getTime() + AVIS_APRES_SERVICE_MS));
    if (creeLe.getTime() > maintenant.getTime())
      return refuser("creeLe ne peut pas être dans le futur.");
    if (creeLe.getTime() <= services[0]!.getTime()) {
      return refuser(
        `Avis daté du ${formaterJourEtHeure(creeLe)}, avant le premier service du dîneur dans ce restaurant (${formaterJourEtHeure(services[0]!)}).`,
      );
    }
    return [
      {
        restaurantId: saisie.restaurantId,
        userId,
        noteCuilleres: saisie.noteCuilleres,
        commentaire: saisie.commentaire,
        createdAt: creeLe,
        updatedAt: creeLe,
      },
    ];
  });
  refuserSiErreurs(400, "Avis impossibles.", erreurs);

  return prisma.$transaction(
    async (tx) => {
      await tx.avis.createMany({ data: avis });
      for (const restaurantId of restaurantIds) await recalculerNoteRestaurant(tx, restaurantId);
      const notes = await tx.restaurant.findMany({
        where: { id: { in: restaurantIds } },
        select: { id: true, noteCuilleres: true, nombreAvis: true },
      });
      return { avisCrees: avis.length, restaurants: notes };
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

// ---------------------------------------------------------------------------
// Factures & contestations
// ---------------------------------------------------------------------------

/** Factures d'un mois, avec leurs lignes — de quoi choisir quoi contester. */
export async function listerFacturesMois(mois: string) {
  const factures = await prisma.facture.findMany({
    where: { mois: moisFacture(mois) },
    orderBy: { restaurant: { nom: "asc" } },
    include: {
      restaurant: {
        select: { nom: true, contacts: { select: { id: true, email: true, role: true } } },
      },
      lignes: {
        orderBy: { booking: { date: "asc" } },
        include: {
          booking: { select: { date: true, statut: true } },
          contestation: { select: { dossierId: true } },
        },
      },
    },
  });
  return factures.map((f) => ({
    id: f.id,
    reference: referenceFacture(f),
    restaurantId: f.restaurantId,
    restaurant: f.restaurant.nom,
    contacts: f.restaurant.contacts,
    montantTotalCentimes: f.montantTotalCentimes,
    genereeLe: f.genereeLe,
    lignes: f.lignes.map((l) => ({
      id: l.id,
      bookingId: l.bookingId,
      date: l.booking.date,
      couvertsFactures: l.couvertsFactures,
      montantCentimes: l.montantCentimes,
      dossierId: l.contestation?.dossierId ?? null,
    })),
  }));
}

/**
 * Heure d'émission des factures d'un mois : le 1er du mois suivant, 6h à
 * Paris — un mois se facture une fois terminé. Jamais dans le futur : le
 * mois en cours se facture maintenant, comme depuis la Console.
 */
export const HEURE_EMISSION_FACTURES = 6;

export function dateEmissionFactures(mois: string, maintenant: Date): Date {
  const emission = instantLocalDeJour(`${moisAdjacent(mois, 1)}-01`, HEURE_EMISSION_FACTURES);
  return emission.getTime() < maintenant.getTime() ? emission : maintenant;
}

/**
 * Même génération que le bouton de la Console staff, datée comme si elle
 * avait eu lieu à la fin du mois (voir `dateEmissionFactures`) : le délai de
 * contestation d'une facture de juin est clos en septembre, comme en vrai.
 */
export async function genererFactures(mois: string, maintenant = new Date()) {
  const resultat = await genererFacturesMois(moisFacture(mois), {
    genereeLe: dateEmissionFactures(mois, maintenant),
  });
  return { ...resultat, factures: await listerFacturesMois(mois) };
}

/**
 * Délais par défaut d'un dossier d'historique : déposé quelques jours après
 * l'émission de la facture, chaque geste d'instruction un jour après le
 * précédent. `deposeLe` et `le` les remplacent.
 */
const DEPOSE_APRES_FACTURE_MS = 5 * 24 * 60 * 60 * 1000;
const ETAPE_APRES_MS = 24 * 60 * 60 * 1000;

/**
 * Dates de dépôt et de chaque étape, validées avant toute écriture. Elles
 * se suivent **strictement** : le journal d'un dossier se lit dans l'ordre
 * des instants, et deux décisions au même instant (une escalade puis son
 * dénouement) n'auraient plus d'ordre. Les dates par défaut suivent les
 * délais courants ; quand le dossier est trop récent pour les tenir, elles
 * se répartissent entre sa borne et maintenant plutôt que de s'empiler.
 */
export function datesDossier(
  saisie: { deposeLe?: Date; etapes: { le?: Date }[] },
  bornes: { factureEmiseLe: Date; contactCreeLe: Date },
  maintenant: Date,
): { deposeLe: Date; etapes: Date[]; erreurs: string[] } {
  const erreurs: string[] = [];
  const nbEtapes = saisie.etapes.length;
  const borne = plusTard(bornes.factureEmiseLe, bornes.contactCreeLe);
  const deposeLe =
    saisie.deposeLe ??
    (borne.getTime() + DEPOSE_APRES_FACTURE_MS < maintenant.getTime()
      ? new Date(borne.getTime() + DEPOSE_APRES_FACTURE_MS)
      : new Date(borne.getTime() + (maintenant.getTime() - borne.getTime()) / (nbEtapes + 1)));
  if (deposeLe.getTime() < bornes.factureEmiseLe.getTime()) {
    erreurs.push(
      `deposeLe précède l'émission de la facture (${formaterJourEtHeure(bornes.factureEmiseLe)}).`,
    );
  }
  if (deposeLe.getTime() < bornes.contactCreeLe.getTime()) {
    erreurs.push(
      `deposeLe précède l'arrivée du contact sur TheSpoon (${formaterJourEtHeure(bornes.contactCreeLe)}).`,
    );
  }
  if (deposeLe.getTime() > maintenant.getTime())
    erreurs.push("deposeLe ne peut pas être dans le futur.");

  let precedente = deposeLe;
  const etapes = saisie.etapes.map((etape, i) => {
    const marge = (maintenant.getTime() - precedente.getTime()) / (nbEtapes - i);
    const le = etape.le ?? new Date(precedente.getTime() + Math.min(ETAPE_APRES_MS, marge));
    if (le.getTime() <= precedente.getTime()) {
      erreurs.push(
        `etapes.${i} : doit suivre strictement l'étape précédente (${formaterJourEtHeure(precedente)}) — dater les étapes avec le.`,
      );
    }
    if (le.getTime() > maintenant.getTime())
      erreurs.push(`etapes.${i} : ne peut pas être dans le futur.`);
    precedente = le;
    return le;
  });

  return { deposeLe, etapes, erreurs };
}

/** Rejoue un geste d'instruction par la fonction de la Console qui le fait. */
function rejouerEtape(dossierId: string, staffId: string, etape: EtapeInstruction, le: Date) {
  switch (etape.type) {
    case "PRISE_EN_CHARGE":
      return prendreEnChargeDossier(dossierId, staffId, le);
    case "COMPLEMENT":
      return demanderComplementDossier(dossierId, staffId, etape.message, le);
    case "DECISION":
      return deciderDossier(
        dossierId,
        staffId,
        {
          issue: etape.issue,
          montantAccordeCentimes: etape.montantAccordeCentimes,
          imputation: etape.imputation,
          motif: etape.motif,
        },
        le,
      );
  }
}

/**
 * Dépôt d'un dossier au nom d'un contact restaurant, puis son instruction
 * étape par étape — chacune par la fonction de la Console qui la fait, donc
 * par ses règles : délai de 30 jours jugé au jour du dépôt, lignes de la
 * bonne facture, pas de double contestation, crédit d'office sous le seuil,
 * seul l'instructeur qui a pris le dossier le tranche, une escalade le
 * libère, un accord partiel reste sous le montant contesté.
 *
 * Tout-ou-rien comme le reste de l'API, mais ces fonctions ont chacune leur
 * transaction : les dates sont validées avant d'écrire, et si une étape est
 * refusée en cours de route, le dossier créé par cet appel est supprimé —
 * journal, décisions et avoirs avec lui (cascade). Un écran ouvert à cet
 * instant précis peut l'avoir aperçu ; aucune donnée ne survit.
 */
export async function deposerDossier(
  saisie: z.output<typeof schemaDossier>,
  maintenant = new Date(),
) {
  const emailsStaff = [...new Set(saisie.etapes.map((e) => e.par))];
  const [facture, contact, staff] = await Promise.all([
    prisma.facture.findUnique({
      where: { id: saisie.factureId },
      select: { restaurantId: true, genereeLe: true },
    }),
    prisma.restaurantContact.findUnique({
      where: { id: saisie.contactId },
      select: { restaurantId: true, createdAt: true },
    }),
    prisma.staff.findMany({
      where: { email: { in: emailsStaff } },
      select: { id: true, email: true, createdAt: true },
    }),
  ]);
  if (!facture) throw new ErreurApi(404, "Facture introuvable.");
  if (!contact) throw new ErreurApi(404, "Contact restaurant introuvable.");
  if (contact.restaurantId !== facture.restaurantId) {
    throw new ErreurApi(422, "Ce contact n'appartient pas au restaurant de cette facture.");
  }
  const staffParEmail = new Map(staff.map((m) => [m.email, m.id]));
  const inconnus = emailsStaff.filter((email) => !staffParEmail.has(email));
  if (inconnus.length > 0) {
    throw new ErreurApi(422, `Aucun membre du staff pour : ${inconnus.join(", ")}.`);
  }

  const dates = datesDossier(
    saisie,
    { factureEmiseLe: facture.genereeLe, contactCreeLe: contact.createdAt },
    maintenant,
  );
  // Personne n'instruit un dossier avant d'être arrivé chez TheSpoon.
  const arriveeStaff = new Map(staff.map((m) => [m.email, m.createdAt]));
  saisie.etapes.forEach((etape, i) => {
    const arrive = arriveeStaff.get(etape.par)!;
    if (dates.etapes[i]!.getTime() < arrive.getTime()) {
      dates.erreurs.push(
        `etapes.${i} : ${etape.par} n'est arrivé(e) chez TheSpoon que le ${formaterJourEtHeure(arrive)} — le dater avec creeLe (POST /api/admin/staff).`,
      );
    }
  });
  if (dates.erreurs.length > 0) throw new ErreurApi(422, "Dates impossibles.", dates.erreurs);

  const depot = await creerDossierContestation({
    factureId: saisie.factureId,
    restaurantId: facture.restaurantId,
    restaurantContactId: saisie.contactId,
    lignes: saisie.lignes,
    commentaire: saisie.commentaire,
    le: dates.deposeLe,
    exigerInstruction: saisie.etapes.length > 0,
  });
  if (!depot.ok) throw new ErreurApi(422, depot.erreur);
  const dossierId = depot.dossierId;

  const annuler = async (message: string) => {
    await prisma.dossier.delete({ where: { id: dossierId } });
    throw new ErreurApi(422, message);
  };

  for (const [i, etape] of saisie.etapes.entries()) {
    let resultat;
    try {
      resultat = await rejouerEtape(
        dossierId,
        staffParEmail.get(etape.par)!,
        etape,
        dates.etapes[i]!,
      );
    } catch (erreur) {
      await prisma.dossier.delete({ where: { id: dossierId } });
      throw erreur;
    }
    if (!resultat.ok) await annuler(`etapes.${i} (${etape.type}) : ${resultat.erreur}`);
  }

  const dossier = await prisma.dossier.findUniqueOrThrow({
    where: { id: dossierId },
    select: {
      id: true,
      statut: true,
      montantContesteCentimes: true,
      createdAt: true,
      decisions: {
        select: { issue: true, montantAccordeCentimes: true, avoir: { select: { id: true } } },
      },
    },
  });
  const journal = await lireJournalDossier(dossierId);
  return {
    ...dossier,
    journal: journal.map((e) => ({
      type: e.type,
      le: e.createdAt,
      par: e.auteurStaff?.nom ?? null,
    })),
  };
}

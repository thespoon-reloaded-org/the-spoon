/**
 * Les écritures de l'API d'administration. Une règle les tient toutes :
 * **l'API ne fabrique que des états que le produit aurait pu atteindre**.
 * Elle raccourcit le chemin (une réservation passée, honorée, sans attendre
 * que le service ait lieu), elle ne le contourne pas : mêmes créneaux, même
 * capacité, même facturation, même dépôt de contestation que les écrans. Des
 * données de formation qui violeraient ces règles apprendraient un produit
 * qui n'existe pas.
 *
 * Chaque appel est tout-ou-rien : une liste avec une erreur n'écrit rien, et
 * la réponse dit quels éléments corriger.
 */
import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import type { z } from "zod";

import { genererMotDePasseTemporaire, nouveauCompteCredential } from "@/lib/comptes";
import { LIBELLE_ROLE_CONTACT } from "@/lib/contacts";
import { creerDossierContestation } from "@/lib/contestation";
import { construireDateCreneau, cleCreneau } from "@/lib/creneaux";
import { genererFacturesMois, referenceFacture } from "@/lib/facturation";
import { fusionnerPlages } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";
import { capaciteEffective } from "@/lib/reservation";

import { ErreurApi } from "./erreurs";
import type {
  SaisieReservation,
  schemaContact,
  schemaDineur,
  schemaDossier,
  schemaRestaurant,
} from "./schemas";

/** Assez large pour charger une centaine de restaurants d'un coup, borné quand même. */
const DELAI_TRANSACTION_MS = 60_000;

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

export async function creerRestaurants(saisies: SaisieRestaurant[], staffId: string) {
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
  const dejaPris = await prisma.restaurantContact.findMany({
    where: { email: { in: contacts.map((c) => c.email) } },
    select: { email: true },
  });
  refuserSiErreurs(
    409,
    "Emails de contact déjà utilisés.",
    contacts
      .filter((c) => dejaPris.some((p) => p.email === c.email))
      .map((c) => ({ element: c.element, message: `${c.email} est déjà un contact restaurant.` })),
  );

  // Hachage hors transaction : il est lent (scrypt) et n'a rien à verrouiller.
  const motsDePasse = await Promise.all(
    saisies.map((r) => Promise.all(r.contacts.map((c) => preparerMotDePasse(c.motDePasse)))),
  );

  return prisma.$transaction(
    async (tx) => {
      const crees = [];
      for (const [i, saisie] of saisies.entries()) {
        const { plats, horaires, contacts: contactsSaisis, ...champs } = saisie;
        const restaurant = await tx.restaurant.create({
          data: {
            ...champs,
            platsCuillere: { create: plats },
            plagesOuverture: { create: plagesFusionnees(horaires) },
          },
        });
        await tx.journalAuditRestaurant.create({
          data: { restaurantId: restaurant.id, staffId, action: "CREATION" },
        });

        const contactsCrees = [];
        for (const [j, contact] of contactsSaisis.entries()) {
          const motDePasse = motsDePasse[i]![j]!;
          contactsCrees.push(await creerContact(tx, restaurant.id, contact, motDePasse, staffId));
        }
        crees.push({
          id: restaurant.id,
          nom: restaurant.nom,
          ville: restaurant.ville,
          contacts: contactsCrees,
        });
      }
      return crees;
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
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

type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Même écriture que `creerContactRestaurant` (Console staff), audit compris. */
async function creerContact(
  tx: Transaction,
  restaurantId: string,
  contact: SaisieContact,
  motDePasse: { hash: string; genere?: string },
  staffId: string,
) {
  const cree = await tx.restaurantContact.create({
    data: {
      restaurantId,
      nom: contact.nom,
      email: contact.email,
      role: contact.role,
      emailVerified: true,
    },
  });
  await tx.restaurantContactAccount.create({
    data: nouveauCompteCredential(cree.id, motDePasse.hash),
  });
  await tx.journalAuditRestaurant.create({
    data: {
      restaurantId,
      staffId,
      action: "AJOUT_CONTACT",
      champsModifies: [
        {
          champ: "contact",
          avant: null,
          apres: `${contact.nom} (${LIBELLE_ROLE_CONTACT[contact.role]}) — ${contact.email}`,
        },
      ],
    },
  });
  return { id: cree.id, email: cree.email, role: cree.role, motDePasseGenere: motDePasse.genere };
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
  const dejaPris = await prisma.restaurantContact.findMany({
    where: { email: { in: saisies.map((c) => c.email) } },
    select: { email: true },
  });
  refuserSiErreurs(
    409,
    "Emails de contact déjà utilisés.",
    saisies.flatMap((c, element) =>
      dejaPris.some((p) => p.email === c.email)
        ? [{ element, message: `${c.email} est déjà un contact restaurant.` }]
        : [],
    ),
  );

  const motsDePasse = await Promise.all(saisies.map((c) => preparerMotDePasse(c.motDePasse)));
  return prisma.$transaction(
    async (tx) => {
      const crees = [];
      for (const [i, contact] of saisies.entries()) {
        crees.push(await creerContact(tx, restaurantId, contact, motsDePasse[i]!, staffId));
      }
      return crees;
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

// ---------------------------------------------------------------------------
// Dîneurs
// ---------------------------------------------------------------------------

export async function creerDineurs(saisies: z.output<typeof schemaDineur>[]) {
  refuserSiErreurs(
    400,
    "Emails en double dans l'appel.",
    doublonsInternes(saisies.map((d) => d.email)),
  );
  const dejaPris = await prisma.user.findMany({
    where: { email: { in: saisies.map((d) => d.email) } },
    select: { email: true },
  });
  refuserSiErreurs(
    409,
    "Emails de dîneur déjà utilisés.",
    saisies.flatMap((d, element) =>
      dejaPris.some((p) => p.email === d.email)
        ? [{ element, message: `${d.email} a déjà un compte dîneur.` }]
        : [],
    ),
  );

  const motsDePasse = await Promise.all(saisies.map((d) => preparerMotDePasse(d.motDePasse)));
  return prisma.$transaction(
    async (tx) => {
      const crees = [];
      for (const [i, saisie] of saisies.entries()) {
        // Même forme que `pnpm creer-compte` : id UUID, email vérifié (pas de
        // flux de vérification dans ce projet), compte credential.
        const dineur = await tx.user.create({
          data: { id: randomUUID(), name: saisie.nom, email: saisie.email, emailVerified: true },
        });
        await tx.account.create({ data: nouveauCompteCredential(dineur.id, motsDePasse[i]!.hash) });
        crees.push({
          id: dineur.id,
          email: dineur.email,
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

/**
 * Résout chaque saisie en réservation prête à écrire, ou dit pourquoi elle
 * décrit un état que le produit ne sait pas atteindre. Pure : les dîneurs et
 * restaurants connus sont passés en paramètre, `maintenant` aussi.
 */
export function resoudreReservations(
  saisies: SaisieReservation[],
  connus: {
    restaurantIds: Set<string>;
    dineurParId: Set<string>;
    dineurParEmail: Map<string, string>;
  },
  maintenant: Date,
): { reservations: ReservationResolue[]; erreurs: Erreur[] } {
  const reservations: ReservationResolue[] = [];
  const erreurs: Erreur[] = [];

  saisies.forEach((saisie, element) => {
    const refuser = (message: string) => erreurs.push({ element, message });

    if (!connus.restaurantIds.has(saisie.restaurantId))
      return refuser(`Restaurant ${saisie.restaurantId} introuvable.`);
    const userId = saisie.dineurEmail
      ? connus.dineurParEmail.get(saisie.dineurEmail)
      : connus.dineurParId.has(saisie.dineurId!)
        ? saisie.dineurId
        : undefined;
    if (!userId) return refuser(`Dîneur ${saisie.dineurEmail ?? saisie.dineurId} introuvable.`);

    // Validés par le schéma : jamais null ici.
    const date = construireDateCreneau(saisie.jour, saisie.creneau)!;
    const passee = date.getTime() <= maintenant.getTime();

    // Seul un créneau passé se signale (même garde que `marquerReservation`).
    if ((saisie.statut === "HONOREE" || saisie.statut === "NO_SHOW") && !passee) {
      return refuser(`Une réservation ${saisie.statut} doit porter sur un créneau passé.`);
    }

    const createdAt = saisie.creeeLe ?? (passee ? date : maintenant);
    if (createdAt.getTime() > date.getTime() || createdAt.getTime() > maintenant.getTime()) {
      return refuser("creeeLe doit précéder le créneau, et ne pas être dans le futur.");
    }

    let signaleeLe: Date | null = null;
    if (saisie.statut === "HONOREE" || saisie.statut === "NO_SHOW") {
      signaleeLe = saisie.signaleeLe ?? maintenant;
      if (signaleeLe.getTime() < date.getTime() || signaleeLe.getTime() > maintenant.getTime()) {
        return refuser("signaleeLe doit tomber entre le créneau et maintenant.");
      }
    }

    reservations.push({
      element,
      restaurantId: saisie.restaurantId,
      userId,
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
  const [restaurants, dineursParId, dineursParEmail] = await Promise.all([
    prisma.restaurant.findMany({
      where: { id: { in: restaurantIdsDemandes } },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { id: { in: saisies.flatMap((s) => (s.dineurId ? [s.dineurId] : [])) } },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { email: { in: saisies.flatMap((s) => (s.dineurEmail ? [s.dineurEmail] : [])) } },
      select: { id: true, email: true },
    }),
  ]);

  const { reservations, erreurs } = resoudreReservations(
    saisies,
    {
      restaurantIds: new Set(restaurants.map((r) => r.id)),
      dineurParId: new Set(dineursParId.map((d) => d.id)),
      dineurParEmail: new Map(dineursParEmail.map((d) => [d.email, d.id])),
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
      return creees;
    },
    { timeout: DELAI_TRANSACTION_MS },
  );
}

// ---------------------------------------------------------------------------
// Factures & contestations
// ---------------------------------------------------------------------------

function debutDuMois(mois: string): Date {
  const [annee, index] = mois.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(annee, index - 1, 1));
}

/** Factures d'un mois, avec leurs lignes — de quoi choisir quoi contester. */
export async function listerFacturesMois(mois: string) {
  const factures = await prisma.facture.findMany({
    where: { mois: debutDuMois(mois) },
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

/** Même génération que le bouton de la Console staff, pour le mois donné. */
export async function genererFactures(mois: string) {
  const resultat = await genererFacturesMois(debutDuMois(mois));
  return { ...resultat, factures: await listerFacturesMois(mois) };
}

/**
 * Dépôt d'un dossier au nom d'un contact restaurant — passe par
 * `creerDossierContestation`, donc par ses règles : délai de 30 jours,
 * lignes de la bonne facture, pas de double contestation, crédit d'office
 * sous le seuil.
 */
export async function deposerDossier(saisie: z.output<typeof schemaDossier>) {
  const [facture, contact] = await Promise.all([
    prisma.facture.findUnique({ where: { id: saisie.factureId }, select: { restaurantId: true } }),
    prisma.restaurantContact.findUnique({
      where: { id: saisie.contactId },
      select: { restaurantId: true },
    }),
  ]);
  if (!facture) throw new ErreurApi(404, "Facture introuvable.");
  if (!contact) throw new ErreurApi(404, "Contact restaurant introuvable.");
  if (contact.restaurantId !== facture.restaurantId) {
    throw new ErreurApi(422, "Ce contact n'appartient pas au restaurant de cette facture.");
  }

  const resultat = await creerDossierContestation({
    factureId: saisie.factureId,
    restaurantId: facture.restaurantId,
    restaurantContactId: saisie.contactId,
    lignes: saisie.lignes,
    commentaire: saisie.commentaire,
  });
  if (!resultat.ok) throw new ErreurApi(422, resultat.erreur);

  const dossier = await prisma.dossier.findUniqueOrThrow({
    where: { id: resultat.dossierId },
    select: { id: true, statut: true, montantContesteCentimes: true },
  });
  return dossier;
}

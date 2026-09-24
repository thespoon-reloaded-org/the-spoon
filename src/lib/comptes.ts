/**
 * Brique commune de création d'un compte credential (mot de passe), partagée
 * entre `scripts/creer-compte.ts` et la création d'un contact restaurant
 * depuis la Console staff (`creerContactRestaurant` dans
 * `src/app/admin/restaurants/actions.ts`).
 *
 * Les trois populations (dîneur, contact restaurant, staff) suivent la même
 * mécanique better-auth pour une connexion par mot de passe : une ligne
 * `*Account` avec `providerId: "credential"`, `id`/`accountId`/`userId` tous
 * égaux à l'id de l'utilisateur — convention posée par `creer-compte`,
 * reprise ici pour ne pas la dupliquer.
 */
import { randomInt } from "node:crypto";

import type { Prisma, RoleContactRestaurant } from "@/generated/prisma";

import { LIBELLE_ROLE_CONTACT } from "./contacts";

/** Le `providerId` attendu par better-auth pour une connexion par mot de passe. */
export const FOURNISSEUR_CREDENTIAL = "credential";

/** Ligne de compte credential, identique pour les trois populations — voir plus haut. */
export function nouveauCompteCredential(utilisateurId: string, motDePasseHash: string) {
  return {
    id: utilisateurId,
    accountId: utilisateurId,
    providerId: FOURNISSEUR_CREDENTIAL,
    userId: utilisateurId,
    password: motDePasseHash,
  };
}

/**
 * Alphabet sans caractères ambigus (0/O, 1/l/I) : ce mot de passe est destiné
 * à être lu à l'écran par le staff puis retransmis à la main (téléphone,
 * email) à un contact restaurant — pas de canal d'envoi automatique dans ce
 * projet.
 */
const ALPHABET_MOT_DE_PASSE = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

/**
 * Mot de passe temporaire lisible pour un contact créé depuis la Console
 * staff, affiché une seule fois à l'écran (voir `creerContactRestaurant`).
 * `randomInt` (CSPRNG + tirage par rejet déjà géré nativement, sans biais
 * modulo) plutôt qu'un tirage par rejet écrit à la main.
 */
export function genererMotDePasseTemporaire(longueur = 12): string {
  let motDePasse = "";
  for (let i = 0; i < longueur; i++) {
    motDePasse += ALPHABET_MOT_DE_PASSE.charAt(randomInt(ALPHABET_MOT_DE_PASSE.length));
  }
  return motDePasse;
}

/**
 * Un contact restaurant avec son accès de connexion, et sa trace dans le
 * journal d'audit du restaurant (`AJOUT_CONTACT`) — accorder un accès est
 * l'action la plus sensible de la fiche admin, elle ne s'écrit jamais sans
 * sa trace. Partagé par la Console staff (`creerContactRestaurant`) et
 * l'API d'administration, à appeler dans une transaction.
 *
 * `creeLe` ne sert qu'à l'API, pour dater un contact d'un historique
 * reconstitué ; la trace d'audit porte alors la même date.
 */
export async function creerContactAvecAcces(
  tx: Prisma.TransactionClient,
  contact: {
    restaurantId: string;
    nom: string;
    email: string;
    role: RoleContactRestaurant;
    motDePasseHash: string;
    staffId: string;
    creeLe?: Date;
  },
) {
  const cree = await tx.restaurantContact.create({
    data: {
      restaurantId: contact.restaurantId,
      nom: contact.nom,
      email: contact.email,
      role: contact.role,
      // Pas de flux de vérification d'email dans ce projet — même
      // convention que `pnpm creer-compte` et `seed:dev`.
      emailVerified: true,
      createdAt: contact.creeLe,
    },
  });
  await tx.restaurantContactAccount.create({
    data: nouveauCompteCredential(cree.id, contact.motDePasseHash),
  });
  await tx.journalAuditRestaurant.create({
    data: {
      restaurantId: contact.restaurantId,
      staffId: contact.staffId,
      action: "AJOUT_CONTACT",
      createdAt: contact.creeLe,
      champsModifies: [
        {
          champ: "contact",
          avant: null,
          apres: `${contact.nom} (${LIBELLE_ROLE_CONTACT[contact.role]}) — ${contact.email}`,
        },
      ],
    },
  });
  return cree;
}

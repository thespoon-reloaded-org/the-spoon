/**
 * Crée — ou remet à jour — un compte de connexion sur la base pointée par
 * `DATABASE_URL`, pour tout ou partie des trois populations de TheSpoon.
 *
 * Pourquoi en plus de `seed:dev` : `seed:dev` commence par vider restaurants,
 * contacts et staff, il est fait pour une base de dev jetable. Les
 * environnements déployés, eux, n'ont jamais eu de comptes — `pnpm build` n'y
 * applique que les migrations — et leur base contient de vraies données qu'on
 * ne peut pas effacer pour se donner un accès. D'où ce script : il ne
 * supprime rien, ne touche qu'aux lignes d'authentification, et se relance
 * sans risque (il se contente alors de réécrire le mot de passe).
 *
 * ```bash
 * COMPTE_EMAIL=prenom.nom@example.com COMPTE_MOT_DE_PASSE='…' pnpm creer-compte
 * ```
 *
 * Variables lues :
 * - `COMPTE_EMAIL`, `COMPTE_MOT_DE_PASSE` — requis ;
 * - `COMPTE_NOM` — nom affiché, « Compte de test » par défaut ;
 * - `COMPTE_UNIVERS` — sous-ensemble de `client,restaurant,staff` (tous par défaut) ;
 * - `COMPTE_RESTAURANT` — nom de l'établissement auquel rattacher le contact.
 *   Absent, un compte neuf prend le premier restaurant par ordre alphabétique
 *   et un compte existant garde son rattachement.
 *
 * Contre un environnement déployé, passer la même `DATABASE_URL` que
 * l'application (sur Netlify : `netlify env:get DATABASE_URL`), et préférer un
 * fichier d'environnement au mot de passe écrit dans la ligne de commande.
 */
import "dotenv/config";

import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "../src/lib/prisma";

/** Les trois instances better-auth de `src/lib/auth.ts`, vues côté script. */
const UNIVERS = ["client", "restaurant", "staff"] as const;
type Univers = (typeof UNIVERS)[number];

/** Connexion par mot de passe : le `providerId` attendu par better-auth. */
const FOURNISSEUR = "credential";

const EMAIL = exigerVariable("COMPTE_EMAIL");
const MOT_DE_PASSE = exigerVariable("COMPTE_MOT_DE_PASSE");
const NOM = process.env.COMPTE_NOM ?? "Compte de test";
const RESTAURANT_VOULU = process.env.COMPTE_RESTAURANT;
const UNIVERS_DEMANDES = lireUnivers();

function exigerVariable(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new Error(`${nom} est requis.`);
  return valeur;
}

function lireUnivers(): readonly Univers[] {
  const brut = process.env.COMPTE_UNIVERS;
  if (!brut) return UNIVERS;

  const demandes = brut
    .split(",")
    .map((valeur) => valeur.trim())
    .filter(Boolean);
  const inconnus = demandes.filter((valeur) => !UNIVERS.includes(valeur as Univers));
  if (inconnus.length > 0) {
    throw new Error(`COMPTE_UNIVERS : ${inconnus.join(", ")} — attendu ${UNIVERS.join(", ")}.`);
  }
  return demandes as Univers[];
}

/**
 * La ligne de compte, identique pour les trois populations : c'est la
 * convention de `seed:dev`, où l'identifiant du compte reprend celui de
 * l'utilisateur. Elle ne vaut que pour une ligne créée ici — un dîneur inscrit
 * depuis le site a un identifiant de compte tiré au hasard par better-auth,
 * qu'on retrouve par `userId` plutôt que de lui en ajouter un deuxième.
 */
function nouveauCompte(utilisateurId: string, motDePasseHash: string) {
  return {
    id: utilisateurId,
    accountId: utilisateurId,
    providerId: FOURNISSEUR,
    userId: utilisateurId,
    password: motDePasseHash,
  };
}

async function creerDineur(motDePasseHash: string) {
  const dineur = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { name: NOM },
    create: { id: randomUUID(), name: NOM, email: EMAIL, emailVerified: true },
  });

  const compte = await prisma.account.findFirst({
    where: { userId: dineur.id, providerId: FOURNISSEUR },
  });
  if (compte) {
    await prisma.account.update({ where: { id: compte.id }, data: { password: motDePasseHash } });
  } else {
    await prisma.account.create({ data: nouveauCompte(dineur.id, motDePasseHash) });
  }

  return "dîneur : /connexion";
}

async function creerContactRestaurant(motDePasseHash: string) {
  const restaurant = RESTAURANT_VOULU
    ? await prisma.restaurant.findFirst({ where: { nom: RESTAURANT_VOULU } })
    : await prisma.restaurant.findFirst({ orderBy: { nom: "asc" } });
  if (!restaurant) {
    throw new Error(
      RESTAURANT_VOULU
        ? `Aucun restaurant nommé « ${RESTAURANT_VOULU} » : impossible de rattacher le contact.`
        : "Aucun restaurant en base : impossible de rattacher le contact.",
    );
  }

  const contact = await prisma.restaurantContact.upsert({
    where: { email: EMAIL },
    // Sans `COMPTE_RESTAURANT` explicite, un contact déjà en base garde son
    // établissement : le script sert alors juste à rouvrir l'accès.
    update: { nom: NOM, ...(RESTAURANT_VOULU ? { restaurantId: restaurant.id } : {}) },
    create: {
      nom: NOM,
      email: EMAIL,
      role: "GERANT",
      emailVerified: true,
      restaurantId: restaurant.id,
    },
    include: { restaurant: { select: { nom: true, ville: true } } },
  });

  const compte = await prisma.restaurantContactAccount.findFirst({
    where: { userId: contact.id, providerId: FOURNISSEUR },
  });
  if (compte) {
    await prisma.restaurantContactAccount.update({
      where: { id: compte.id },
      data: { password: motDePasseHash },
    });
  } else {
    await prisma.restaurantContactAccount.create({
      data: nouveauCompte(contact.id, motDePasseHash),
    });
  }

  return `restaurateur : /connexion-restaurant — ${contact.restaurant.nom} (${contact.restaurant.ville})`;
}

async function creerStaff(motDePasseHash: string) {
  const membre = await prisma.staff.upsert({
    where: { email: EMAIL },
    update: { nom: NOM },
    // `role` est un libellé affiché, pas un contrôle d'accès : toute la
    // Console staff est lisible par tout le staff connecté (cf. schema.prisma).
    create: { nom: NOM, email: EMAIL, role: "Produit", emailVerified: true },
  });

  const compte = await prisma.staffAccount.findFirst({
    where: { userId: membre.id, providerId: FOURNISSEUR },
  });
  if (compte) {
    await prisma.staffAccount.update({
      where: { id: compte.id },
      data: { password: motDePasseHash },
    });
  } else {
    await prisma.staffAccount.create({ data: nouveauCompte(membre.id, motDePasseHash) });
  }

  return "staff : /connexion-admin";
}

const CREATEURS: Record<Univers, (motDePasseHash: string) => Promise<string>> = {
  client: creerDineur,
  restaurant: creerContactRestaurant,
  staff: creerStaff,
};

async function run() {
  const motDePasseHash = await hashPassword(MOT_DE_PASSE);

  console.log(`${EMAIL} :`);
  for (const univers of UNIVERS_DEMANDES) {
    console.log(`  ${await CREATEURS[univers](motDePasseHash)}`);
  }
  console.log(`Restaurants en base, inchangés : ${await prisma.restaurant.count()}`);
}

run()
  .catch((erreur) => {
    console.error(erreur);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

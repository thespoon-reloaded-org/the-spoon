import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { oAuthProxy } from "better-auth/plugins";

import { env } from "./env";
import { DOMAINE_FORMATEURS, estEmailFormateur, refusIdentiteFormateur } from "./formateurs";
import { prisma } from "./prisma";

// BETTER_AUTH_URL reste l'URL de prod (même valeur pour la prod et les
// prévisualisations) — sans ça, better-auth rejette les requêtes venant des
// prévisualisations ("Invalid origin"), dont l'origine ne correspond jamais à
// BETTER_AUTH_URL. Sur Cloud Run, une prévisualisation est une révision
// taguée : `https://pr-12---spoon-<binome>-<n° projet>.europe-west1.run.app`.
// Les origines acceptées en plus viennent donc de l'environnement
// (`AUTH_TRUSTED_ORIGINS`, séparées par des virgules, jokers `*` permis).
// Partagé par toutes les instances ci-dessous : c'est une contrainte d'infra,
// pas une différence entre populations.
const trustedOrigins = env.AUTH_TRUSTED_ORIGINS;

/**
 * Auth dîneur.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  plugins: [nextCookies()],
});

/**
 * Auth restaurant partenaire — deuxième instance better-auth, entièrement
 * séparée de l'auth dîneur (table `RestaurantContact` plutôt que `User`,
 * cookie et route API dédiés). Les deux populations n'ont ni les mêmes
 * droits ni le même cycle de vie de compte, cf. "Auth & comptes" : pas de
 * bonne raison de les faire cohabiter dans une seule table avec un champ
 * "rôle".
 *
 * Pas d'inscription libre : un contact restaurant est créé côté TheSpoon
 * (aujourd'hui via `pnpm seed:dev`, migration naturelle vers le futur BO
 * admin), jamais par lui-même — `disableSignUp` coupe la route
 * `sign-up/email` même appelée côté serveur.
 */
export const authRestaurant = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth-restaurant",
  trustedOrigins,
  user: {
    modelName: "restaurantContact",
    fields: { name: "nom" },
    additionalFields: {
      restaurantId: { type: "string", required: true, input: false },
    },
  },
  session: { modelName: "restaurantContactSession" },
  account: { modelName: "restaurantContactAccount" },
  verification: { modelName: "restaurantContactVerification" },
  advanced: { cookiePrefix: "restaurant-auth" },
  plugins: [nextCookies()],
});

/**
 * Auth staff TheSpoon — troisième instance better-auth, table `Staff` dédiée
 * (organigramme interne), séparée des deux populations précédentes.
 *
 * Pas d'inscription libre non plus : un membre du staff est créé côté
 * TheSpoon (aujourd'hui via `pnpm seed:dev`), jamais par lui-même.
 *
 * Pas de permissions par rôle pour l'instant : la Console staff (BO admin)
 * est lisible par tout le staff connecté, `Staff.role` reste un texte libre
 * affiché — voir "Auth staff TheSpoon & permissions" pour la suite.
 */
export const authAdmin = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth-admin",
  trustedOrigins,
  user: {
    modelName: "staff",
    fields: { name: "nom" },
  },
  session: { modelName: "staffSession" },
  account: { modelName: "staffAccount" },
  verification: { modelName: "staffVerification" },
  advanced: { cookiePrefix: "admin-auth" },
  plugins: [nextCookies()],
});

/**
 * Auth formateur — quatrième instance better-auth, table `Formateur`. Le
 * formateur n'est pas un membre du staff : il ne voit pas la Console staff,
 * le staff ne voit pas la sienne.
 *
 * On entre par « Se connecter avec Google », limité au Workspace hymaia.com :
 * le compte se crée à la première connexion. Pas d'inscription par mot de
 * passe — ces comptes-là se créent avec `pnpm creer-compte`. Et une session
 * ne s'ouvre que pour une adresse @hymaia.com : un compte d'un autre domaine,
 * glissé en base à la main, se voit refuser la connexion elle-même, pas
 * seulement l'accès aux pages (voir src/lib/formateurs.ts).
 */
export const googleFormateursDisponible = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

export const authFormateur = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth-formateur",
  trustedOrigins,
  socialProviders: googleFormateursDisponible
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          // Proposé à Google comme indice, et surtout vérifié par better-auth
          // contre le claim `hd` du jeton : un compte Gmail personnel est
          // refusé même si son adresse finissait par le bon domaine.
          hd: DOMAINE_FORMATEURS,
          prompt: "select_account",
        },
      }
    : undefined,
  user: {
    modelName: "formateur",
    fields: { name: "nom" },
    // Deuxième verrou, indépendant de Google : l'adresse elle-même.
    validateUserInfo: ({ user }) => refusIdentiteFormateur(user.email),
  },
  session: { modelName: "formateurSession" },
  // Un formateur créé avec `pnpm creer-compte` qui se connecte ensuite avec
  // Google retrouve son compte : Google atteste l'adresse.
  account: {
    modelName: "formateurAccount",
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  verification: { modelName: "formateurVerification" },
  advanced: { cookiePrefix: "formateur-auth" },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const formateur = await prisma.formateur.findUnique({
            where: { id: session.userId },
            select: { email: true },
          });
          return formateur !== null && estEmailFormateur(formateur.email);
        },
      },
    },
  },
  // Google n'accepte que des adresses de retour déclarées une à une, et celle
  // d'une Deploy Preview change à chaque PR. Le proxy fait revenir Google sur
  // la production, qui renvoie la session à la preview d'origine : il faut
  // donc que la production ait déjà ce code pour qu'une preview se connecte.
  plugins: [oAuthProxy({ productionURL: env.BETTER_AUTH_URL }), nextCookies()],
});

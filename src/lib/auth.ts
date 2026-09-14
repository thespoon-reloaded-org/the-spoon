import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env } from "./env";
import { prisma } from "./prisma";

// BETTER_AUTH_URL reste l'URL de prod (même valeur partagée par tous les
// contextes Netlify, cf. README) — sans ça, better-auth rejette les
// requêtes venant des Deploy Previews et branch deploys ("Invalid origin"),
// dont l'origine ne correspond jamais à BETTER_AUTH_URL. Partagé par les deux
// instances ci-dessous : c'est une contrainte d'infra (le domaine Netlify),
// pas une différence entre dîneurs et restaurants partenaires.
const trustedOrigins = ["https://*--the-spoon-bootcamp.netlify.app"];

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

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env } from "./env";
import { prisma } from "./prisma";

/**
 * Auth dîneur uniquement pour l'instant — restaurant partenaire et staff
 * TheSpoon sont des stories séparées du backlog, pas encore démarrées.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // BETTER_AUTH_URL reste l'URL de prod (même valeur partagée par tous les
  // contextes Netlify, cf. README) — sans ça, better-auth rejette les
  // requêtes venant des Deploy Previews et branch deploys ("Invalid origin"),
  // dont l'origine ne correspond jamais à BETTER_AUTH_URL.
  trustedOrigins: ["https://*--the-spoon-bootcamp.netlify.app"],
  plugins: [nextCookies()],
});

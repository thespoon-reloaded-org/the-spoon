import "dotenv/config";
import { defineConfig } from "prisma/config";

// Les commandes CLI (migrate dev/deploy, introspection...) ont besoin d'une
// connexion PostgreSQL directe pour leur verrou consultatif (advisory lock) —
// la connexion "pooler" de Neon utilisée par DATABASE_URL (voir
// src/lib/prisma.ts, pour les requêtes applicatives) ne le supporte pas et
// fait échouer `prisma migrate deploy` avec un timeout P1002 en prod. En
// local/CI (Postgres sans pooler), DATABASE_URL_UNPOOLED n'existe pas et on
// retombe sur DATABASE_URL sans rien changer.
console.error(
  "[diag] DATABASE_URL_UNPOOLED len=" + (process.env.DATABASE_URL_UNPOOLED?.length ?? "undefined"),
  "DATABASE_URL len=" + (process.env.DATABASE_URL?.length ?? "undefined"),
);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});

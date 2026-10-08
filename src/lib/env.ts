import { z } from "zod";

/**
 * Variables d'environnement, validées au démarrage — pour échouer tout de
 * suite en disant quoi corriger plutôt que de casser silencieusement plus
 * tard.
 */
const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .describe("URL de connexion PostgreSQL, ex. postgresql://user@localhost:5432/thespoon_dev"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(1)
    .describe("Clé de signature des sessions — générer avec `openssl rand -hex 32`"),
  BETTER_AUTH_URL: z.string().min(1).describe("URL de base de l'app, ex. http://localhost:3100"),
  // API d'administration (`/api/admin`, voir src/lib/api-admin/garde.ts) :
  // absente tant que le jeton n'est pas posé. Lus bruts, sans autre
  // contrainte : une valeur mal formée pour cette fonction optionnelle doit
  // garder l'API fermée (c'est la garde qui la juge), pas empêcher tout le
  // site de démarrer. Une variable vide compte comme absente — Netlify laisse
  // facilement une valeur "" derrière soi.
  ADMIN_API_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  ADMIN_API_STAFF_EMAIL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().trim().toLowerCase().optional(),
  ),
  // Assistant de recherche de l'accueil (`/api/chatbot`) : l'une ou l'autre
  // clé, OpenRouter prioritaire (voir src/lib/chatbot/agent.ts). Aucune des
  // deux : la route répond 503 et le widget n'est pas affiché — le reste du
  // site n'en dépend pas.
  ANTHROPIC_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  OPENROUTER_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  // « Se connecter avec Google » de la console formateur (voir
  // src/lib/formateurs.ts) : un client OAuth du Workspace Hymaia. Absent, le
  // bouton n'est pas affiché et la connexion par mot de passe reste seule.
  GOOGLE_CLIENT_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
});

function lire() {
  const resultat = schema.safeParse(process.env);

  if (!resultat.success) {
    const details = resultat.error.issues
      .map((i) => `  · ${i.path.join(".") || "(inconnu)"} : ${i.message}`)
      .join("\n");

    throw new Error(
      [
        "Configuration incomplète — l'app ne peut pas démarrer.",
        details,
        "",
        "Voir .env.example.",
      ].join("\n"),
    );
  }

  return resultat.data;
}

export const env = lire();

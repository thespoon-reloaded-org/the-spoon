import { z } from "zod";

// TheSpoon n'opère qu'en France : on fixe le fuseau du process pour que les
// dates de réservation (construites en heure locale, cf. src/lib/creneaux.ts)
// ne dépendent pas du fuseau par défaut de l'infra de déploiement.
process.env.TZ ??= "Europe/Paris";

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
  BETTER_AUTH_SECRET: z.string().min(1).describe("Clé de signature des sessions — générer avec `openssl rand -hex 32`"),
  BETTER_AUTH_URL: z.string().min(1).describe("URL de base de l'app, ex. http://localhost:3100"),
});

function lire() {
  const resultat = schema.safeParse(process.env);

  if (!resultat.success) {
    const details = resultat.error.issues
      .map((i) => `  · ${i.path.join(".") || "(inconnu)"} : ${i.message}`)
      .join("\n");

    throw new Error(
      ["Configuration incomplète — l'app ne peut pas démarrer.", details, "", "Voir .env.example."].join(
        "\n",
      ),
    );
  }

  return resultat.data;
}

export const env = lire();

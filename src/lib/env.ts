import { z } from "zod";

/**
 * Variables d'environnement, validées au démarrage — pour échouer tout de
 * suite en disant quoi corriger plutôt que de casser silencieusement plus
 * tard. S'étoffera avec BETTER_AUTH_* quand l'auth arrivera.
 */
const schema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .describe("URL de connexion PostgreSQL, ex. postgresql://user@localhost:5432/thespoon_dev"),
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

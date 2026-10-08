import { ConnexionFormateur } from "@/components/ConnexionFormateur";
import { googleFormateursDisponible } from "@/lib/auth";
import { messageErreurConnexion } from "@/lib/formateurs";

/**
 * Connexion des formateurs Hymaia. Côté serveur, ce que le formulaire ne
 * peut pas savoir seul : si « Se connecter avec Google » est configuré, et
 * pourquoi Google a renvoyé ici (`?error=…`) quand la connexion a échoué.
 */
export default async function ConnexionFormateurPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  return (
    <ConnexionFormateur
      googleDisponible={googleFormateursDisponible}
      erreurGoogle={messageErreurConnexion(typeof error === "string" ? error : null)}
    />
  );
}

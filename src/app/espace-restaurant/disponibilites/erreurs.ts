/**
 * Les refus des actions de cet écran, et ce qu'ils disent au partenaire.
 *
 * Ces actions sont de simples boutons-formulaires, sans `useActionState` :
 * leur seul canal de retour est l'URL, comme la navigation ?mois=&jour= de
 * l'écran. Un refus muet — le partenaire clique, rien ne bouge, rien ne
 * s'explique — n'est pas une option quand le geste porte sur ce que les
 * dîneurs pourront réserver.
 *
 * Module séparé des actions : un fichier "use server" ne peut exporter que
 * des fonctions asynchrones.
 */
export const ERREURS_DISPONIBILITES = {
  serviceInvalide: "service-invalide",
  dernierService: "dernier-service",
} as const;

export const MESSAGES_ERREUR: Record<string, string> = {
  [ERREURS_DISPONIBILITES.serviceInvalide]:
    "Ce service n'a pas pu être ajouté : l'heure de fin doit venir après celle de début, dans la même journée. Un service qui se prolonge après minuit se déclare jusqu'à 23h59.",
  [ERREURS_DISPONIBILITES.dernierService]:
    "Vos horaires ne peuvent pas être entièrement vides : sans aucun service déclaré, votre fiche reproposerait tous les créneaux aux dîneurs. Pour une fermeture longue, posez-la sur les dates concernées ci-dessous.",
};

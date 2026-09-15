/**
 * Les trois univers de TheSpoon.
 *
 * Trois populations se connectent (dîneur, contact restaurant, staff), sur
 * trois instances better-auth séparées, vers trois produits qui n'ont rien à
 * voir : une vitrine de réservation, un outil de gestion de salle, une console
 * interne. Jusqu'ici les trois écrans de connexion étaient identiques au pixel
 * près — on ne savait pas où on venait d'atterrir, et un restaurateur tombant
 * sur `/connexion` n'avait aucun moyen de comprendre qu'il n'était pas au bon
 * endroit.
 *
 * D'où ce fichier : une couleur, une photo et un discours par univers, partagés
 * entre l'écran de connexion et l'espace connecté correspondant.
 */

export type CleUnivers = "client" | "restaurant" | "staff";

export type Univers = {
  cle: CleUnivers;
  /** Page de connexion de cet univers. */
  href: string;
  /** Libellé du sélecteur « vous êtes… ». */
  onglet: string;
  /** Nom de l'espace une fois connecté. */
  espace: string;
  titre: string;
  baseline: string;
  photo: string;
  photoAlt: string;
  /** Ce que l'univers permet de faire — trois arguments, pas plus. */
  atouts: readonly string[];
  /** Le fond de la moitié « formulaire ». */
  fond: string;
  encre: string;
  encreDouce: string;
  /** Couleur des actions (bouton principal, liens). */
  accent: string;
  accentSurvol: string;
  /** Couleur du texte posé sur l'accent. */
  surAccent: string;
  /** Voile posé sur la photo, pour teinter l'univers. */
  voile: string;
  /** Classe appliquée au conteneur — pilote l'anneau de focus (cf. globals.css). */
  classeUnivers: string;
};

export const UNIVERS: Record<CleUnivers, Univers> = {
  client: {
    cle: "client",
    href: "/connexion",
    onglet: "Je réserve une table",
    espace: "Espace dîneur",
    titre: "Bonjour, on mange où ce soir ?",
    baseline:
      "Tes réservations, tes annulations et tes avis en cuillères, au même endroit.",
    photo: "/images/univers-client.jpg",
    photoAlt: "Des convives partagent un repas autour d'une table",
    atouts: [
      "Réserve midi ou soir, jusqu'à cinq jours à l'avance",
      "Annule depuis « Mes réservations », sans appeler le restaurant",
      "Note de 1 à 5 cuillères les adresses où tu es vraiment allé",
    ],
    fond: "var(--color-cream)",
    encre: "var(--color-ink)",
    encreDouce: "var(--color-ink-soft)",
    accent: "var(--color-accent)",
    accentSurvol: "var(--color-accent-hover)",
    surAccent: "#ffffff",
    voile:
      "linear-gradient(180deg, rgb(216 30 74 / 0.1) 0%, rgb(216 30 74 / 0.34) 48%, rgb(120 12 40 / 0.88) 100%)",
    classeUnivers: "",
  },

  restaurant: {
    cle: "restaurant",
    href: "/connexion-restaurant",
    onglet: "Je tiens un restaurant",
    espace: "Espace restaurateur",
    titre: "Votre salle, en un coup d'œil.",
    baseline:
      "Réservations reçues, disponibilités, carte et factures : le poste de pilotage de votre établissement.",
    photo: "/images/univers-restaurant.jpg",
    photoAlt: "Un chef dresse une assiette en cuisine",
    atouts: [
      "Suivez les réservations reçues et signalez les no-shows",
      "Ouvrez ou fermez vos créneaux, jour par jour",
      "Tenez votre carte et votre fiche à jour en direct",
    ],
    fond: "var(--color-pro-tint)",
    encre: "var(--color-pro-ink)",
    encreDouce: "#3c5f55",
    accent: "var(--color-pro)",
    accentSurvol: "var(--color-pro-deep)",
    surAccent: "var(--color-cream)",
    voile:
      "linear-gradient(180deg, rgb(11 36 29 / 0.14) 0%, rgb(18 58 48 / 0.46) 48%, rgb(7 26 21 / 0.92) 100%)",
    classeUnivers: "univers-pro",
  },

  staff: {
    cle: "staff",
    href: "/connexion-admin",
    onglet: "Staff TheSpoon",
    espace: "Console staff",
    titre: "Console staff TheSpoon.",
    baseline: "Le back-office interne : partenaires, fiches et facturation mensuelle.",
    photo: "/images/univers-staff.jpg",
    photoAlt: "Une salle de restaurant vide, aux tons froids",
    atouts: [
      "Cherchez et éditez les fiches des restaurants partenaires",
      "Suivez le journal d'audit de chaque modification",
      "Déclenchez et consultez les factures mensuelles",
    ],
    fond: "var(--color-staff-tint)",
    encre: "var(--color-staff)",
    encreDouce: "#4b4f72",
    accent: "var(--color-staff)",
    accentSurvol: "var(--color-staff-deep)",
    surAccent: "var(--color-cream)",
    voile:
      "linear-gradient(180deg, rgb(17 19 39 / 0.2) 0%, rgb(26 29 51 / 0.52) 48%, rgb(13 15 30 / 0.93) 100%)",
    classeUnivers: "univers-staff",
  },
};

/** Les deux portes proposées au visiteur — le staff n'en fait pas partie, il n'est pas public. */
export const UNIVERS_PUBLICS = [UNIVERS.client, UNIVERS.restaurant] as const;

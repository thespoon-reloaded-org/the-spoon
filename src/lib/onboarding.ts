/**
 * Ce qu'on montre à quelqu'un qui arrive — un parcours par univers.
 *
 * Trois populations, trois produits qui n'ont rien à voir : le dîneur ne
 * gagne rien à lire comment on instruit un litige. D'où trois parcours
 * distincts, et pas un seul tronc commun avec des variantes.
 *
 * Les clés sont celles de `src/lib/univers.ts` — une seule façon de nommer
 * les trois univers dans tout le produit.
 *
 * Ce module ne porte que du contenu : la coquille qui le déroule est
 * `src/components/Onboarding.tsx`, la trace du passage est en base
 * (`onboardingVuLe`). Écrire les étapes ici plutôt que dans le composant, ce
 * n'est pas de la mise en forme — c'est pour qu'ajouter une étape ou en
 * corriger une phrase ne demande pas de toucher à la mécanique.
 *
 * Quelques étapes : au-delà de cinq, plus personne ne va au bout.
 */

import type { CleUnivers } from "./univers";

export type EtapeOnboarding = {
  titre: string;
  texte: string;
  /** L'écran dont parle l'étape : on y envoie plutôt que de le décrire. */
  lien?: { href: string; libelle: string };
};

export type Parcours = {
  /** Titre de la fenêtre. Le bouton qui la rouvre dit « Comment ça marche »
   *  partout — trois libellés différents pour le même geste n'aideraient
   *  personne. */
  titre: string;
  accroche: string;
  etapes: readonly EtapeOnboarding[];
};

export const PARCOURS: Record<CleUnivers, Parcours> = {
  client: {
    titre: "Bienvenue sur TheSpoon",
    accroche: "Quatre écrans, et vous savez tout.",
    etapes: [
      {
        titre: "Trouver une table",
        texte:
          "Cherchez par ville ou par type de cuisine. Chaque adresse affiche sa note en cuillères, ses plats signature et ses horaires réels — pas une promesse, ce que le restaurant a déclaré.",
        lien: { href: "/", libelle: "Voir la recherche" },
      },
      {
        titre: "Réserver en trois clics",
        texte:
          "Le nombre de convives, le jour, le créneau. On ne vous propose que les créneaux que le restaurant ouvre vraiment et où il reste de la place : pas de réservation refusée après coup.",
      },
      {
        titre: "Changer d'avis",
        texte:
          "Depuis « Mes réservations », annulez gratuitement dans le délai fixé par le restaurant. Passé ce délai, vous pouvez encore prévenir que vous ne viendrez pas — le restaurant libère la table, et sait que vous n'avez pas disparu.",
        lien: { href: "/mes-reservations", libelle: "Mes réservations" },
      },
      {
        titre: "Donner votre avis",
        texte:
          "Après le repas, notez de 1 à 5 cuillères. Seuls les dîneurs venus sur place peuvent noter — c'est ce qui rend les notes crédibles.",
      },
    ],
  },

  restaurant: {
    titre: "Bienvenue dans votre espace",
    accroche: "Quatre écrans à connaître avant de recevoir vos premières réservations.",
    etapes: [
      {
        titre: "Votre fiche",
        texte:
          "Nom, adresse, description, capacité, photo : c'est exactement ce que voit un dîneur avant de réserver chez vous.",
        lien: { href: "/espace-restaurant/fiche", libelle: "Ma fiche" },
      },
      {
        titre: "Vos horaires — l'étape à ne pas sauter",
        texte:
          "Déclarez vos services, jour par jour. Tant que vous n'avez rien déclaré, vos créneaux sont proposés midi et soir, sept jours sur sept : vous recevrez des réservations pour des services que vous n'assurez pas.",
        lien: { href: "/espace-restaurant/disponibilites", libelle: "Mes disponibilités" },
      },
      {
        titre: "Vos réservations",
        texte:
          "Après chaque service, pointez honoré ou no-show. Ce geste n'est pas de l'administratif : c'est lui qui alimente votre facture, puisque la commission ne porte que sur les couverts réellement servis.",
        lien: { href: "/espace-restaurant/reservations", libelle: "Mes réservations reçues" },
      },
      {
        titre: "Vos factures",
        texte:
          "Une facture par mois, 2,50 € par couvert servi. Une ligne vous paraît fausse ? Vous la contestez depuis la facture, et TheSpoon vous répond — sous un certain montant, l'avoir est accordé sans discussion.",
        lien: { href: "/espace-restaurant/factures", libelle: "Mes factures" },
      },
    ],
  },

  staff: {
    titre: "Bienvenue dans la console",
    accroche: "Ce que vous pouvez faire ici, et ce qui se décide sans vous.",
    etapes: [
      {
        titre: "Les restaurants",
        texte:
          "La fiche de chaque partenaire, ses contacts, ses réservations récentes. Chaque modification que vous y faites est consignée dans son journal d'audit, avec la valeur avant et après.",
        lien: { href: "/admin/restaurants", libelle: "Les restaurants" },
      },
      {
        titre: "La facturation",
        texte:
          "Les factures mensuelles se déclenchent d'ici, restaurant par restaurant ou toutes à la fois. Relancer un mois déjà traité ne double rien : les lignes manquantes rejoignent la facture existante.",
        lien: { href: "/admin/factures", libelle: "La facturation" },
      },
      {
        titre: "Les litiges",
        texte:
          "Un partenaire conteste une ligne, le dossier arrive dans la file. Vous le prenez en charge, demandez un complément si besoin, puis tranchez : accordé, partiel, refusé — ou escaladé si ce n'est pas à vous de décider.",
        lien: { href: "/admin/litiges", libelle: "La file des litiges" },
      },
      {
        titre: "Ce qui se décide sans vous",
        texte:
          "Sous un certain montant, une contestation est créditée d'office : l'avoir part sans instruction. Ce seuil se règle dans les réglages, et il tranche à votre place tant qu'il est en vigueur.",
        lien: { href: "/admin/contestation", libelle: "Réglages contestation" },
      },
    ],
  },
};

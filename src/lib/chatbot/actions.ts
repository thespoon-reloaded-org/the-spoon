"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import type { JourReservable } from "@/lib/creneaux";
import { lireCarteReservation } from "@/lib/disponibilites";
import { prisma } from "@/lib/prisma";
import { capaciteEffective } from "@/lib/reservation";

export type CarteReservationAssistant = {
  estConnecte: boolean;
  jours: JourReservable[];
  ouvertures: Record<string, string[]>;
  occupation: Record<string, number>;
  capacite: number;
  delaiAnnulationHeures: number | null;
};

/**
 * Ce qu'il faut pour afficher la carte de réservation d'un restaurant dans
 * l'assistant de l'accueil — exactement ce que la fiche restaurant lui passe
 * (voir `lireCarteReservation`). La réservation elle-même passe ensuite par
 * `creerReservation`, la même action que sur la fiche, qui revérifie tout.
 * Lu au clic sur « Réserver », pas avec la liste : une liste de dix ne doit
 * pas coûter dix lectures de planning, et la connexion a pu changer depuis.
 */
export async function lireReservationAssistant(
  restaurantId: string,
): Promise<CarteReservationAssistant | null> {
  if (typeof restaurantId !== "string" || restaurantId.length === 0 || restaurantId.length > 40) {
    return null;
  }
  const [restaurant, session] = await Promise.all([
    prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { capacite: true, delaiAnnulationHeures: true },
    }),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!restaurant) return null;

  const { jours, ouvertures, occupation } = await lireCarteReservation(restaurantId);
  return {
    estConnecte: Boolean(session),
    jours,
    ouvertures,
    occupation,
    capacite: capaciteEffective(restaurant.capacite),
    delaiAnnulationHeures: restaurant.delaiAnnulationHeures,
  };
}

/**
 * Ce qui est réservable, et quand — la seule lecture qui réponde à cette
 * question dans le produit.
 *
 * Deux plannings se superposent : les horaires d'ouverture habituels
 * (`PlageOuverture`, voir src/lib/horaires.ts) et les exceptions posées sur
 * une date précise (`ExceptionHoraire`), qui recouvrent les premiers pour ce
 * seul jour, dans un sens comme dans l'autre. La règle est écrite une fois
 * ici parce que trois écrans en dépendent — la carte de réservation du
 * dîneur, "Mes disponibilités" côté partenaire, et la création de
 * réservation qui refuse ce que le dîneur n'aurait pas dû voir. Trois copies
 * de la même règle, c'est trois occasions qu'elles divergent.
 */

import { CRENEAUX_HORAIRES, jourSemaineIso } from "./creneaux";
import { creneauDansLesHoraires, type Plage } from "./horaires";
import { prisma } from "./prisma";

/** Les colonnes d'`ExceptionHoraire` dont dépend ce module. */
export type Exception = { jour: string; creneau: string; ouvert: boolean };

/** Jour de semaine ISO (0 = lundi … 6 = dimanche) d'une date "YYYY-MM-DD". */
export function jourSemaineDeIso(jourIso: string): number {
  return jourSemaineIso(new Date(`${jourIso}T00:00:00`));
}

/**
 * Ouverture effective d'un créneau à une date donnée. Une exception sur ce
 * couple (jour, créneau) tranche seule ; sinon ce sont les horaires
 * habituels qui répondent.
 */
export function creneauOuvert({
  plages,
  exceptions,
  jourIso,
  creneau,
}: {
  plages: Plage[];
  exceptions: Exception[];
  jourIso: string;
  creneau: string;
}): boolean {
  const exception = exceptions.find((e) => e.jour === jourIso && e.creneau === creneau);
  if (exception) return exception.ouvert;
  return creneauDansLesHoraires(plages, jourSemaineDeIso(jourIso), creneau);
}

/** Les créneaux ouverts de chaque jour, indexés par jour ISO. Un jour fermé rend une liste vide. */
export function ouverturesParJour({
  plages,
  exceptions,
  joursIso,
}: {
  plages: Plage[];
  exceptions: Exception[];
  joursIso: string[];
}): Record<string, string[]> {
  return Object.fromEntries(
    joursIso.map((jourIso) => [
      jourIso,
      CRENEAUX_HORAIRES.filter((creneau) =>
        creneauOuvert({ plages, exceptions, jourIso, creneau }),
      ),
    ]),
  );
}

/** Horaires habituels et exceptions d'un restaurant sur une fenêtre de dates. */
export async function lirePlanning(
  restaurantId: string,
  { du, au }: { du: string; au: string },
): Promise<{ plages: Plage[]; exceptions: Exception[] }> {
  const [plages, exceptions] = await Promise.all([
    prisma.plageOuverture.findMany({
      where: { restaurantId },
      select: { jourSemaine: true, debutMinutes: true, finMinutes: true },
    }),
    prisma.exceptionHoraire.findMany({
      where: { restaurantId, jour: { gte: du, lte: au } },
      select: { jour: true, creneau: true, ouvert: true },
    }),
  ]);
  return { plages, exceptions };
}

/**
 * Ce qu'il faut à une fiche restaurant : les horaires à afficher et les
 * créneaux ouverts sur les jours demandés, en une seule lecture — les deux
 * sortent de la même donnée, les lire deux fois inviterait à les voir
 * diverger. `joursIso` doit être trié, la fenêtre lue va du premier au
 * dernier.
 */
export async function lireDisponibilites(
  restaurantId: string,
  joursIso: string[],
): Promise<{ plages: Plage[]; ouvertures: Record<string, string[]> }> {
  if (joursIso.length === 0) return { plages: [], ouvertures: {} };
  const { plages, exceptions } = await lirePlanning(restaurantId, {
    du: joursIso[0]!,
    au: joursIso[joursIso.length - 1]!,
  });
  return { plages, ouvertures: ouverturesParJour({ plages, exceptions, joursIso }) };
}

/**
 * Ce créneau daté est-il réservable ? Emprunte le chemin qui a servi à
 * l'afficher : ce que le dîneur a vu et ce que le serveur accepte ne peuvent
 * pas diverger.
 */
export async function creneauEstOuvert(
  restaurantId: string,
  jourIso: string,
  creneau: string,
): Promise<boolean> {
  const { plages, exceptions } = await lirePlanning(restaurantId, { du: jourIso, au: jourIso });
  return creneauOuvert({ plages, exceptions, jourIso, creneau });
}

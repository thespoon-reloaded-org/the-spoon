"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authRestaurant } from "@/lib/auth";
import { CRENEAUX_HORAIRES, formatIso, jourSemaineIso } from "@/lib/creneaux";
import { prisma } from "@/lib/prisma";

const REGEX_JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

function creneauValide(
  creneau: string | null,
): creneau is null | (typeof CRENEAUX_HORAIRES)[number] {
  return creneau === null || (CRENEAUX_HORAIRES as readonly string[]).includes(creneau);
}

function joursValides(jourIso: string): boolean {
  return REGEX_JOUR_ISO.test(jourIso) && jourIso >= formatIso(new Date());
}

/**
 * Ferme ou rouvre un jour de semaine (planning récurrent, "horaire
 * d'ouverture classique") — la journée entière si `creneau` est `null`,
 * sinon ce seul créneau chaque semaine.
 */
export async function basculerHoraireHebdo(
  jourSemaine: number,
  creneau: string | null,
  fermer: boolean,
  _formData: FormData,
) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || jourSemaine < 0 || jourSemaine > 6 || !creneauValide(creneau)) return;

  const restaurantId = session.user.restaurantId;

  if (fermer) {
    const existe = await prisma.horaireFermeture.findFirst({
      where: { restaurantId, jourSemaine, creneau },
    });
    if (!existe) {
      await prisma.horaireFermeture.create({ data: { restaurantId, jourSemaine, creneau } });
    }
  } else {
    await prisma.horaireFermeture.deleteMany({ where: { restaurantId, jourSemaine, creneau } });
  }

  revalidatePath("/espace-restaurant/disponibilites");
}

/** Le planning récurrent dit-il ce créneau fermé pour ce jour de semaine ? */
async function estFermeParRecurrent(restaurantId: string, jourSemaine: number, creneau: string) {
  const recurrent = await prisma.horaireFermeture.findFirst({
    where: { restaurantId, jourSemaine, OR: [{ creneau: null }, { creneau }] },
  });
  return !!recurrent;
}

/**
 * Bascule l'état effectif d'un créneau pour une date précise — ouverture ou
 * fermeture exceptionnelle selon ce que dit le planning récurrent pour ce
 * jour de semaine (jamais l'inverse d'un état affiché par le client, qui
 * pourrait être périmé). Cliquer une deuxième fois retire l'exception et
 * revient au planning récurrent — pas de session ouverte-fermée-ouverte qui
 * s'accumule en base.
 */
export async function basculerException(jourIso: string, creneau: string, _formData: FormData) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || !joursValides(jourIso) || !creneauValide(creneau) || creneau === null) return;

  const restaurantId = session.user.restaurantId;
  const jourSemaine = jourSemaineIso(new Date(`${jourIso}T00:00:00`));

  const existante = await prisma.exceptionHoraire.findUnique({
    where: { restaurantId_jour_creneau: { restaurantId, jour: jourIso, creneau } },
  });

  if (existante) {
    await prisma.exceptionHoraire.delete({ where: { id: existante.id } });
  } else {
    const ferme = await estFermeParRecurrent(restaurantId, jourSemaine, creneau);
    // Le récurrent dit fermé : l'exception ouvre. Le récurrent dit ouvert : l'exception ferme.
    await prisma.exceptionHoraire.create({
      data: { restaurantId, jour: jourIso, creneau, ouvert: ferme },
    });
  }

  revalidatePath("/espace-restaurant/disponibilites");
}

/**
 * Ferme ou ouvre les `CRENEAUX_HORAIRES` d'une date précise en une fois —
 * pratique pour un jour férié ou un événement plutôt que de cliquer chaque
 * créneau. Ne crée une exception que là où elle change réellement l'état
 * effectif (sinon elle est retirée, pour ne pas accumuler des exceptions
 * qui ne font que confirmer le récurrent).
 */
export async function basculerExceptionJournee(
  jourIso: string,
  fermer: boolean,
  _formData: FormData,
) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || !joursValides(jourIso)) return;

  const restaurantId = session.user.restaurantId;
  const jourSemaine = jourSemaineIso(new Date(`${jourIso}T00:00:00`));
  const cibleOuvert = !fermer;

  await Promise.all(
    CRENEAUX_HORAIRES.map(async (creneau) => {
      const fermeParRecurrent = await estFermeParRecurrent(restaurantId, jourSemaine, creneau);
      const ouvertParDefaut = !fermeParRecurrent;

      if (ouvertParDefaut === cibleOuvert) {
        await prisma.exceptionHoraire.deleteMany({
          where: { restaurantId, jour: jourIso, creneau },
        });
      } else {
        await prisma.exceptionHoraire.upsert({
          where: { restaurantId_jour_creneau: { restaurantId, jour: jourIso, creneau } },
          create: { restaurantId, jour: jourIso, creneau, ouvert: cibleOuvert },
          update: { ouvert: cibleOuvert },
        });
      }
    }),
  );

  revalidatePath("/espace-restaurant/disponibilites");
}

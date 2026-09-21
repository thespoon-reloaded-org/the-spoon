"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { authRestaurant } from "@/lib/auth";
import { CRENEAUX_HORAIRES, formatIso } from "@/lib/creneaux";
import { creneauOuvert, lirePlanning } from "@/lib/disponibilites";
import { fusionnerPlages, minutesDepuisHeureInput } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";

const REGEX_JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

function creneauValide(creneau: string): creneau is (typeof CRENEAUX_HORAIRES)[number] {
  return (CRENEAUX_HORAIRES as readonly string[]).includes(creneau);
}

function joursValides(jourIso: string): boolean {
  return REGEX_JOUR_ISO.test(jourIso) && jourIso >= formatIso(new Date());
}

/**
 * Ce qui change ici change aussi ce que voit le dîneur : la fiche publique
 * affiche les mêmes horaires et n'en propose pas d'autres créneaux.
 */
function revaliderEcransConcernes(restaurantId: string) {
  revalidatePath("/espace-restaurant/disponibilites");
  revalidatePath(`/restaurants/${restaurantId}`);
}

/**
 * Ajoute un service (12h – 14h, 19h – 22h30…) aux horaires habituels d'un
 * jour de semaine. Les plages du jour sont réécrites fusionnées : deux
 * services qui se chevauchent n'ont pas à exister en deux lignes, et un
 * dîneur ne doit jamais pouvoir lire deux versions des mêmes horaires.
 */
export async function ajouterPlage(jourSemaine: number, formData: FormData) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || jourSemaine < 0 || jourSemaine > 6) return;

  const debutMinutes = minutesDepuisHeureInput(formData.get("debut"));
  const finMinutes = minutesDepuisHeureInput(formData.get("fin"));
  if (debutMinutes === null || finMinutes === null || debutMinutes >= finMinutes) return;

  const restaurantId = session.user.restaurantId;
  const existantes = await prisma.plageOuverture.findMany({
    where: { restaurantId, jourSemaine },
    select: { debutMinutes: true, finMinutes: true },
  });
  const fusionnees = fusionnerPlages([...existantes, { debutMinutes, finMinutes }]);

  await prisma.$transaction([
    prisma.plageOuverture.deleteMany({ where: { restaurantId, jourSemaine } }),
    prisma.plageOuverture.createMany({
      data: fusionnees.map((plage) => ({ restaurantId, jourSemaine, ...plage })),
    }),
  ]);

  revaliderEcransConcernes(restaurantId);
}

/** Retire un service. Un jour sans service est fermé ce jour-là. */
export async function retirerPlage(plageId: string, _formData: FormData) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return;

  const restaurantId = session.user.restaurantId;
  // Filtré sur le restaurant de la session : un identifiant de plage seul ne
  // dit pas à qui elle appartient.
  await prisma.plageOuverture.deleteMany({ where: { id: plageId, restaurantId } });

  revaliderEcransConcernes(restaurantId);
}

/** Ferme un jour de semaine — ses services disparaissent, plus rien n'y est réservable. */
export async function fermerJour(jourSemaine: number, _formData: FormData) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || jourSemaine < 0 || jourSemaine > 6) return;

  const restaurantId = session.user.restaurantId;
  await prisma.plageOuverture.deleteMany({ where: { restaurantId, jourSemaine } });

  revaliderEcransConcernes(restaurantId);
}

/**
 * Bascule l'état effectif d'un créneau pour une date précise — ouverture ou
 * fermeture exceptionnelle selon ce que disent les horaires habituels ce
 * jour-là (jamais l'inverse d'un état affiché par le client, qui pourrait
 * être périmé). Cliquer une deuxième fois retire l'exception et revient aux
 * horaires habituels — pas de session ouverte-fermée-ouverte qui s'accumule
 * en base.
 */
export async function basculerException(jourIso: string, creneau: string, _formData: FormData) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || !joursValides(jourIso) || !creneauValide(creneau)) return;

  const restaurantId = session.user.restaurantId;

  const existante = await prisma.exceptionHoraire.findUnique({
    where: { restaurantId_jour_creneau: { restaurantId, jour: jourIso, creneau } },
  });

  if (existante) {
    await prisma.exceptionHoraire.delete({ where: { id: existante.id } });
  } else {
    const { plages } = await lirePlanning(restaurantId, { du: jourIso, au: jourIso });
    // Les horaires disent fermé : l'exception ouvre. Ils disent ouvert : elle ferme.
    await prisma.exceptionHoraire.create({
      data: {
        restaurantId,
        jour: jourIso,
        creneau,
        ouvert: !creneauOuvert({ plages, exceptions: [], jourIso, creneau }),
      },
    });
  }

  revaliderEcransConcernes(restaurantId);
}

/**
 * Ferme ou ouvre les `CRENEAUX_HORAIRES` d'une date précise en une fois —
 * pratique pour un jour férié ou un événement plutôt que de cliquer chaque
 * créneau. Ne crée une exception que là où elle change réellement l'état
 * effectif (sinon elle est retirée, pour ne pas accumuler des exceptions
 * qui ne font que confirmer les horaires habituels).
 */
export async function basculerExceptionJournee(
  jourIso: string,
  fermer: boolean,
  _formData: FormData,
) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || !joursValides(jourIso)) return;

  const restaurantId = session.user.restaurantId;
  const cibleOuvert = !fermer;
  const { plages } = await lirePlanning(restaurantId, { du: jourIso, au: jourIso });

  const aExceptionner = CRENEAUX_HORAIRES.filter(
    (creneau) => creneauOuvert({ plages, exceptions: [], jourIso, creneau }) !== cibleOuvert,
  );
  const aRemettreParDefaut = CRENEAUX_HORAIRES.filter(
    (creneau) => !aExceptionner.includes(creneau),
  );

  await prisma.$transaction([
    prisma.exceptionHoraire.deleteMany({
      where: { restaurantId, jour: jourIso, creneau: { in: [...aRemettreParDefaut] } },
    }),
    ...aExceptionner.map((creneau) =>
      prisma.exceptionHoraire.upsert({
        where: { restaurantId_jour_creneau: { restaurantId, jour: jourIso, creneau } },
        create: { restaurantId, jour: jourIso, creneau, ouvert: cibleOuvert },
        update: { ouvert: cibleOuvert },
      }),
    ),
  ]);

  revaliderEcransConcernes(restaurantId);
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authRestaurant } from "@/lib/auth";
import { CRENEAUX_HORAIRES, formatIso } from "@/lib/creneaux";
import { creneauOuvert, lirePlanning } from "@/lib/disponibilites";
import { fusionnerPlages, minutesDepuisHeureInput } from "@/lib/horaires";
import { prisma } from "@/lib/prisma";

import { ERREURS_DISPONIBILITES } from "./erreurs";

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

function refuser(erreur: string): never {
  redirect(`/espace-restaurant/disponibilites?erreur=${erreur}`);
}

/**
 * Sérialise les écritures sur les horaires d'un restaurant : toutes lisent
 * l'état courant avant de le réécrire, et deux contacts du même
 * établissement peuvent cliquer en même temps. Même verrou que
 * `reserverCreneau` (src/lib/reservation.ts), pour la même raison : c'est la
 * base qui garantit, pas l'ordre d'exécution du code applicatif.
 */
async function avecHorairesVerrouilles<T>(
  restaurantId: string,
  ecrire: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id = ${restaurantId} FOR UPDATE`;
    return ecrire(tx);
  });
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
  if (debutMinutes === null || finMinutes === null || debutMinutes >= finMinutes) {
    refuser(ERREURS_DISPONIBILITES.serviceInvalide);
  }

  const restaurantId = session.user.restaurantId;
  await avecHorairesVerrouilles(restaurantId, async (tx) => {
    const existantes = await tx.plageOuverture.findMany({
      where: { restaurantId, jourSemaine },
      select: { debutMinutes: true, finMinutes: true },
    });
    const fusionnees = fusionnerPlages([...existantes, { debutMinutes, finMinutes }]);

    await tx.plageOuverture.deleteMany({ where: { restaurantId, jourSemaine } });
    await tx.plageOuverture.createMany({
      data: fusionnees.map((plage) => ({ restaurantId, jourSemaine, ...plage })),
    });
  });

  revaliderEcransConcernes(restaurantId);
}

/**
 * Retire des services, en refusant de vider complètement les horaires.
 *
 * "Aucune plage nulle part" veut dire "ce restaurant n'a jamais déclaré ses
 * horaires", et cet état rouvre tous les créneaux (voir `horairesDeclares`).
 * Laisser un partenaire y retomber en retirant son dernier service ferait
 * exactement l'inverse de ce qu'il demande : sa fiche repasserait en "ouvert
 * midi et soir, 7j/7". Une fermeture longue se pose sur des dates, dans la
 * section suivante de l'écran.
 */
async function retirerServices(
  restaurantId: string,
  cible: { id: string } | { jourSemaine: number },
) {
  const supprimeTout = await avecHorairesVerrouilles(restaurantId, async (tx) => {
    // Filtré sur le restaurant de la session : un identifiant de plage seul
    // ne dit pas à qui elle appartient.
    const restantes = await tx.plageOuverture.count({
      where: { restaurantId, NOT: cible },
    });
    if (restantes === 0) return true;

    await tx.plageOuverture.deleteMany({ where: { restaurantId, ...cible } });
    return false;
  });

  if (supprimeTout) refuser(ERREURS_DISPONIBILITES.dernierService);
  revaliderEcransConcernes(restaurantId);
}

/** Retire un service. Un jour sans service est fermé ce jour-là. */
export async function retirerPlage(plageId: string, _formData: FormData) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session) return;

  await retirerServices(session.user.restaurantId, { id: plageId });
}

/** Ferme un jour de semaine — ses services disparaissent, plus rien n'y est réservable. */
export async function fermerJour(jourSemaine: number, _formData: FormData) {
  const session = await authRestaurant.api.getSession({ headers: await headers() });
  if (!session || jourSemaine < 0 || jourSemaine > 6) return;

  await retirerServices(session.user.restaurantId, { jourSemaine });
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

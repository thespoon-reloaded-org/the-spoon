"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  construireDateCreneau,
  estDansLaFenetreReservable,
  jourSemaineIso,
  TAILLES_TABLE,
} from "@/lib/creneaux";
import { prisma } from "@/lib/prisma";

const schemaReservation = z.object({
  jourIso: z.string(),
  creneau: z.string(),
  couverts: z.coerce.number().int(),
});

export type EtatReservation = { erreur?: string; ok?: boolean };

/**
 * Crée une réservation. Ne fait jamais confiance à ce que le client affichait
 * (session, créneau) : tout est revérifié ici avant l'écriture en base.
 */
export async function creerReservation(
  restaurantId: string,
  _etatPrecedent: EtatReservation,
  formData: FormData,
): Promise<EtatReservation> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const donnees = schemaReservation.safeParse({
    jourIso: formData.get("jourIso"),
    creneau: formData.get("creneau"),
    couverts: formData.get("couverts"),
  });

  if (!donnees.success || !TAILLES_TABLE.some((t) => t.valeur === donnees.data.couverts)) {
    return { erreur: "Sélection invalide — choisis un nombre de convives, un jour et un créneau." };
  }

  const date = construireDateCreneau(donnees.data.jourIso, donnees.data.creneau);
  if (!date || !estDansLaFenetreReservable(date)) {
    return { erreur: "Ce créneau n'est plus disponible, choisis-en un autre." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true },
  });
  if (!restaurant) {
    return { erreur: "Restaurant introuvable." };
  }

  // État effectif du créneau : le planning récurrent (voir "Mes
  // disponibilités") donne l'état par défaut pour ce jour de semaine, une
  // exception ponctuelle pour cette date précise le recouvre s'il y en a
  // une (dans un sens ou l'autre — elle peut aussi bien ouvrir un créneau
  // que le récurrent ferme que fermer un créneau qu'il laisse ouvert).
  const exception = await prisma.exceptionHoraire.findUnique({
    where: {
      restaurantId_jour_creneau: {
        restaurantId,
        jour: donnees.data.jourIso,
        creneau: donnees.data.creneau,
      },
    },
  });

  let ferme: boolean;
  if (exception) {
    ferme = !exception.ouvert;
  } else {
    const fermeHebdo = await prisma.horaireFermeture.findFirst({
      where: {
        restaurantId,
        jourSemaine: jourSemaineIso(date),
        OR: [{ creneau: null }, { creneau: donnees.data.creneau }],
      },
    });
    ferme = !!fermeHebdo;
  }
  if (ferme) {
    return { erreur: "Ce restaurant est fermé sur ce créneau, choisis-en un autre." };
  }

  try {
    await prisma.booking.create({
      data: { restaurantId, userId: session.user.id, date, couverts: donnees.data.couverts },
    });
  } catch {
    return { erreur: "Impossible d'enregistrer la réservation, réessaie." };
  }

  revalidatePath("/espace-restaurant/reservations");
  return { ok: true };
}

const schemaAvis = z.object({
  noteCuilleres: z.coerce.number().int().min(1).max(5),
  commentaire: z
    .string()
    .trim()
    .max(500, "Commentaire trop long (500 caractères max).")
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type EtatAvis = { erreur?: string; ok?: boolean };

/**
 * Dépose ou met à jour l'avis du dîneur connecté sur ce restaurant. Réservé
 * aux dîneurs ayant une réservation confirmée déjà passée ("après passage") —
 * jamais de confiance dans un restaurantId seul sans revérifier la
 * réservation. Un avis par (dîneur, restaurant) : un deuxième dépôt met à
 * jour le premier (upsert). Recalcule `Restaurant.noteCuilleres`/`nombreAvis`
 * dans la même transaction. Pas de modération, voir le ticket Notion
 * "Modération des avis".
 */
export async function deposerAvis(
  restaurantId: string,
  _etatPrecedent: EtatAvis,
  formData: FormData,
): Promise<EtatAvis> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const donnees = schemaAvis.safeParse({
    noteCuilleres: formData.get("noteCuilleres"),
    commentaire: formData.get("commentaire"),
  });
  if (!donnees.success) {
    return { erreur: "Choisis une note entre 1 et 5 cuillères." };
  }

  const dejaServi = await prisma.booking.findFirst({
    where: {
      restaurantId,
      userId: session.user.id,
      statut: "CONFIRMEE",
      date: { lte: new Date() },
    },
    select: { id: true },
  });
  if (!dejaServi) {
    return { erreur: "Tu dois avoir été servi dans ce restaurant pour déposer un avis." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.avis.upsert({
        where: { restaurantId_userId: { restaurantId, userId: session.user.id } },
        create: {
          restaurantId,
          userId: session.user.id,
          noteCuilleres: donnees.data.noteCuilleres,
          commentaire: donnees.data.commentaire,
        },
        update: {
          noteCuilleres: donnees.data.noteCuilleres,
          commentaire: donnees.data.commentaire,
        },
      });

      const agregat = await tx.avis.aggregate({
        where: { restaurantId },
        _avg: { noteCuilleres: true },
        _count: true,
      });

      await tx.restaurant.update({
        where: { id: restaurantId },
        data: {
          noteCuilleres: agregat._avg.noteCuilleres,
          nombreAvis: agregat._count,
        },
      });
    });
  } catch {
    return { erreur: "Impossible d'enregistrer l'avis, réessaie." };
  }

  revalidatePath(`/restaurants/${restaurantId}`);
  return { ok: true };
}

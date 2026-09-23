"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { construireDateCreneau, estDansLaFenetreReservable, TAILLES_TABLE } from "@/lib/creneaux";
import { creneauEstOuvert } from "@/lib/disponibilites";
import { prisma } from "@/lib/prisma";
import { CreneauCompletError, reserverCreneau } from "@/lib/reservation";
import { lienConnexion } from "@/lib/retour";

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
  // Session expirée entre l'affichage de la fiche et l'envoi du formulaire :
  // on renvoie à la connexion, puis sur la fiche plutôt que sur l'accueil.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(lienConnexion(`/restaurants/${restaurantId}`));

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

  // Même lecture que celle qui a construit la carte de réservation (horaires
  // habituels recouverts par les exceptions datées) : le dîneur ne peut pas
  // se voir refuser un créneau qu'on venait de lui proposer, ni en obtenir
  // un qu'on ne lui proposait pas.
  const ouvert = await creneauEstOuvert(restaurantId, donnees.data.jourIso, donnees.data.creneau);
  if (!ouvert) {
    return { erreur: "Ce restaurant est fermé sur ce créneau, choisis-en un autre." };
  }

  try {
    await reserverCreneau({
      restaurantId,
      userId: session.user.id,
      date,
      couverts: donnees.data.couverts,
    });
  } catch (erreur) {
    if (erreur instanceof CreneauCompletError) {
      return { erreur: "Ce créneau est complet, choisis-en un autre." };
    }
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

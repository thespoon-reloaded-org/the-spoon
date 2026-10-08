"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { EvenementFormation } from "@/generated/prisma";
import { ErreurApi } from "@/lib/api-admin/erreurs";
import {
  EVENEMENTS,
  declencherAvis,
  declencherContestations,
  declencherDemandes,
  declencherReservations,
  type NoteAvis,
  type ResultatEvenement,
} from "@/lib/evenements-formation";
import { exigerSessionFormateur } from "@/lib/garde-formateur";
import { prisma } from "@/lib/prisma";

const CLES = Object.keys(EVENEMENTS) as [EvenementFormation, ...EvenementFormation[]];

const schemaDeclenchement = z
  .object({
    evenement: z.enum(CLES, { message: "Événement inconnu." }),
    quantite: z.coerce
      .number({ message: "Indique une quantité." })
      .int("La quantité est un nombre entier.")
      .min(1, "Au moins un élément."),
    // Absent ou vide : tous les restaurants sont candidats.
    restaurantId: z
      .string()
      .nullish()
      .transform((v) => v || null),
    note: z
      .enum(["realiste", "1", "2", "3", "4", "5"])
      .nullish()
      .transform((v): NoteAvis => (v && v !== "realiste" ? (Number(v) as NoteAvis) : "realiste")),
  })
  .refine((d) => d.quantite <= EVENEMENTS[d.evenement].quantiteMax, {
    message: "Trop d'éléments d'un coup : déclenchez en plusieurs fois.",
    path: ["quantite"],
  });

export type EtatEvenement = { erreur?: string; message?: string };

function declencher(
  evenement: EvenementFormation,
  quantite: number,
  restaurantId: string | null,
  note: NoteAvis,
): Promise<ResultatEvenement> {
  switch (evenement) {
    case "DEMANDES_REFERENCEMENT":
      return declencherDemandes(quantite);
    case "RESERVATIONS":
      return declencherReservations({ quantite, restaurantId });
    case "AVIS":
      return declencherAvis({ quantite, restaurantId, note });
    case "CONTESTATIONS":
      return declencherContestations({ quantite, restaurantId });
  }
}

/**
 * Fait arriver un lot d'événements, puis l'inscrit au journal de la console
 * avec ce qui a été demandé et ce qui a été créé. Un lot que le produit
 * refuse en bloc (un créneau rempli entre la planification et l'écriture)
 * n'écrit rien, ni dans la base ni au journal.
 */
export async function declencherEvenement(
  _etatPrecedent: EtatEvenement,
  formData: FormData,
): Promise<EtatEvenement> {
  const session = await exigerSessionFormateur();

  const donnees = schemaDeclenchement.safeParse({
    evenement: formData.get("evenement"),
    quantite: formData.get("quantite"),
    restaurantId: formData.get("restaurantId"),
    note: formData.get("note"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Demande invalide." };
  }

  const { evenement, quantite, note } = donnees.data;
  const restaurantId = EVENEMENTS[evenement].parRestaurant ? donnees.data.restaurantId : null;
  if (
    restaurantId &&
    !(await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } }))
  ) {
    return { erreur: "Restaurant introuvable." };
  }

  let resultat: ResultatEvenement;
  try {
    resultat = await declencher(evenement, quantite, restaurantId, note);
  } catch (erreur) {
    if (erreur instanceof ErreurApi) {
      return { erreur: `${erreur.message} Rien n'a été créé — relancez pour retenter.` };
    }
    console.error("Échec d'un événement de formation :", erreur);
    return { erreur: "L'événement n'a pas pu être déclenché, réessayez." };
  }

  await prisma.journalFormateur.create({
    data: {
      formateurId: session.user.id,
      evenement,
      quantiteDemandee: quantite,
      quantiteCreee: resultat.creees,
      resume: resultat.resume,
    },
  });
  revalidatePath("/formateur/evenements");
  return { message: resultat.resume };
}

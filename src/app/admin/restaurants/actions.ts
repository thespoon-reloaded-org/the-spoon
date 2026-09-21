"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { authAdmin } from "@/lib/auth";
import { genererMotDePasseTemporaire, nouveauCompteCredential } from "@/lib/comptes";
import { LIBELLE_ROLE_CONTACT } from "@/lib/contacts";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

const champTexteOptionnel = z
  .string()
  .trim()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null));

const schemaRestaurant = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  ville: z.string().trim().min(1, "La ville est obligatoire."),
  cuisine: z.string().trim().min(1, "Le type de cuisine est obligatoire."),
  adresse: z.string().trim().min(1, "L'adresse est obligatoire."),
  description: champTexteOptionnel,
  capacite: z.coerce.number().int().min(1).nullable().optional(),
});

export type EtatFormulaireRestaurant = { erreur?: string; ok?: boolean };

/**
 * Champs couverts par le formulaire, dans l'ordre où on veut les lire dans le
 * journal d'audit. Les horaires d'ouverture n'en font plus partie : ils sont
 * déclarés par le partenaire sur "Mes disponibilités" (`PlageOuverture`), la
 * Console staff les affiche sans les modifier.
 */
const CHAMPS_SUIVIS = ["nom", "ville", "cuisine", "adresse", "description", "capacite"] as const;

function lireDonneesFormulaire(formData: FormData) {
  const capaciteBrute = formData.get("capacite");
  return schemaRestaurant.safeParse({
    nom: formData.get("nom"),
    ville: formData.get("ville"),
    cuisine: formData.get("cuisine"),
    adresse: formData.get("adresse"),
    description: formData.get("description"),
    capacite: capaciteBrute && capaciteBrute !== "" ? capaciteBrute : null,
  });
}

/**
 * Crée un restaurant depuis la Console staff. Pas encore un ticket Notion
 * séparé — ajouté dans le prolongement de "Console staff : vue restaurants"
 * à la demande d'Elsa. Revérifie la session admin ici : jamais confiance
 * dans ce que le client affichait.
 */
export async function creerRestaurant(
  _etatPrecedent: EtatFormulaireRestaurant,
  formData: FormData,
): Promise<EtatFormulaireRestaurant> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = lireDonneesFormulaire(formData);
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const restaurant = await prisma.restaurant.create({ data: donnees.data });

  await prisma.journalAuditRestaurant.create({
    data: {
      restaurantId: restaurant.id,
      staffId: session.user.id,
      action: "CREATION",
    },
  });

  revalidatePath("/admin");
  redirect(`/admin/restaurants/${restaurant.id}`);
}

/**
 * Modifie un restaurant existant depuis la Console staff. Même logique que
 * `creerRestaurant` : session revérifiée, données revalidées côté serveur.
 * Trace uniquement les champs qui ont effectivement changé (voir "Console
 * staff : vue restaurants" sur Notion — "toute modification est tracée").
 */
export async function modifierRestaurant(
  restaurantId: string,
  _etatPrecedent: EtatFormulaireRestaurant,
  formData: FormData,
): Promise<EtatFormulaireRestaurant> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = lireDonneesFormulaire(formData);
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const avant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!avant) {
    return { erreur: "Restaurant introuvable." };
  }

  const champsModifies = CHAMPS_SUIVIS.filter(
    (champ) => donnees.data[champ] !== avant[champ],
  ).map((champ) => ({ champ, avant: avant[champ], apres: donnees.data[champ] }));

  await prisma.restaurant.update({ where: { id: restaurantId }, data: donnees.data });

  if (champsModifies.length > 0) {
    await prisma.journalAuditRestaurant.create({
      data: {
        restaurantId,
        staffId: session.user.id,
        action: "MODIFICATION",
        champsModifies,
      },
    });
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  redirect(`/admin/restaurants/${restaurantId}`);
}

const schemaContact = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom est obligatoire.")
    .max(80, "Nom trop long (80 caractères max)."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(160, "Email trop long (160 caractères max).")
    .email("Email invalide."),
  role: z.enum(["GERANT", "CHEF_DE_SALLE"], {
    message: "Choisis un rôle : gérant ou chef de salle.",
  }),
});

export type EtatFormulaireContact = { erreur?: string; ok?: boolean; motDePasseGenere?: string };

/**
 * Ajoute un contact à un restaurant depuis la Console staff, avec un accès
 * de connexion immédiat — `authRestaurant` coupe l'inscription libre
 * (`disableSignUp`), donc une ligne `RestaurantContact` seule ne suffirait
 * pas à donner un accès. Même mécanique que `pnpm creer-compte`
 * (`src/lib/comptes.ts`), déplacée dans l'UI : un mot de passe temporaire est
 * généré ici et retourné une seule fois dans l'état du formulaire — jamais
 * stocké en clair, jamais renvoyé après ce premier rendu — à charge pour le
 * staff de le transmettre à la main (pas de canal d'email dans ce projet).
 * Pas de redirection, contrairement à `creerRestaurant` : il faut rester sur
 * la page pour afficher ce mot de passe. Comme `creerRestaurant`/
 * `modifierRestaurant`, l'ajout est tracé dans `JournalAuditRestaurant`
 * (action `AJOUT_CONTACT`) — la fiche détail affirme que "toute création ou
 * modification est tracée", et accorder un accès de connexion est l'action
 * la plus sensible de cette page.
 */
export async function creerContactRestaurant(
  restaurantId: string,
  _etatPrecedent: EtatFormulaireContact,
  formData: FormData,
): Promise<EtatFormulaireContact> {
  const session = await authAdmin.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion-admin");

  const donnees = schemaContact.safeParse({
    nom: formData.get("nom"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!donnees.success) {
    return { erreur: donnees.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  // Revérifié ici et pas seulement au chargement de la page : le restaurant a
  // pu disparaître entre les deux (même précaution que `modifierRestaurant`).
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) {
    return { erreur: "Restaurant introuvable." };
  }

  // Vérification préalable en plus de la contrainte unique ci-dessous :
  // évite de générer et hacher un mot de passe pour rien sur le cas courant
  // (email déjà pris par un contact d'un autre établissement).
  const dejaPris = await prisma.restaurantContact.findUnique({
    where: { email: donnees.data.email },
  });
  if (dejaPris) {
    return { erreur: "Cet email est déjà utilisé par un autre contact." };
  }

  const motDePasse = genererMotDePasseTemporaire();
  const motDePasseHash = await hashPassword(motDePasse);

  try {
    await prisma.$transaction(async (tx) => {
      const contact = await tx.restaurantContact.create({
        data: {
          restaurantId,
          nom: donnees.data.nom,
          email: donnees.data.email,
          role: donnees.data.role,
          // Pas de flux de vérification d'email dans ce projet — même
          // convention que `pnpm creer-compte` et `seed:dev`.
          emailVerified: true,
        },
      });
      await tx.restaurantContactAccount.create({
        data: nouveauCompteCredential(contact.id, motDePasseHash),
      });
      await tx.journalAuditRestaurant.create({
        data: {
          restaurantId,
          staffId: session.user.id,
          action: "AJOUT_CONTACT",
          champsModifies: [
            {
              champ: "contact",
              avant: null,
              apres: `${donnees.data.nom} (${LIBELLE_ROLE_CONTACT[donnees.data.role]}) — ${donnees.data.email}`,
            },
          ],
        },
      });
    });
  } catch (erreur) {
    // Filet de sécurité si deux créations concurrentes visent le même email
    // entre la vérification ci-dessus et cet insert (contrainte unique sur
    // RestaurantContact.email — voir README, "Migrations de base de données").
    if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
      return { erreur: "Cet email est déjà utilisé par un autre contact." };
    }
    throw erreur;
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/restaurants/${restaurantId}`);
  return { ok: true, motDePasseGenere: motDePasse };
}

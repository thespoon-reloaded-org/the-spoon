import { z } from "zod";

/**
 * Ce que le formulaire « Devenir partenaire » accepte, validé à l'entrée.
 * Extrait de l'action serveur `envoyerDemandeContactRestaurateur` : un fichier
 * `"use server"` ne peut exporter que des fonctions async, et on veut tester
 * ces règles sans base ni requête. Seule la forme est vérifiée ici — ni le
 * SIREN ni la fiche Google My Business ne sont contrôlés à l'extérieur.
 */

/**
 * Neuf chiffres, espaces tolérés puis retirés : le restaurateur recopie
 * souvent `123 456 789`. Pas de clé de Luhn, neuf chiffres suffisent. Absent
 * ou vide retombe sur `""`, donc sur le même message que « 8 chiffres ».
 */
const siren = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s/g, "") : ""),
  z.string().regex(/^\d{9}$/, "Le SIREN doit comporter 9 chiffres."),
);

/**
 * Facultatif : vide ou absent vaut `null`, pour que la colonne reste nullable
 * sans qu'un `""` traîne en base. Sinon une URL `http`/`https` de 500
 * caractères maximum — le reste (Google ou pas) ne se vérifie pas.
 */
const urlGoogleMyBusiness = z.preprocess(
  (v) => {
    const texte = typeof v === "string" ? v.trim() : "";
    return texte === "" ? null : texte;
  },
  z.union([
    z.null(),
    z
      .url({ protocol: /^https?$/, error: "Lien Google My Business invalide." })
      .max(500, "Lien Google My Business invalide."),
  ]),
);

/**
 * Le critère d'éligibilité de TheSpoon, obligatoire. Le formulaire envoie
 * `"oui"` ou `"non"` (boutons radio), converti en booléen pour la base ;
 * absent ou hors de ces deux valeurs, on demande de répondre.
 */
const menusALaCuillere = z
  .preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z.enum(["oui", "non"], {
      error: "Indiquez si vous proposez des menus à la cuillère.",
    }),
  )
  .transform((v) => v === "oui");

export const schemaDemandeContact = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom est obligatoire.")
    .max(100, "Nom trop long (100 caractères max)."),
  email: z
    .string()
    .trim()
    .min(1, "L'email est obligatoire.")
    .max(200, "Email trop long (200 caractères max).")
    .email("Email invalide."),
  etablissement: z
    .string()
    .trim()
    .min(1, "Le nom de l'établissement est obligatoire.")
    .max(150, "Nom d'établissement trop long (150 caractères max)."),
  adresse: z
    .string()
    .trim()
    .min(1, "L'adresse de l'établissement est obligatoire.")
    .max(250, "Adresse trop longue (250 caractères max)."),
  siren,
  urlGoogleMyBusiness,
  menusALaCuillere,
  message: z
    .string()
    .trim()
    .min(1, "Décrivez brièvement votre demande.")
    .max(2000, "Message trop long (2000 caractères max)."),
});

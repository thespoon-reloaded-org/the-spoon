/**
 * Ce que l'API d'administration accepte, validé à l'entrée. Les règles sont
 * celles des écrans (mêmes bornes, mêmes énumérations) : l'API crée plus
 * vite, pas des données que le produit n'aurait pas su produire.
 */
import { z } from "zod";

import { VALEURS_ALLERGENES } from "@/lib/allergenes";
import { CRENEAUX_HORAIRES, TAILLES_TABLE } from "@/lib/creneaux";
import { jourIsoValide, moisIsoValide } from "@/lib/fuseau";
import { MINUIT, minutesDepuisCreneau } from "@/lib/horaires";

const texte = z.string().trim().min(1, "Obligatoire.");
const texteOptionnel = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null));
const email = z.string().trim().toLowerCase().max(160).email("Email invalide.");
/** Absent : un mot de passe temporaire est généré et rendu une seule fois dans la réponse. */
const motDePasse = z.string().min(8, "8 caractères minimum.").max(128).optional();
const instant = z.iso
  .datetime({
    offset: true,
    message: "Instant ISO 8601 attendu, avec fuseau (ex. 2026-06-12T21:30:00+02:00).",
  })
  .transform((v) => new Date(v));

/**
 * Date de création d'une donnée d'historique reconstitué. Absente :
 * maintenant. Elle compte : une réservation ne peut pas précéder le
 * restaurant ni le compte qui l'a passée.
 */
const creeLe = instant.optional();

/**
 * Un objet seul ou une liste : le même point d'entrée sert à créer une donnée
 * à la main et à charger un jeu entier. Toujours rendu sous forme de liste.
 */
export function unOuPlusieurs<S extends z.ZodType>(schema: S, max: number) {
  return z.preprocess(
    (v) => (Array.isArray(v) ? v : [v]),
    z.array(schema).min(1, "Au moins un élément.").max(max, `${max} éléments maximum par appel.`),
  );
}

/** "HH:mm", ou "24:00" pour une fermeture à minuit — en minutes depuis minuit. */
const heure = z
  .string()
  .refine(
    (v) => v === "24:00" || minutesDepuisCreneau(v) !== null,
    "Heure attendue au format HH:mm.",
  )
  .transform((v) => (v === "24:00" ? MINUIT : minutesDepuisCreneau(v)!));

const schemaPlage = z
  .object({
    /** 0 = lundi … 6 = dimanche, comme `jourSemaineIso`. */
    jourSemaine: z.number().int().min(0).max(6),
    debut: heure,
    fin: heure,
  })
  .refine((p) => p.debut < p.fin, {
    message: "Le service doit finir après avoir commencé.",
    path: ["fin"],
  })
  .transform((p) => ({ jourSemaine: p.jourSemaine, debutMinutes: p.debut, finMinutes: p.fin }));

const schemaPlat = z.object({
  nom: texte,
  description: texteOptionnel,
  categorie: z.enum(["ENTREE", "PLAT", "DESSERT"]).default("PLAT"),
  prixCentimes: z.number().int().min(0),
  /**
   * Absent : allergènes non renseignés. `[]` : le restaurant déclare
   * qu'aucun des 14 n'y figure. En JSON les deux se distinguent sans case
   * à cocher — la distinction, elle, est la même que sur « Ma carte ».
   */
  allergenes: z.array(z.enum(VALEURS_ALLERGENES, { message: "Allergène inconnu." })).optional(),
});

export const schemaContact = z.object({
  nom: texte.max(80),
  email,
  role: z.enum(["GERANT", "CHEF_DE_SALLE"]),
  motDePasse,
});

export const schemaRestaurant = z.object({
  nom: texte,
  ville: texte,
  cuisine: texte,
  adresse: texte,
  description: texteOptionnel,
  capacite: z.number().int().min(1).nullish(),
  delaiAnnulationHeures: z.number().int().min(0).max(168).nullish(),
  plats: z.array(schemaPlat).max(50).default([]),
  horaires: z.array(schemaPlage).max(28).default([]),
  contacts: z.array(schemaContact).max(10).default([]),
  /** Date d'arrivée sur TheSpoon ; ses contacts et sa trace d'audit la reprennent. */
  creeLe,
});

export const schemaDineur = z.object({
  nom: texte.max(80),
  email,
  motDePasse,
  creeLe,
});

export const STATUTS_RESERVATION = ["CONFIRMEE", "ANNULEE", "HONOREE", "NO_SHOW"] as const;

export const schemaReservation = z
  .object({
    restaurantId: texte,
    /** L'id du dîneur, ou son email — plus simple à écrire dans un jeu de données. */
    dineurId: texte.optional(),
    dineurEmail: email.optional(),
    /** Jour et créneau à l'heure de Paris, comme sur la fiche restaurant. */
    jour: z.string().refine(jourIsoValide, "Jour attendu au format AAAA-MM-JJ."),
    creneau: z.enum(CRENEAUX_HORAIRES, {
      message: `Créneau attendu parmi ${CRENEAUX_HORAIRES.join(", ")}.`,
    }),
    /** Les tailles de table de la fiche restaurant, pas au-delà. */
    couverts: z
      .number()
      .int()
      .refine((n) => TAILLES_TABLE.some((t) => t.valeur === n), {
        message: `Couverts attendus parmi ${TAILLES_TABLE.map((t) => t.valeur).join(", ")}.`,
      }),
    statut: z.enum(STATUTS_RESERVATION).default("CONFIRMEE"),
    couvertsServis: z.number().int().min(1).optional(),
    signaleeLe: instant.optional(),
    creeLe,
  })
  .refine((r) => (r.dineurId === undefined) !== (r.dineurEmail === undefined), {
    message: "Donner dineurId ou dineurEmail, pas les deux.",
    path: ["dineurId"],
  })
  .refine((r) => (r.statut === "HONOREE") === (r.couvertsServis !== undefined), {
    message: "couvertsServis est requis pour HONOREE, et seulement pour HONOREE.",
    path: ["couvertsServis"],
  })
  .refine((r) => r.signaleeLe === undefined || r.statut === "HONOREE" || r.statut === "NO_SHOW", {
    message: "signaleeLe ne s'applique qu'à une réservation signalée (HONOREE ou NO_SHOW).",
    path: ["signaleeLe"],
  });

export type SaisieReservation = z.output<typeof schemaReservation>;

export const schemaMois = z.string().refine(moisIsoValide, "Mois attendu au format AAAA-MM.");

export const schemaGenerationFactures = z.object({ mois: schemaMois });

/**
 * Un geste d'instruction, rejoué dans l'ordre par la fonction de la Console
 * qui le fait (`prendreEnChargeDossier`, `demanderComplementDossier`,
 * `deciderDossier`) : mêmes règles, seulement daté. `par` est l'email d'un
 * membre du staff ; `le` absent, un jour après l'étape précédente.
 */
const schemaEtapeInstruction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PRISE_EN_CHARGE"), par: email, le: instant.optional() }),
  z.object({
    type: z.literal("COMPLEMENT"),
    par: email,
    le: instant.optional(),
    message: texte.max(2000),
  }),
  z.object({
    type: z.literal("DECISION"),
    par: email,
    le: instant.optional(),
    issue: z.enum(["ACCORDE", "PARTIEL", "REFUSE", "ESCALADE"]),
    /** Seulement pour un accord partiel. */
    montantAccordeCentimes: z.number().int().min(1).optional(),
    /** Seulement pour un accord, total ou partiel : qui porte le coût. */
    imputation: z.enum(["THESPOON", "CLIENT"]).optional(),
    motif: texte.max(2000),
  }),
]);

/**
 * Le montant n'a de sens que pour un accord partiel, l'imputation que pour
 * un accord : `normaliserDecision` ignorerait le reste sans le dire, et un
 * jeu de données qui croit accorder 50 € en accorderait 300.
 */
const schemaEtapeInstructionCoherente = schemaEtapeInstruction.superRefine((etape, ctx) => {
  if (etape.type !== "DECISION") return;
  if ((etape.issue === "PARTIEL") !== (etape.montantAccordeCentimes !== undefined)) {
    ctx.addIssue({
      code: "custom",
      path: ["montantAccordeCentimes"],
      message: "montantAccordeCentimes est requis pour PARTIEL, et seulement pour PARTIEL.",
    });
  }
  const accord = etape.issue === "ACCORDE" || etape.issue === "PARTIEL";
  if (accord !== (etape.imputation !== undefined)) {
    ctx.addIssue({
      code: "custom",
      path: ["imputation"],
      message:
        "imputation (THESPOON ou CLIENT) est requise pour un accord, et seulement pour un accord.",
    });
  }
});

export type EtapeInstruction = z.output<typeof schemaEtapeInstruction>;

export const schemaDossier = z.object({
  factureId: texte,
  /** Le contact restaurant qui dépose — il doit appartenir au restaurant facturé. */
  contactId: texte,
  commentaire: texteOptionnel,
  lignes: z
    .array(
      z.object({
        ligneFactureId: texte,
        motif: z.enum([
          "NO_SHOW",
          "ANNULATION_TARDIVE",
          "COUVERTS_SURCOMPTES",
          "DOUBLON",
          "HORS_PLATEFORME",
          "AUTRE",
        ]),
      }),
    )
    .min(1, "Au moins une ligne contestée."),
  /** Absent : quelques jours après l'émission de la facture, sans dépasser maintenant. */
  deposeLe: instant.optional(),
  /** L'instruction du dossier, dans l'ordre. Vide : le dossier reste en file. */
  etapes: z.array(schemaEtapeInstructionCoherente).max(10).default([]),
});

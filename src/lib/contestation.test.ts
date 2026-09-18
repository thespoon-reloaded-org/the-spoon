import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  calculerMontantConteste,
  creerDossierContestation,
  deciderDossier,
  decisionStatutDossier,
  delaiContestationExpire,
  demanderComplementDossier,
  formaterAnciennete,
  formaterDelaiSignalement,
  normaliserDecision,
  prendreEnChargeDossier,
} from "./contestation";
import { prisma } from "./prisma";

describe("calculerMontantConteste", () => {
  test("somme les montants des lignes", () => {
    expect(calculerMontantConteste([{ montantCentimes: 250 }, { montantCentimes: 500 }])).toBe(750);
  });

  test("0 pour une liste vide", () => {
    expect(calculerMontantConteste([])).toBe(0);
  });
});

describe("decisionStatutDossier", () => {
  test("crédité d'office strictement sous le seuil", () => {
    expect(decisionStatutDossier(1999, 2000)).toBe("CREDITE_OFFICE");
  });

  test("en attente d'instruction au seuil", () => {
    expect(decisionStatutDossier(2000, 2000)).toBe("EN_ATTENTE_INSTRUCTION");
  });

  test("en attente d'instruction au-dessus du seuil", () => {
    expect(decisionStatutDossier(5000, 2000)).toBe("EN_ATTENTE_INSTRUCTION");
  });
});

describe("delaiContestationExpire", () => {
  test("non expiré juste après génération", () => {
    const maintenant = new Date("2026-06-01T00:00:00Z");
    expect(delaiContestationExpire(new Date("2026-06-01T00:00:00Z"), maintenant)).toBe(false);
  });

  test("expiré au-delà de 30 jours", () => {
    const maintenant = new Date("2026-07-15T00:00:00Z");
    expect(delaiContestationExpire(new Date("2026-06-01T00:00:00Z"), maintenant)).toBe(true);
  });
});

describe("formaterAnciennete", () => {
  test("aujourd'hui pour un dépôt du jour même", () => {
    const maintenant = new Date("2026-06-15T18:00:00Z");
    expect(formaterAnciennete(new Date("2026-06-15T09:00:00Z"), maintenant)).toBe("aujourd'hui");
  });

  test("singulier à 1 jour", () => {
    const maintenant = new Date("2026-06-16T09:00:00Z");
    expect(formaterAnciennete(new Date("2026-06-15T09:00:00Z"), maintenant)).toBe("il y a 1 jour");
  });

  test("pluriel au-delà de 1 jour", () => {
    const maintenant = new Date("2026-06-20T09:00:00Z");
    expect(formaterAnciennete(new Date("2026-06-15T09:00:00Z"), maintenant)).toBe("il y a 5 jours");
  });
});

describe("formaterDelaiSignalement", () => {
  test("signalé le jour même", () => {
    const dateService = new Date("2026-06-15T20:00:00Z");
    const signaleeLe = new Date("2026-06-15T22:30:00Z");
    expect(formaterDelaiSignalement(dateService, signaleeLe)).toBe("signalé le jour même");
  });

  test("signalé après le service, singulier à 1 jour", () => {
    const dateService = new Date("2026-06-15T20:00:00Z");
    const signaleeLe = new Date("2026-06-16T20:00:00Z");
    expect(formaterDelaiSignalement(dateService, signaleeLe)).toBe("signalé 1 jour après le service");
  });

  test("signalé après le service, pluriel", () => {
    const dateService = new Date("2026-06-15T20:00:00Z");
    const signaleeLe = new Date("2026-06-20T20:00:00Z");
    expect(formaterDelaiSignalement(dateService, signaleeLe)).toBe("signalé 5 jours après le service");
  });
});

/**
 * Preuve de bout en bout du dépôt d'un dossier de contestation — nécessite
 * une vraie base Postgres (`DATABASE_URL`), comme `facturation.test.ts`.
 */
describe("creerDossierContestation", () => {
  let restaurantId: string;
  let restaurantContactId: string;
  let factureId: string;
  let ligneFaibleId: string;
  let ligneForteId: string;
  const userId = randomUUID();

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { nom: "Test contestation", ville: "Lyon", cuisine: "Test", adresse: "1 rue du Test" },
    });
    restaurantId = restaurant.id;

    const contact = await prisma.restaurantContact.create({
      data: {
        restaurantId,
        nom: "Contact test",
        email: `${randomUUID()}@test.example`,
        role: "GERANT",
      },
    });
    restaurantContactId = contact.id;

    await prisma.user.create({
      data: { id: userId, name: "Dîneur test", email: `${userId}@test.example` },
    });

    const facture = await prisma.facture.create({
      data: {
        restaurantId,
        mois: new Date(Date.UTC(2026, 5, 1)),
        montantTotalCentimes: 1750,
        genereeLe: new Date(), // dans le délai de contestation
      },
    });
    factureId = facture.id;

    const bookingFaible = await prisma.booking.create({
      data: { restaurantId, userId, date: new Date(Date.UTC(2026, 5, 10, 19, 30)), couverts: 2, statut: "HONOREE", couvertsServis: 2 },
    });
    const bookingForte = await prisma.booking.create({
      data: { restaurantId, userId, date: new Date(Date.UTC(2026, 5, 15, 20, 0)), couverts: 5, statut: "HONOREE", couvertsServis: 5 },
    });

    const ligneFaible = await prisma.ligneFacture.create({
      data: { factureId, bookingId: bookingFaible.id, couvertsFactures: 2, montantCentimes: 500 },
    });
    ligneFaibleId = ligneFaible.id;
    const ligneForte = await prisma.ligneFacture.create({
      data: { factureId, bookingId: bookingForte.id, couvertsFactures: 5, montantCentimes: 1250 },
    });
    ligneForteId = ligneForte.id;

    await prisma.configContestation.upsert({
      where: { id: "singleton" },
      update: { seuilCreditOfficeCentimes: 1000 },
      create: { id: "singleton", seuilCreditOfficeCentimes: 1000 },
    });
  });

  afterAll(async () => {
    await prisma.pieceJointeDossier.deleteMany({ where: { dossier: { factureId } } });
    await prisma.ligneContestee.deleteMany({ where: { dossier: { factureId } } });
    await prisma.dossier.deleteMany({ where: { factureId } });
    await prisma.ligneFacture.deleteMany({ where: { factureId } });
    await prisma.facture.delete({ where: { id: factureId } });
    await prisma.restaurantContact.delete({ where: { id: restaurantContactId } });
    await prisma.booking.deleteMany({ where: { restaurantId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
  });

  test("une ligne sous le seuil est créditée d'office, avec sa décision et son avoir", async () => {
    const resultat = await creerDossierContestation({
      factureId,
      restaurantId,
      restaurantContactId,
      lignes: [{ ligneFactureId: ligneFaibleId, motif: "NO_SHOW" }],
      commentaire: null,
    });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const dossier = await prisma.dossier.findUniqueOrThrow({
      where: { id: resultat.dossierId },
      include: { decisions: { include: { avoir: true } } },
    });
    expect(dossier.statut).toBe("CREDITE_OFFICE");
    expect(dossier.montantContesteCentimes).toBe(500);
    expect(dossier.seuilAppliqueCentimes).toBe(1000);

    // Créditer d'office sans émettre d'avoir ne créditerait rien du tout.
    expect(dossier.decisions).toHaveLength(1);
    const decision = dossier.decisions[0];
    expect(decision?.issue).toBe("ACCORDE");
    expect(decision?.montantAccordeCentimes).toBe(500);
    expect(decision?.imputation).toBe("THESPOON");
    expect(decision?.decideParId).toBeNull(); // la règle de seuil, pas une personne
    expect(decision?.avoir?.montantCentimes).toBe(500);
    expect(decision?.avoir?.factureId).toBe(factureId);
  });

  test("deux lignes dont le total dépasse le seuil restent en attente d'instruction", async () => {
    // Ré-utilise ligneForteId + une nouvelle ligne pour ne pas retomber sur
    // une ligne déjà contestée par le test précédent.
    const bookingSupplementaire = await prisma.booking.create({
      data: { restaurantId, userId, date: new Date(Date.UTC(2026, 5, 20, 20, 0)), couverts: 1, statut: "HONOREE", couvertsServis: 1 },
    });
    const ligneSupplementaire = await prisma.ligneFacture.create({
      data: { factureId, bookingId: bookingSupplementaire.id, couvertsFactures: 1, montantCentimes: 250 },
    });

    const resultat = await creerDossierContestation({
      factureId,
      restaurantId,
      restaurantContactId,
      lignes: [
        { ligneFactureId: ligneForteId, motif: "COUVERTS_SURCOMPTES" },
        { ligneFactureId: ligneSupplementaire.id, motif: "AUTRE" },
      ],
      commentaire: "Contexte du litige",
    });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const dossier = await prisma.dossier.findUniqueOrThrow({ where: { id: resultat.dossierId } });
    expect(dossier.statut).toBe("EN_ATTENTE_INSTRUCTION");
    expect(dossier.montantContesteCentimes).toBe(1500);
  });

  test("contester une ligne déjà contestée est refusé, sans créer de dossier fantôme", async () => {
    const dossiersAvant = await prisma.dossier.count({ where: { factureId } });

    const resultat = await creerDossierContestation({
      factureId,
      restaurantId,
      restaurantContactId,
      lignes: [{ ligneFactureId: ligneFaibleId, motif: "DOUBLON" }],
      commentaire: null,
    });
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.erreur).toMatch(/déjà contestée/);

    const dossiersApres = await prisma.dossier.count({ where: { factureId } });
    expect(dossiersApres).toBe(dossiersAvant);
  });

  test("refuse le dépôt si le délai de contestation de la facture est dépassé", async () => {
    const factureExpiree = await prisma.facture.create({
      data: {
        restaurantId,
        mois: new Date(Date.UTC(2026, 0, 1)),
        montantTotalCentimes: 250,
        genereeLe: new Date("2026-01-01T00:00:00Z"), // largement > 30 jours avant "maintenant"
      },
    });
    const bookingExpire = await prisma.booking.create({
      data: { restaurantId, userId, date: new Date(Date.UTC(2026, 0, 5, 19, 0)), couverts: 1, statut: "HONOREE", couvertsServis: 1 },
    });
    const ligneExpiree = await prisma.ligneFacture.create({
      data: { factureId: factureExpiree.id, bookingId: bookingExpire.id, couvertsFactures: 1, montantCentimes: 250 },
    });

    const resultat = await creerDossierContestation({
      factureId: factureExpiree.id,
      restaurantId,
      restaurantContactId,
      lignes: [{ ligneFactureId: ligneExpiree.id, motif: "AUTRE" }],
      commentaire: null,
    });
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.erreur).toMatch(/délai/i);

    await prisma.ligneFacture.delete({ where: { id: ligneExpiree.id } });
    await prisma.booking.delete({ where: { id: bookingExpire.id } });
    await prisma.facture.delete({ where: { id: factureExpiree.id } });
  });

  test("changer le seuil après coup ne modifie pas seuilAppliqueCentimes d'un dossier déjà créé", async () => {
    const dossierExistant = await prisma.dossier.findFirstOrThrow({ where: { factureId } });
    const seuilAvant = dossierExistant.seuilAppliqueCentimes;

    await prisma.configContestation.update({
      where: { id: "singleton" },
      data: { seuilCreditOfficeCentimes: seuilAvant + 5000 },
    });

    const dossierRelu = await prisma.dossier.findUniqueOrThrow({ where: { id: dossierExistant.id } });
    expect(dossierRelu.seuilAppliqueCentimes).toBe(seuilAvant);

    // Remet le seuil pour ne pas influencer d'autres tests s'ils tournent après.
    await prisma.configContestation.update({
      where: { id: "singleton" },
      data: { seuilCreditOfficeCentimes: 1000 },
    });
  });
});

/**
 * Preuve de la prise en charge d'un dossier ("File des litiges à
 * instruire") — nécessite une vraie base Postgres, comme les describe
 * ci-dessus.
 */
describe("prendreEnChargeDossier", () => {
  let restaurantId: string;
  let restaurantContactId: string;
  let staffAId: string;
  let staffBId: string;
  const userId = randomUUID();

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { nom: "Test prise en charge", ville: "Lyon", cuisine: "Test", adresse: "1 rue du Test" },
    });
    restaurantId = restaurant.id;

    const contact = await prisma.restaurantContact.create({
      data: {
        restaurantId,
        nom: "Contact test",
        email: `${randomUUID()}@test.example`,
        role: "GERANT",
      },
    });
    restaurantContactId = contact.id;

    await prisma.user.create({
      data: { id: userId, name: "Dîneur test", email: `${userId}@test.example` },
    });

    const staffA = await prisma.staff.create({ data: { nom: "Staff A", email: `${randomUUID()}@test.example` } });
    staffAId = staffA.id;
    const staffB = await prisma.staff.create({ data: { nom: "Staff B", email: `${randomUUID()}@test.example` } });
    staffBId = staffB.id;
  });

  afterAll(async () => {
    await prisma.dossier.deleteMany({ where: { factureId: { in: await facturesDeTest() } } });
    await prisma.facture.deleteMany({ where: { restaurantId } });
    await prisma.restaurantContact.delete({ where: { id: restaurantContactId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
    await prisma.staff.deleteMany({ where: { id: { in: [staffAId, staffBId] } } });
  });

  async function facturesDeTest(): Promise<string[]> {
    const factures = await prisma.facture.findMany({ where: { restaurantId }, select: { id: true } });
    return factures.map((f) => f.id);
  }

  async function creerDossierEnAttente(montantCentimes: number) {
    const facture = await prisma.facture.create({
      data: { restaurantId, mois: new Date(), montantTotalCentimes: montantCentimes },
    });
    return prisma.dossier.create({
      data: {
        factureId: facture.id,
        restaurantContactId,
        montantContesteCentimes: montantCentimes,
        seuilAppliqueCentimes: 1000,
        statut: "EN_ATTENTE_INSTRUCTION",
      },
    });
  }

  test("assigne l'instructeur et horodate la prise en charge", async () => {
    const dossier = await creerDossierEnAttente(1500);

    const resultat = await prendreEnChargeDossier(dossier.id, staffAId);
    expect(resultat.ok).toBe(true);

    const dossierRelu = await prisma.dossier.findUniqueOrThrow({ where: { id: dossier.id } });
    expect(dossierRelu.instructeurId).toBe(staffAId);
    expect(dossierRelu.priseEnChargeLe).not.toBeNull();
    expect(dossierRelu.statut).toBe("EN_ATTENTE_INSTRUCTION"); // la prise en charge ne tranche pas le dossier
  });

  test("un dossier déjà pris en charge ne peut pas être repris", async () => {
    const dossier = await creerDossierEnAttente(1500);
    await prendreEnChargeDossier(dossier.id, staffAId);

    const resultat = await prendreEnChargeDossier(dossier.id, staffBId);
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.erreur).toMatch(/déjà été pris/);

    const dossierRelu = await prisma.dossier.findUniqueOrThrow({ where: { id: dossier.id } });
    expect(dossierRelu.instructeurId).toBe(staffAId); // le premier reste assigné
  });

  test("une seule des deux prises en charge simultanées passe", async () => {
    const dossier = await creerDossierEnAttente(1500);

    const [resultatA, resultatB] = await Promise.all([
      prendreEnChargeDossier(dossier.id, staffAId),
      prendreEnChargeDossier(dossier.id, staffBId),
    ]);
    const reussites = [resultatA, resultatB].filter((r) => r.ok);
    expect(reussites).toHaveLength(1);

    const dossierRelu = await prisma.dossier.findUniqueOrThrow({ where: { id: dossier.id } });
    expect([staffAId, staffBId]).toContain(dossierRelu.instructeurId);
  });
});

/**
 * Preuve de la demande de complément d'un dossier ("Instruction d'un
 * dossier") — nécessite une vraie base Postgres, comme les describe
 * ci-dessus.
 */
describe("demanderComplementDossier", () => {
  let restaurantId: string;
  let restaurantContactId: string;
  let staffAId: string;
  let staffBId: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { nom: "Test complément", ville: "Lyon", cuisine: "Test", adresse: "1 rue du Test" },
    });
    restaurantId = restaurant.id;

    const contact = await prisma.restaurantContact.create({
      data: {
        restaurantId,
        nom: "Contact test",
        email: `${randomUUID()}@test.example`,
        role: "GERANT",
      },
    });
    restaurantContactId = contact.id;

    const staffA = await prisma.staff.create({ data: { nom: "Staff A", email: `${randomUUID()}@test.example` } });
    staffAId = staffA.id;
    const staffB = await prisma.staff.create({ data: { nom: "Staff B", email: `${randomUUID()}@test.example` } });
    staffBId = staffB.id;
  });

  afterAll(async () => {
    await prisma.dossier.deleteMany({ where: { restaurantContactId } });
    await prisma.facture.deleteMany({ where: { restaurantId } });
    await prisma.restaurantContact.delete({ where: { id: restaurantContactId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
    await prisma.staff.deleteMany({ where: { id: { in: [staffAId, staffBId] } } });
  });

  async function creerDossierEnAttente() {
    const facture = await prisma.facture.create({
      data: { restaurantId, mois: new Date(), montantTotalCentimes: 1500 },
    });
    return prisma.dossier.create({
      data: {
        factureId: facture.id,
        restaurantContactId,
        montantContesteCentimes: 1500,
        seuilAppliqueCentimes: 1000,
        statut: "EN_ATTENTE_INSTRUCTION",
      },
    });
  }

  test("enregistre le message et l'horodatage sans clôturer le dossier", async () => {
    const dossier = await creerDossierEnAttente();
    await prendreEnChargeDossier(dossier.id, staffAId);

    const resultat = await demanderComplementDossier(dossier.id, staffAId, "Merci de préciser l'heure exacte.");
    expect(resultat.ok).toBe(true);

    const dossierRelu = await prisma.dossier.findUniqueOrThrow({ where: { id: dossier.id } });
    expect(dossierRelu.complementDemandeMessage).toBe("Merci de préciser l'heure exacte.");
    expect(dossierRelu.complementDemandeLe).not.toBeNull();
    expect(dossierRelu.statut).toBe("EN_ATTENTE_INSTRUCTION");
  });

  test("refuse un dossier non pris en charge", async () => {
    const dossier = await creerDossierEnAttente();

    const resultat = await demanderComplementDossier(dossier.id, staffAId, "Complément");
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.erreur).toMatch(/instructeur assigné/);
  });

  test("refuse un membre du staff non assigné à ce dossier", async () => {
    const dossier = await creerDossierEnAttente();
    await prendreEnChargeDossier(dossier.id, staffAId);

    const resultat = await demanderComplementDossier(dossier.id, staffBId, "Complément");
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.erreur).toMatch(/instructeur assigné/);
  });
});

describe("normaliserDecision", () => {
  const motif = "Photos du service à l'appui.";

  test("un accord crédite le montant contesté, jamais un chiffre saisi", () => {
    const resultat = normaliserDecision(5000, {
      issue: "ACCORDE",
      montantAccordeCentimes: 99,
      imputation: "THESPOON",
      motif,
    });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.decision.montantAccordeCentimes).toBe(5000);
    expect(resultat.decision.statutDossier).toBe("CLOTURE");
  });

  test("un accord doit dire qui porte le coût", () => {
    const resultat = normaliserDecision(5000, { issue: "ACCORDE", imputation: null, motif });
    expect(resultat.ok).toBe(false);
  });

  test("un accord ne peut pas être imputé au restaurant : il est crédité", () => {
    const resultat = normaliserDecision(5000, { issue: "ACCORDE", imputation: "RESTAURANT", motif });
    expect(resultat.ok).toBe(false);
  });

  test("un partiel reste strictement entre 0 et le montant contesté", () => {
    const valide = normaliserDecision(5000, {
      issue: "PARTIEL",
      montantAccordeCentimes: 2000,
      imputation: "CLIENT",
      motif,
    });
    expect(valide.ok).toBe(true);
    if (valide.ok) expect(valide.decision.montantAccordeCentimes).toBe(2000);

    expect(
      normaliserDecision(5000, { issue: "PARTIEL", montantAccordeCentimes: 0, imputation: "CLIENT", motif }).ok,
    ).toBe(false);
    expect(
      normaliserDecision(5000, { issue: "PARTIEL", montantAccordeCentimes: 5000, imputation: "CLIENT", motif }).ok,
    ).toBe(false);
  });

  test("un refus ne crédite rien et laisse le coût au restaurant", () => {
    const resultat = normaliserDecision(5000, { issue: "REFUSE", motif });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.decision.montantAccordeCentimes).toBe(0);
    expect(resultat.decision.imputation).toBe("RESTAURANT");
    expect(resultat.decision.statutDossier).toBe("CLOTURE");
  });

  test("une escalade ne tranche rien : ni montant, ni imputation", () => {
    const resultat = normaliserDecision(5000, { issue: "ESCALADE", imputation: "THESPOON", motif });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;
    expect(resultat.decision.montantAccordeCentimes).toBe(0);
    expect(resultat.decision.imputation).toBeNull();
    expect(resultat.decision.statutDossier).toBe("ESCALADE");
  });

  test("une décision sans motif est refusée, quelle que soit l'issue", () => {
    expect(normaliserDecision(5000, { issue: "REFUSE", motif: "   " }).ok).toBe(false);
  });
});

/**
 * Preuve de la décision d'un dossier et de l'émission de l'avoir ("Décision &
 * émission d'avoir") — nécessite une vraie base Postgres, comme les describe
 * ci-dessus.
 */
describe("deciderDossier", () => {
  let restaurantId: string;
  let restaurantContactId: string;
  let staffAId: string;
  let staffBId: string;
  const userId = randomUUID();
  const motif = "Service annulé par le restaurant, couverts non servis.";

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.create({
      data: { nom: "Test décision", ville: "Lyon", cuisine: "Test", adresse: "1 rue du Test" },
    });
    restaurantId = restaurant.id;

    const contact = await prisma.restaurantContact.create({
      data: {
        restaurantId,
        nom: "Contact test",
        email: `${randomUUID()}@test.example`,
        role: "GERANT",
      },
    });
    restaurantContactId = contact.id;

    await prisma.user.create({
      data: { id: userId, name: "Dîneur test", email: `${userId}@test.example` },
    });

    const staffA = await prisma.staff.create({ data: { nom: "Staff A", email: `${randomUUID()}@test.example` } });
    staffAId = staffA.id;
    const staffB = await prisma.staff.create({ data: { nom: "Staff B", email: `${randomUUID()}@test.example` } });
    staffBId = staffB.id;
  });

  afterAll(async () => {
    // Décisions et avoirs partent en cascade avec leurs dossiers et factures.
    await prisma.dossier.deleteMany({ where: { facture: { restaurantId } } });
    await prisma.facture.deleteMany({ where: { restaurantId } });
    await prisma.restaurantContact.delete({ where: { id: restaurantContactId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.restaurant.delete({ where: { id: restaurantId } });
    await prisma.staff.deleteMany({ where: { id: { in: [staffAId, staffBId] } } });
  });

  /** Dossier au-dessus du seuil, déjà pris en charge par `instructeurId`. */
  async function creerDossierPrisEnCharge(montantCentimes: number, instructeurId?: string) {
    const facture = await prisma.facture.create({
      data: { restaurantId, mois: new Date(), montantTotalCentimes: montantCentimes },
    });
    return prisma.dossier.create({
      data: {
        factureId: facture.id,
        restaurantContactId,
        montantContesteCentimes: montantCentimes,
        seuilAppliqueCentimes: 1000,
        statut: "EN_ATTENTE_INSTRUCTION",
        instructeurId,
        priseEnChargeLe: instructeurId ? new Date() : null,
      },
    });
  }

  test("un accord total clôt le dossier et émet l'avoir sur la facture", async () => {
    const dossier = await creerDossierPrisEnCharge(4000, staffAId);

    const resultat = await deciderDossier(dossier.id, staffAId, {
      issue: "ACCORDE",
      imputation: "THESPOON",
      motif,
    });
    expect(resultat).toEqual({ ok: true, avoirEmis: true });

    const relu = await prisma.dossier.findUniqueOrThrow({
      where: { id: dossier.id },
      include: { decisions: { include: { avoir: true } } },
    });
    expect(relu.statut).toBe("CLOTURE");
    expect(relu.decisions).toHaveLength(1);
    expect(relu.decisions[0]?.decideParId).toBe(staffAId);
    expect(relu.decisions[0]?.avoir?.montantCentimes).toBe(4000);
    expect(relu.decisions[0]?.avoir?.factureId).toBe(dossier.factureId);
  });

  test("rejouer la décision ne crédite pas deux fois", async () => {
    const dossier = await creerDossierPrisEnCharge(4000, staffAId);
    const saisie = { issue: "ACCORDE", imputation: "THESPOON", motif } as const;

    const premier = await deciderDossier(dossier.id, staffAId, saisie);
    const second = await deciderDossier(dossier.id, staffAId, saisie);

    expect(premier.ok).toBe(true);
    expect(second.ok).toBe(false);

    const avoirs = await prisma.avoir.findMany({ where: { factureId: dossier.factureId } });
    expect(avoirs).toHaveLength(1);
  });

  test("deux décisions simultanées : une seule passe, un seul avoir", async () => {
    const dossier = await creerDossierPrisEnCharge(4000, staffAId);
    const saisie = { issue: "ACCORDE", imputation: "THESPOON", motif } as const;

    const [premier, second] = await Promise.all([
      deciderDossier(dossier.id, staffAId, saisie),
      deciderDossier(dossier.id, staffAId, saisie),
    ]);

    expect([premier, second].filter((r) => r.ok)).toHaveLength(1);
    const avoirs = await prisma.avoir.findMany({ where: { factureId: dossier.factureId } });
    expect(avoirs).toHaveLength(1);
  });

  test("un refus clôt le dossier sans émettre d'avoir", async () => {
    const dossier = await creerDossierPrisEnCharge(4000, staffAId);

    const resultat = await deciderDossier(dossier.id, staffAId, { issue: "REFUSE", motif });
    expect(resultat).toEqual({ ok: true, avoirEmis: false });

    const relu = await prisma.dossier.findUniqueOrThrow({
      where: { id: dossier.id },
      include: { decisions: { include: { avoir: true } } },
    });
    expect(relu.statut).toBe("CLOTURE");
    expect(relu.decisions[0]?.avoir).toBeNull();
    expect(relu.decisions[0]?.imputation).toBe("RESTAURANT");
  });

  test("seul l'instructeur assigné peut trancher un dossier en attente", async () => {
    const dossier = await creerDossierPrisEnCharge(4000, staffAId);

    const resultat = await deciderDossier(dossier.id, staffBId, {
      issue: "ACCORDE",
      imputation: "THESPOON",
      motif,
    });
    expect(resultat.ok).toBe(false);

    const relu = await prisma.dossier.findUniqueOrThrow({ where: { id: dossier.id } });
    expect(relu.statut).toBe("EN_ATTENTE_INSTRUCTION");
  });

  test("un dossier escaladé sort de la file et peut être tranché par un autre membre du staff", async () => {
    const dossier = await creerDossierPrisEnCharge(4000, staffAId);

    const escalade = await deciderDossier(dossier.id, staffAId, { issue: "ESCALADE", motif });
    expect(escalade).toEqual({ ok: true, avoirEmis: false });
    expect((await prisma.dossier.findUniqueOrThrow({ where: { id: dossier.id } })).statut).toBe("ESCALADE");

    const reprise = await deciderDossier(dossier.id, staffBId, {
      issue: "PARTIEL",
      montantAccordeCentimes: 1500,
      imputation: "CLIENT",
      motif: "Responsabilité partagée : la moitié des couverts était bien servie.",
    });
    expect(reprise).toEqual({ ok: true, avoirEmis: true });

    const relu = await prisma.dossier.findUniqueOrThrow({
      where: { id: dossier.id },
      include: { decisions: { include: { avoir: true }, orderBy: { createdAt: "desc" } } },
    });
    expect(relu.statut).toBe("CLOTURE");
    // La première instruction n'est pas écrasée : c'est tout l'intérêt d'une
    // table de décisions plutôt que de colonnes sur le dossier.
    expect(relu.decisions).toHaveLength(2);
    expect(relu.decisions[0]?.montantAccordeCentimes).toBe(1500);
    expect(relu.decisions[0]?.avoir?.montantCentimes).toBe(1500);
  });
});

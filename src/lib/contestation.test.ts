import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  calculerMontantConteste,
  creerDossierContestation,
  decisionStatutDossier,
  delaiContestationExpire,
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

  test("une ligne sous le seuil est créditée d'office, montant et seuil tracés", async () => {
    const resultat = await creerDossierContestation({
      factureId,
      restaurantId,
      restaurantContactId,
      lignes: [{ ligneFactureId: ligneFaibleId, motif: "NO_SHOW" }],
      commentaire: null,
    });
    expect(resultat.ok).toBe(true);
    if (!resultat.ok) return;

    const dossier = await prisma.dossier.findUniqueOrThrow({ where: { id: resultat.dossierId } });
    expect(dossier.statut).toBe("CREDITE_OFFICE");
    expect(dossier.montantContesteCentimes).toBe(500);
    expect(dossier.seuilAppliqueCentimes).toBe(1000);
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

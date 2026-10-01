import "dotenv/config";

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { envoyerDemandeContactRestaurateur } from "@/app/(site)/devenir-partenaire/actions";
import { deciderDemandeRestaurateur } from "./demandes-restaurateur";
import { prisma } from "./prisma";

/**
 * Dépôt public d'une demande de partenariat — nécessite une vraie base
 * Postgres (comme les autres describe de ce dossier). Vérifie surtout que le
 * journal commence au dépôt, avec le bon auteur (aucun côté staff).
 */
describe("envoyerDemandeContactRestaurateur", () => {
  const email = `demande-depot-${randomUUID()}@test.example`;

  afterAll(async () => {
    const demandes = await prisma.demandeContactRestaurateur.findMany({
      where: { email },
      select: { id: true },
    });
    await prisma.evenementDemandeRestaurateur.deleteMany({
      where: { demandeId: { in: demandes.map((d) => d.id) } },
    });
    await prisma.demandeContactRestaurateur.deleteMany({ where: { email } });
  });

  test("crée la demande et son événement DEPOT, sans auteur staff", async () => {
    const formData = new FormData();
    formData.set("nom", "Sophie Laurent");
    formData.set("email", email);
    formData.set("etablissement", "Le Test");
    formData.set("adresse", "1 rue du Test, 75009 Paris");
    formData.set("siren", "123 456 789");
    formData.set("menusALaCuillere", "oui");
    formData.set("message", "Nous souhaitons être référencés.");

    const etat = await envoyerDemandeContactRestaurateur({}, formData);
    expect(etat.ok).toBe(true);

    const demande = await prisma.demandeContactRestaurateur.findFirstOrThrow({
      where: { email },
      include: { evenements: true },
    });
    expect(demande.siren).toBe("123456789");
    expect(demande.menusALaCuillere).toBe(true);
    expect(demande.statut).toBe("A_QUALIFIER");
    expect(demande.evenements).toHaveLength(1);
    expect(demande.evenements[0]?.type).toBe("DEPOT");
    expect(demande.evenements[0]?.auteurStaffId).toBeNull();
  });
});

/**
 * Accepter / rejeter une demande — nécessite une vraie base Postgres. Le
 * journal est en ajout seul : une décision rejouée ne doit pas y ajouter de
 * deuxième ligne.
 */
describe("deciderDemandeRestaurateur", () => {
  let staffId: string;
  const email = `demande-decision-${randomUUID()}@test.example`;

  beforeAll(async () => {
    const staff = await prisma.staff.create({
      data: { nom: "Staff Demandes", email: `${randomUUID()}@staff.test.example` },
    });
    staffId = staff.id;
  });

  afterAll(async () => {
    const demandes = await prisma.demandeContactRestaurateur.findMany({
      where: { email },
      select: { id: true },
    });
    await prisma.evenementDemandeRestaurateur.deleteMany({
      where: { demandeId: { in: demandes.map((d) => d.id) } },
    });
    await prisma.demandeContactRestaurateur.deleteMany({ where: { email } });
    await prisma.staff.delete({ where: { id: staffId } });
  });

  async function creerDemande() {
    const demande = await prisma.demandeContactRestaurateur.create({
      data: {
        nom: "Contact test",
        email,
        etablissement: "Test",
        adresse: null,
        message: "Bonjour",
      },
    });
    await prisma.evenementDemandeRestaurateur.create({
      data: { demandeId: demande.id, type: "DEPOT" },
    });
    return demande;
  }

  test("accepte une demande et journalise l'auteur et le motif", async () => {
    const demande = await creerDemande();

    const resultat = await deciderDemandeRestaurateur(
      demande.id,
      staffId,
      "ACCEPTEE",
      "Établissement validé.",
    );
    expect(resultat.ok).toBe(true);

    const relue = await prisma.demandeContactRestaurateur.findUniqueOrThrow({
      where: { id: demande.id },
    });
    expect(relue.statut).toBe("ACCEPTEE");

    const decision = await prisma.evenementDemandeRestaurateur.findFirstOrThrow({
      where: { demandeId: demande.id, type: "DECISION" },
    });
    expect(decision.auteurStaffId).toBe(staffId);
    expect(decision.createdAt).toBeInstanceOf(Date);
    expect(decision.details).toMatchObject({
      issue: "ACCEPTEE",
      motif: "Établissement validé.",
    });
  });

  test("rejette une demande et journalise le rejet", async () => {
    const demande = await creerDemande();

    const resultat = await deciderDemandeRestaurateur(
      demande.id,
      staffId,
      "REJETEE",
      "Hors zone de couverture.",
    );
    expect(resultat.ok).toBe(true);

    const relue = await prisma.demandeContactRestaurateur.findUniqueOrThrow({
      where: { id: demande.id },
    });
    expect(relue.statut).toBe("REJETEE");

    const decision = await prisma.evenementDemandeRestaurateur.findFirstOrThrow({
      where: { demandeId: demande.id, type: "DECISION" },
    });
    expect(decision.auteurStaffId).toBe(staffId);
    expect(decision.details).toMatchObject({ issue: "REJETEE", motif: "Hors zone de couverture." });
  });

  test("décider sans motif est refusé : rien n'est écrit", async () => {
    const demande = await creerDemande();

    const resultat = await deciderDemandeRestaurateur(demande.id, staffId, "REJETEE", "   ");
    expect(resultat.ok).toBe(false);
    if (resultat.ok) return;
    expect(resultat.erreur).toMatch(/motif/i);

    const relue = await prisma.demandeContactRestaurateur.findUniqueOrThrow({
      where: { id: demande.id },
    });
    expect(relue.statut).toBe("A_QUALIFIER");
    expect(
      await prisma.evenementDemandeRestaurateur.count({
        where: { demandeId: demande.id, type: "DECISION" },
      }),
    ).toBe(0);
  });

  test("rejouer une décision sur une demande déjà décidée n'ajoute pas de ligne", async () => {
    const demande = await creerDemande();
    expect(
      (await deciderDemandeRestaurateur(demande.id, staffId, "ACCEPTEE", "Première décision.")).ok,
    ).toBe(true);

    const deuxieme = await deciderDemandeRestaurateur(
      demande.id,
      staffId,
      "REJETEE",
      "Tentative de rejeu.",
    );
    expect(deuxieme.ok).toBe(false);
    if (deuxieme.ok) return;
    expect(deuxieme.erreur).toMatch(/déjà/);

    const decisions = await prisma.evenementDemandeRestaurateur.findMany({
      where: { demandeId: demande.id, type: "DECISION" },
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.details).toMatchObject({ issue: "ACCEPTEE" });

    const relue = await prisma.demandeContactRestaurateur.findUniqueOrThrow({
      where: { id: demande.id },
    });
    expect(relue.statut).toBe("ACCEPTEE");
  });
});

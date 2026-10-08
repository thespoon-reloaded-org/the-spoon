import "dotenv/config";

import { describe, expect, test } from "vitest";

import { construireDateCreneau, estDansLaFenetreReservable } from "./creneaux";
import {
  choisirAvis,
  choisirContestations,
  cleOccupation,
  genererDemandes,
  planifierReservations,
  type RestaurantPlanifiable,
  type Tirage,
} from "./evenements-formation";
import { instantLocalDeJour } from "./fuseau";

/** mulberry32 : la même suite à chaque exécution, pour des tests qui ne clignotent pas. */
function tirage(graine = 42): Tirage {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lundi 12 octobre 2026, 10h à Paris. */
const MAINTENANT = instantLocalDeJour("2026-10-12", 10);

/** Ouvert tous les soirs de 19h à 20h : deux créneaux, 19:00 et 19:30. */
function restaurant(surcharge: Partial<RestaurantPlanifiable> = {}): RestaurantPlanifiable {
  return {
    id: "resto",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    capacite: 10,
    plages: Array.from({ length: 7 }, (_, jourSemaine) => ({
      jourSemaine,
      debutMinutes: 19 * 60,
      finMinutes: 20 * 60,
    })),
    exceptions: [],
    ...surcharge,
  };
}

const dineurs = (n: number) => Array.from({ length: n }, (_, i) => `dineur-${i}`);

function couvertsParCreneau(
  reservations: ReturnType<typeof planifierReservations>["reservations"],
) {
  const total = new Map<string, number>();
  for (const r of reservations) {
    const cle = cleOccupation(r.restaurantId, construireDateCreneau(r.jour, r.creneau)!);
    total.set(cle, (total.get(cle) ?? 0) + r.couverts);
  }
  return total;
}

describe("planifierReservations", () => {
  test("ne réserve que des créneaux ouverts, à venir, dans la fenêtre, sans dépasser la capacité", () => {
    const { reservations } = planifierReservations({
      quantite: 30,
      restaurants: [restaurant()],
      occupation: new Map(),
      dineurIds: dineurs(100),
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    expect(reservations.length).toBeGreaterThan(0);
    for (const r of reservations) {
      expect(["19:00", "19:30"]).toContain(r.creneau);
      expect(
        estDansLaFenetreReservable(construireDateCreneau(r.jour, r.creneau)!, MAINTENANT),
      ).toBe(true);
      expect(r.statut).toBe("CONFIRMEE");
      expect(r.creeLe).toEqual(MAINTENANT);
    }
    for (const couverts of couvertsParCreneau(reservations).values()) {
      expect(couverts).toBeLessThanOrEqual(10);
    }
  });

  test("un dîneur différent par réservation, et pas plus de réservations que de dîneurs", () => {
    const { reservations, manqueDe } = planifierReservations({
      quantite: 10,
      restaurants: [restaurant()],
      occupation: new Map(),
      dineurIds: dineurs(3),
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    expect(reservations).toHaveLength(3);
    expect(new Set(reservations.map((r) => r.dineurId)).size).toBe(3);
    expect(manqueDe).toBe("dineurs");
  });

  test("remplit la salle jusqu'au dernier couvert, puis s'arrête", () => {
    // Deux couverts par créneau, deux créneaux par soir, cinq soirs : 20 couverts en tout.
    const { reservations, manqueDe } = planifierReservations({
      quantite: 50,
      restaurants: [restaurant({ capacite: 2 })],
      occupation: new Map(),
      dineurIds: dineurs(100),
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    expect(manqueDe).toBe("creneaux");
    expect(reservations.reduce((somme, r) => somme + r.couverts, 0)).toBe(20);
  });

  test("tient compte des tables déjà prises et des fermetures exceptionnelles", () => {
    const complet = cleOccupation("resto", construireDateCreneau("2026-10-13", "19:00")!);
    const { reservations } = planifierReservations({
      quantite: 50,
      restaurants: [
        restaurant({ exceptions: [{ jour: "2026-10-14", creneau: "19:30", ouvert: false }] }),
      ],
      occupation: new Map([[complet, 10]]),
      dineurIds: dineurs(100),
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    const pris = reservations.map((r) => `${r.jour} ${r.creneau}`);
    expect(pris).not.toContain("2026-10-13 19:00");
    expect(pris).not.toContain("2026-10-14 19:30");
  });

  test("le créneau déjà passé du jour n'est plus proposé", () => {
    const { reservations } = planifierReservations({
      quantite: 50,
      restaurants: [restaurant()],
      occupation: new Map(),
      dineurIds: dineurs(100),
      maintenant: instantLocalDeJour("2026-10-12", 19, 15),
      tirer: tirage(),
    });

    expect(reservations.map((r) => `${r.jour} ${r.creneau}`)).not.toContain("2026-10-12 19:00");
  });
});

describe("choisirAvis", () => {
  const passage = (restaurantId: string, userId: string, jour: string) => ({
    restaurantId,
    userId,
    email: `${userId}@test.example`,
    date: instantLocalDeJour(jour, 20),
  });

  test("un avis par dîneur et par restaurant, jamais sur une paire déjà notée", () => {
    const avis = choisirAvis({
      quantite: 10,
      passages: [
        passage("a", "u1", "2026-10-01"),
        passage("a", "u1", "2026-10-08"),
        passage("a", "u2", "2026-10-05"),
        passage("b", "u1", "2026-10-03"),
      ],
      dejaNotes: new Set(["a|u2"]),
      note: "realiste",
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    expect(avis.map((a) => `${a.restaurantId}|${a.dineurEmail}`).sort()).toEqual([
      "a|u1@test.example",
      "b|u1@test.example",
    ]);
    for (const a of avis) expect(a.creeLe).toEqual(MAINTENANT);
  });

  test("la note choisie par le formateur s'applique à tous", () => {
    const avis = choisirAvis({
      quantite: 3,
      passages: [
        passage("a", "u1", "2026-10-01"),
        passage("a", "u2", "2026-10-02"),
        passage("a", "u3", "2026-10-03"),
        passage("a", "u4", "2026-10-04"),
      ],
      dejaNotes: new Set(),
      note: 1,
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    expect(avis).toHaveLength(3);
    expect(avis.every((a) => a.noteCuilleres === 1)).toBe(true);
  });
});

describe("choisirContestations", () => {
  const facture = (id: string, joursDepuisEmission: number, surcharge = {}) => ({
    id,
    restaurantId: `resto-${id}`,
    genereeLe: new Date(MAINTENANT.getTime() - joursDepuisEmission * 24 * 60 * 60 * 1000),
    ligneIds: [`${id}-l1`, `${id}-l2`, `${id}-l3`, `${id}-l4`],
    contacts: [
      { id: `${id}-chef`, role: "CHEF_DE_SALLE" as const },
      { id: `${id}-gerant`, role: "GERANT" as const },
    ],
    ...surcharge,
  });

  test("seules les factures dans leur délai, avec une ligne libre et un contact, sont contestées", () => {
    const dossiers = choisirContestations({
      quantite: 10,
      factures: [
        facture("ouverte", 5),
        facture("expiree", 40),
        facture("sans-ligne", 5, { ligneIds: [] }),
        facture("sans-contact", 5, { contacts: [] }),
      ],
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    expect(dossiers.map((d) => d.factureId)).toEqual(["ouverte"]);
  });

  test("le gérant dépose, une à trois lignes de la facture, pour un même motif", () => {
    const dossiers = choisirContestations({
      quantite: 2,
      factures: [facture("f1", 3), facture("f2", 10), facture("f3", 20)],
      maintenant: MAINTENANT,
      tirer: tirage(),
    });

    expect(dossiers).toHaveLength(2);
    for (const d of dossiers) {
      expect(d.restaurantContactId).toBe(`${d.factureId}-gerant`);
      expect(d.lignes.length).toBeGreaterThanOrEqual(1);
      expect(d.lignes.length).toBeLessThanOrEqual(3);
      expect(d.lignes.every((l) => l.ligneFactureId.startsWith(`${d.factureId}-`))).toBe(true);
      expect(new Set(d.lignes.map((l) => l.motif)).size).toBe(1);
    }
  });
});

describe("genererDemandes", () => {
  test("des demandes que le formulaire « Devenir partenaire » aurait acceptées", () => {
    // `genererDemandes` passe chaque demande au schéma du formulaire : il lève sinon.
    const demandes = genererDemandes(20, tirage());

    expect(demandes).toHaveLength(20);
    expect(new Set(demandes.map((d) => d.etablissement)).size).toBe(20);
    for (const d of demandes) {
      expect(d.email).toMatch(/^[a-z0-9.-]+@[a-z0-9-]+\.example$/);
      expect(d.siren).toMatch(/^\d{9}$/);
    }
  });
});

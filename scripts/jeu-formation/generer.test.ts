import { describe, expect, test } from "vitest";

import {
  datesDossier,
  dateEmissionFactures,
  resoudreReservations,
} from "../../src/lib/api-admin/creations";
import {
  schemaAvis,
  schemaDineur,
  schemaDossier,
  schemaReservation,
  schemaRestaurant,
  schemaStaff,
} from "../../src/lib/api-admin/schemas";
import { minutesDepuisCreneau } from "../../src/lib/horaires";

import { genererJeu, SEUIL_SUPPOSE_CENTIMES } from "./generer";

/**
 * Le jeu passe au crible des fonctions de l'API elles-mêmes : si une règle
 * s'ajoute à l'API sans que le générateur la suive, c'est ici que ça casse,
 * pas en production au milieu d'une injection.
 */
const maintenant = new Date("2026-09-24T10:00:00+02:00");
const plan = genererJeu({ maintenant, graine: 20260924 });

describe("jeu de formation", () => {
  test("est reproductible : même graine, même jour, même jeu", () => {
    const encore = genererJeu({ maintenant, graine: 20260924 });
    expect(encore.reservations.length).toBe(plan.reservations.length);
    expect(encore.reservations[1234]).toEqual(plan.reservations[1234]);
    expect(encore.dossiers).toEqual(plan.dossiers);
  });

  test("a la taille demandée : 50 restaurants, surtout à Paris, sur six mois", () => {
    expect(plan.restaurants).toHaveLength(50);
    expect(plan.restaurants.filter((r) => r.corps.ville === "Paris").length).toBeGreaterThanOrEqual(
      35,
    );
    expect(plan.periode.du).toBe("2026-04-01");
    expect(plan.moisFactures).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
  });

  test("chaque corps d'appel passe le schéma de sa route", () => {
    for (const m of plan.staff) expect(schemaStaff.safeParse(m).success).toBe(true);
    for (const r of plan.restaurants) {
      const resultat = schemaRestaurant.safeParse(r.corps);
      expect(resultat.error?.issues ?? []).toEqual([]);
    }
    for (const d of plan.dineurs) expect(schemaDineur.safeParse(d.corps).success).toBe(true);
    for (const r of plan.reservations) {
      const resultat = schemaReservation.safeParse({ restaurantId: "x", ...r.corps });
      expect(resultat.error?.issues ?? []).toEqual([]);
    }
    for (const d of plan.dossiers) {
      const resultat = schemaDossier.safeParse({
        factureId: "f",
        contactId: "c",
        commentaire: d.commentaire,
        lignes: d.lignes.map((l, i) => ({ ligneFactureId: `l${i}`, motif: l.motif })),
        deposeLe: d.deposeLe,
        etapes: d.etapes,
      });
      expect(resultat.error?.issues ?? []).toEqual([]);
    }
  });

  test("aucune réservation que l'API refuserait", () => {
    const restaurants = new Map(
      plan.restaurants.map((r) => [
        r.cle,
        {
          createdAt: new Date(r.corps.creeLe),
          plages: r.corps.horaires.map((h) => ({
            jourSemaine: h.jourSemaine,
            debutMinutes: minutesDepuisCreneau(h.debut)!,
            finMinutes: minutesDepuisCreneau(h.fin)!,
          })),
          exceptions: [],
        },
      ]),
    );
    const dineurParEmail = new Map(
      plan.dineurs.map((d) => [
        d.corps.email,
        { id: d.corps.email, createdAt: new Date(d.corps.creeLe) },
      ]),
    );
    const saisies = plan.reservations.map((r) =>
      schemaReservation.parse({ restaurantId: r.restaurant, ...r.corps }),
    );
    const { erreurs } = resoudreReservations(
      saisies,
      { restaurants, dineurParId: new Map(), dineurParEmail },
      maintenant,
    );
    expect(erreurs.slice(0, 5)).toEqual([]);
  });

  test("la capacité de chaque créneau est respectée", () => {
    const capacite = new Map(plan.restaurants.map((r) => [r.cle, r.corps.capacite]));
    const occupation = new Map<string, number>();
    for (const r of plan.reservations) {
      if (r.corps.statut === "ANNULEE") continue;
      const cle = `${r.restaurant}|${r.corps.jour}|${r.corps.creneau}`;
      occupation.set(cle, (occupation.get(cle) ?? 0) + r.corps.couverts);
      expect(occupation.get(cle)!).toBeLessThanOrEqual(capacite.get(r.restaurant)!);
    }
  });

  test("les litiges portent sur des lignes facturées, une seule fois, dans le délai", () => {
    const honorees = new Map(
      plan.reservations.filter((r) => r.corps.statut === "HONOREE").map((r) => [r.cle, r]),
    );
    const contestees = new Set<string>();
    const staff = new Map(plan.staff.map((m) => [m.email, new Date(m.creeLe)]));
    const contacts = new Map(plan.restaurants.map((r) => [r.cle, new Date(r.corps.creeLe)]));
    const cumul = new Map<string, number>();

    for (const d of plan.dossiers) {
      for (const l of d.lignes) {
        const res = honorees.get(l.reservation);
        expect(res?.restaurant).toBe(d.restaurant);
        expect(res!.corps.jour.slice(0, 7)).toBe(d.mois);
        expect(contestees.has(l.reservation)).toBe(false);
        contestees.add(l.reservation);
      }
      const emission = dateEmissionFactures(d.mois, maintenant);
      const dates = datesDossier(
        { deposeLe: new Date(d.deposeLe), etapes: d.etapes.map((e) => ({ le: new Date(e.le) })) },
        { factureEmiseLe: emission, contactCreeLe: contacts.get(d.restaurant)! },
        maintenant,
      );
      expect(dates.erreurs).toEqual([]);
      // Contestable : moins de 30 jours après l'émission, au jour du dépôt.
      expect(new Date(d.deposeLe).getTime() - emission.getTime()).toBeLessThan(
        30 * 24 * 60 * 60 * 1000,
      );
      for (const e of d.etapes)
        expect(new Date(e.le).getTime()).toBeGreaterThan(staff.get(e.par)!.getTime());

      // Crédit d'office ⇔ cumul contesté sur la facture sous le seuil.
      const cle = `${d.restaurant}|${d.mois}`;
      cumul.set(cle, (cumul.get(cle) ?? 0) + d.montantCentimes);
      expect(d.creditOffice).toBe(cumul.get(cle)! < SEUIL_SUPPOSE_CENTIMES);
      if (d.creditOffice) expect(d.etapes).toEqual([]);
    }
  });

  test("un avis vient après un service honoré, un seul par dîneur et par restaurant", () => {
    const servis = new Map<string, Date[]>();
    for (const r of plan.reservations) {
      if (r.corps.statut !== "HONOREE") continue;
      const cle = `${r.restaurant}|${r.corps.dineurEmail}`;
      const date = new Date(r.cle.split("|").at(-1)!);
      (servis.get(cle) ?? servis.set(cle, []).get(cle)!).push(date);
    }
    const paires = new Set<string>();
    for (const a of plan.avis) {
      const cle = `${a.restaurant}|${a.corps.dineurEmail}`;
      expect(paires.has(cle)).toBe(false);
      paires.add(cle);
      const creeLe = new Date(a.corps.creeLe);
      expect(servis.get(cle)?.some((d) => d.getTime() < creeLe.getTime())).toBe(true);
      expect(creeLe.getTime()).toBeLessThanOrEqual(maintenant.getTime());
      expect(schemaAvis.safeParse({ restaurantId: "x", ...a.corps }).success).toBe(true);
    }
    const notes = plan.avis.map((a) => a.corps.noteCuilleres);
    const moyenne = notes.reduce((x, y) => x + y, 0) / notes.length;
    expect(moyenne).toBeGreaterThan(3.8);
    expect(moyenne).toBeLessThan(4.4);
    expect(notes.filter((n) => n === 1).length).toBeGreaterThan(0);
  });

  test("ressemble à un vrai mois de restaurant", () => {
    const n = plan.reservations.length;
    const part = (statut: string) =>
      plan.reservations.filter((r) => r.corps.statut === statut).length / n;
    expect(part("HONOREE")).toBeGreaterThan(0.78);
    expect(part("ANNULEE")).toBeGreaterThan(0.05);
    expect(part("NO_SHOW")).toBeGreaterThan(0.02);
    expect(part("NO_SHOW")).toBeLessThan(0.08);
    // Paris se vide en août.
    const parisAout = plan.reservations.filter(
      (r) => r.restaurant.endsWith("|Paris") && r.corps.jour.startsWith("2026-08"),
    ).length;
    const parisJuin = plan.reservations.filter(
      (r) => r.restaurant.endsWith("|Paris") && r.corps.jour.startsWith("2026-06"),
    ).length;
    expect(parisAout).toBeLessThan(parisJuin * 0.75);
    // Une file de litiges vivante sur la dernière facture.
    const ouverts = plan.dossiers.filter(
      (d) => !d.creditOffice && d.etapes.at(-1)?.type !== "DECISION",
    );
    expect(ouverts.length).toBeGreaterThanOrEqual(5);
  });
});

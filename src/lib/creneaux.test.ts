import { describe, expect, test } from "vitest";

import {
  cleCreneau,
  construireDateCreneau,
  estDansLaFenetreReservable,
  genererGrilleMois,
  genererJoursReservables,
  NB_JOURS_RESERVABLES,
} from "./creneaux";
import {
  ajouterJours,
  aujourdHuiIso,
  jourIsoValide,
  jourSemaineIso,
  moisAdjacent,
  moisIso,
} from "./fuseau";

/**
 * Comme dans `fuseau.test.ts`, les assertions portent sur des instants
 * absolus : c'est ce qui part en base, et c'est là qu'était le défaut.
 */
describe("un créneau réservé est un instant, pas une heure de serveur", () => {
  test("19h le 22 septembre veut dire 19h à Paris", () => {
    expect(construireDateCreneau("2026-09-22", "19:00")?.toISOString()).toBe(
      "2026-09-22T17:00:00.000Z",
    );
  });

  test("et 19h en janvier aussi, malgré l'heure d'hiver", () => {
    expect(construireDateCreneau("2026-01-15", "19:00")?.toISOString()).toBe(
      "2026-01-15T18:00:00.000Z",
    );
  });

  test("la clé d'occupation se relit exactement comme elle a été écrite", () => {
    for (const jour of ["2026-01-15", "2026-03-29", "2026-10-25"]) {
      for (const creneau of ["12:00", "19:30", "22:00"]) {
        const date = construireDateCreneau(jour, creneau)!;
        expect(cleCreneau(date)).toBe(`${jour}_${creneau}`);
      }
    }
  });

  test("un créneau hors de la liste ou un jour qui n'existe pas ne construisent rien", () => {
    expect(construireDateCreneau("2026-09-22", "23:15")).toBeNull();
    expect(construireDateCreneau("2026-02-30", "19:00")).toBeNull();
    expect(construireDateCreneau("2026-13-01", "19:00")).toBeNull();
    expect(construireDateCreneau("pas-une-date", "19:00")).toBeNull();
  });
});

describe("le jour qu'on est", () => {
  /**
   * 23h30 UTC un lundi, c'est 1h30 du matin le mardi à Paris : la fenêtre
   * réservable doit s'ouvrir sur mardi. L'ancienne version, en production,
   * proposait encore le lundi — et ses créneaux étaient tous passés.
   */
  test("après minuit à Paris, la fenêtre a changé de jour", () => {
    const jours = genererJoursReservables(new Date("2026-09-21T23:30:00.000Z"));
    expect(jours[0]?.iso).toBe("2026-09-22");
    expect(jours).toHaveLength(NB_JOURS_RESERVABLES);
    expect(jours.at(-1)?.iso).toBe("2026-09-26");
  });

  test("le jour de la semaine affiché suit le jour parisien", () => {
    const jours = genererJoursReservables(new Date("2026-09-21T23:30:00.000Z"));
    expect(jours[0]?.jourSemaine).toBe("mar.");
    expect(jours[0]?.numero).toBe("22");
  });

  test("aujourd'hui, c'est aujourd'hui à Paris", () => {
    expect(aujourdHuiIso(new Date("2026-09-21T23:30:00.000Z"))).toBe("2026-09-22");
    expect(aujourdHuiIso(new Date("2026-09-22T21:59:00.000Z"))).toBe("2026-09-22");
  });
});

describe("arithmétique de calendrier", () => {
  test("ajouter un jour traverse un changement d'heure sans se décaler", () => {
    expect(ajouterJours("2026-10-24", 1)).toBe("2026-10-25");
    expect(ajouterJours("2026-10-25", 1)).toBe("2026-10-26");
    expect(ajouterJours("2026-03-28", 2)).toBe("2026-03-30");
  });

  test("ajouter passe les fins de mois et d'année", () => {
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
    expect(ajouterJours("2028-02-28", 1)).toBe("2028-02-29");
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
    expect(ajouterJours("2026-01-01", -1)).toBe("2025-12-31");
  });

  test("un jour se valide sur le calendrier, pas seulement sur sa forme", () => {
    expect(jourIsoValide("2026-09-22")).toBe(true);
    expect(jourIsoValide("2028-02-29")).toBe(true);
    expect(jourIsoValide("2026-02-29")).toBe(false);
    expect(jourIsoValide("2026-13-01")).toBe(false);
    expect(jourIsoValide("22-09-2026")).toBe(false);
  });

  /**
   * Refuser plutôt que rendre NaN ou décaler en silence : une date bancale qui
   * traverse donne un écran vide ou un jour « undefined », bien plus cher à
   * comprendre qu'une erreur.
   */
  test("une date ou un mois qui n'existe pas fait échouer, pas dériver", () => {
    expect(() => ajouterJours("nawak", 1)).toThrow(/Jour invalide/);
    expect(() => jourSemaineIso("2026-02-30")).toThrow(/Jour invalide/);
    expect(() => genererGrilleMois("2026-99")).toThrow(/Mois invalide/);
    // Sans zéro de tête, le mois n'est pas reconnu : l'ancienne comparaison de
    // chaînes marquait alors les 42 jours de la grille comme hors du mois.
    expect(() => genererGrilleMois("2026-9")).toThrow(/Mois invalide/);
  });

  test("le lundi vaut 0, le dimanche 6", () => {
    expect(jourSemaineIso("2026-09-21")).toBe(0);
    expect(jourSemaineIso("2026-09-27")).toBe(6);
  });

  test("le mois est celui de Paris", () => {
    expect(moisIso(new Date("2026-09-30T23:30:00.000Z"))).toBe("2026-10");
    expect(moisAdjacent("2026-01", -1)).toBe("2025-12");
    expect(moisAdjacent("2026-12", 1)).toBe("2027-01");
  });

  test("la grille d'un mois commence un lundi et couvre six semaines", () => {
    const grille = genererGrilleMois("2026-09", new Date("2026-09-22T10:00:00.000Z"));
    expect(grille).toHaveLength(42);
    expect(grille[0]?.iso).toBe("2026-08-31");
    expect(grille[0]?.horsMois).toBe(true);
    expect(grille.find((jour) => jour.estAujourdhui)?.iso).toBe("2026-09-22");
    expect(grille.find((jour) => jour.iso === "2026-09-01")?.horsMois).toBe(false);
  });
});

describe("fenêtre réservable", () => {
  const maintenant = new Date("2026-09-22T10:00:00.000Z"); // midi à Paris

  test("un créneau passé est refusé, un créneau du jour à venir est accepté", () => {
    expect(
      estDansLaFenetreReservable(construireDateCreneau("2026-09-22", "12:00")!, maintenant),
    ).toBe(false);
    expect(
      estDansLaFenetreReservable(construireDateCreneau("2026-09-22", "19:00")!, maintenant),
    ).toBe(true);
  });

  test("elle s'arrête au même moment cinq jours plus tard", () => {
    expect(
      estDansLaFenetreReservable(construireDateCreneau("2026-09-26", "22:00")!, maintenant),
    ).toBe(true);
    expect(
      estDansLaFenetreReservable(construireDateCreneau("2026-09-27", "12:00")!, maintenant),
    ).toBe(false);
  });

  /**
   * Le week-end du changement d'heure ajoute une heure au calendrier : la
   * fenêtre doit rester "cinq jours, à la même heure", pas "cinq fois vingt-
   * quatre heures". Le 25 octobre, Paris repasse à UTC+1 ; ce vendredi-là,
   * 14h à Paris cinq jours plus tard vaut 13h UTC, pas 12h.
   */
  test("elle suit le calendrier, pas un compte de vingt-quatre heures", () => {
    const veilleDuChangement = new Date("2026-10-23T12:00:00.000Z"); // 14h à Paris
    const dansLaFenetre = (creneau: string) =>
      estDansLaFenetreReservable(construireDateCreneau("2026-10-28", creneau)!, veilleDuChangement);

    expect(dansLaFenetre("12:00")).toBe(true);
    // 13h30 à Paris = 12h30 UTC : dedans si on a compté en jours parisiens,
    // dehors si on a ajouté cinq fois 24 h à un instant UTC.
    expect(dansLaFenetre("13:30")).toBe(true);
    expect(dansLaFenetre("18:30")).toBe(false);
  });
});

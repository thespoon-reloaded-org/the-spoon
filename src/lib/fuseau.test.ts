import { describe, expect, test } from "vitest";

import {
  composantesLocales,
  debutDeJournee,
  formaterHeure,
  formaterJourCourt,
  formaterJourLong,
  heureLocale,
  instantLocal,
  jourIsoLocal,
} from "./fuseau";

/**
 * Toutes les assertions portent sur des instants absolus (`toISOString`), pas
 * sur un rendu local : c'est la seule façon de prouver quelque chose ici. Un
 * test qui comparerait deux heures murales passerait sur un poste français et
 * mentirait en production, où le serveur est en UTC — exactement le défaut
 * que ce module corrige.
 */
describe("heure murale parisienne vers instant", () => {
  test("l'été, Paris est en avance de deux heures sur UTC", () => {
    expect(instantLocal(2026, 9, 22, 19, 0).toISOString()).toBe("2026-09-22T17:00:00.000Z");
  });

  test("l'hiver, d'une seule", () => {
    expect(instantLocal(2026, 1, 15, 19, 0).toISOString()).toBe("2026-01-15T18:00:00.000Z");
  });

  test("le jour du passage à l'heure d'été, avant et après la bascule", () => {
    // 29 mars 2026 : à 2h du matin il est soudain 3h.
    expect(instantLocal(2026, 3, 29, 1, 30).toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(instantLocal(2026, 3, 29, 19, 0).toISOString()).toBe("2026-03-29T17:00:00.000Z");
  });

  test("le jour du passage à l'heure d'hiver", () => {
    // 25 octobre 2026 : à 3h du matin il est de nouveau 2h.
    expect(instantLocal(2026, 10, 25, 19, 0).toISOString()).toBe("2026-10-25T18:00:00.000Z");
  });

  test("minuit ouvre bien la journée, il ne la ferme pas", () => {
    expect(debutDeJournee("2026-09-22").toISOString()).toBe("2026-09-21T22:00:00.000Z");
    expect(jourIsoLocal(debutDeJournee("2026-09-22"))).toBe("2026-09-22");
  });
});

describe("instant vers heure murale parisienne", () => {
  test("une fin de soirée UTC est déjà le lendemain à Paris", () => {
    const instant = new Date("2026-09-21T23:30:00.000Z");
    expect(jourIsoLocal(instant)).toBe("2026-09-22");
    expect(heureLocale(instant)).toBe("01:30");
  });

  test("les composantes se lisent à Paris, pas sur l'horloge du serveur", () => {
    expect(composantesLocales(new Date("2026-09-22T17:00:00.000Z"))).toEqual({
      annee: 2026,
      mois: 9,
      jour: 22,
      heures: 19,
      minutes: 0,
      secondes: 0,
    });
  });

  test("aller-retour : toute heure murale se relit telle qu'on l'a écrite", () => {
    for (const jour of ["2026-01-15", "2026-03-29", "2026-06-30", "2026-10-25", "2026-12-31"]) {
      for (const heure of ["12:00", "19:30", "22:00"]) {
        const instant = debutDeJournee(jour);
        const [h, m] = heure.split(":").map(Number) as [number, number];
        const precis = instantLocal(
          Number(jour.slice(0, 4)),
          Number(jour.slice(5, 7)),
          Number(jour.slice(8, 10)),
          h,
          m,
        );
        expect(jourIsoLocal(precis)).toBe(jour);
        expect(heureLocale(precis)).toBe(heure);
        expect(jourIsoLocal(instant)).toBe(jour);
      }
    }
  });
});

describe("affichage", () => {
  const instant = new Date("2026-09-22T17:00:00.000Z"); // 19h à Paris

  test("l'heure affichée est celle de Paris", () => {
    expect(formaterHeure(instant)).toBe("19:00");
  });

  test("le jour affiché est celui de Paris", () => {
    expect(formaterJourLong(instant)).toBe("mardi 22 septembre");
    expect(formaterJourCourt(instant)).toBe("mar. 22 sept.");
  });

  /** 23h30 UTC, c'est déjà le mardi à Paris : l'écran doit dire mardi. */
  test("un instant de fin de soirée s'affiche au jour parisien", () => {
    expect(formaterJourLong(new Date("2026-09-21T23:30:00.000Z"))).toBe("mardi 22 septembre");
  });
});

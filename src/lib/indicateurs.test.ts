import { describe, expect, test } from "vitest";

import {
  activite,
  bornesPeriode,
  evolution,
  fiabilite,
  formaterEvolution,
  formaterPart,
  habitudes,
  lirePeriode,
  part,
  syntheseAssistant,
  syntheseAvis,
  type ReservationHabitude,
  type RestaurantLu,
} from "./indicateurs";

describe("lirePeriode", () => {
  test("accepte les périodes proposées", () => {
    expect(lirePeriode("7")).toBe(7);
    expect(lirePeriode(["90", "7"])).toBe(90);
  });

  test("retombe sur 30 jours pour tout le reste", () => {
    expect(lirePeriode(undefined)).toBe(30);
    expect(lirePeriode("15")).toBe(30);
    expect(lirePeriode("tout")).toBe(30);
  });
});

/**
 * Les assertions portent sur des instants absolus : elles tiennent sous
 * n'importe quel fuseau machine (voir README, « L'heure, c'est l'heure de
 * Paris »).
 */
describe("bornesPeriode", () => {
  test("les 7 derniers jours de Paris, aujourd'hui compris, comparés aux 7 d'avant à la même heure", () => {
    // Jeudi 1er octobre 2026, 9h à Paris (UTC+2).
    const maintenant = new Date("2026-10-01T07:00:00Z");
    const { courante, precedente } = bornesPeriode(7, maintenant);

    expect(courante.debut.toISOString()).toBe("2026-09-24T22:00:00.000Z"); // 25 sept., minuit
    expect(courante.fin).toBe(maintenant);
    expect(precedente.debut.toISOString()).toBe("2026-09-17T22:00:00.000Z"); // 18 sept., minuit
    expect(precedente.fin.toISOString()).toBe("2026-09-24T07:00:00.000Z"); // 24 sept., 9h
  });

  test("garde l'heure murale de part et d'autre du passage à l'heure d'hiver", () => {
    // Lundi 2 novembre 2026, 10h à Paris (UTC+1) ; on est passé à l'heure
    // d'hiver le 25 octobre.
    const { courante, precedente } = bornesPeriode(30, new Date("2026-11-02T09:00:00Z"));

    expect(courante.debut.toISOString()).toBe("2026-10-03T22:00:00.000Z"); // 4 oct., minuit (UTC+2)
    expect(precedente.debut.toISOString()).toBe("2026-09-03T22:00:00.000Z"); // 4 sept., minuit
    expect(precedente.fin.toISOString()).toBe("2026-10-03T08:00:00.000Z"); // 3 oct., 10h (UTC+2)
  });
});

describe("ratios", () => {
  test("rien à rapporter n'est pas zéro", () => {
    expect(part(0, 0)).toBeNull();
    expect(part(0, 4)).toBe(0);
    expect(evolution(5, 0)).toBeNull();
    expect(evolution(0, 4)).toBe(-1);
  });

  test("une part absente s'affiche « — », pas 0 %", () => {
    expect(formaterPart(null)).toBe("—");
    expect(formaterPart(0.424)).toMatch(/^42\s%$/u);
  });

  test("une évolution est signée, et stable quand elle s'arrondit à zéro", () => {
    expect(formaterEvolution(0.123)).toMatch(/^\+12\s%$/u);
    expect(formaterEvolution(-0.08)).toMatch(/^[-−]8\s%$/u);
    expect(formaterEvolution(0.004)).toBe("stable");
  });
});

describe("activite", () => {
  const resa = (userId: string, statut: "CONFIRMEE" | "ANNULEE" | "HONOREE", couverts = 2) => ({
    userId,
    statut,
    couverts,
  });

  test("compte les annulations dans les réservations prises, pas dans les couverts", () => {
    const synthese = activite([
      resa("ana", "HONOREE", 4),
      resa("ana", "CONFIRMEE", 2),
      resa("ben", "ANNULEE", 6),
      resa("ben", "CONFIRMEE", 3),
      resa("cyril", "ANNULEE", 2),
    ]);

    expect(synthese).toEqual({
      reservations: 5,
      annulees: 2,
      couverts: 9,
      dineursActifs: 3,
      dineursFideles: 1,
    });
  });

  test("annuler puis reprendre une table n'est pas revenir", () => {
    const synthese = activite([resa("ana", "ANNULEE"), resa("ana", "CONFIRMEE")]);
    expect(synthese.dineursActifs).toBe(1);
    expect(synthese.dineursFideles).toBe(0);
  });
});

describe("habitudes", () => {
  const restaurants = new Map<string, RestaurantLu>([
    ["r1", { nom: "Chez Antoine", ville: "Paris", cuisine: "Bistrot" }],
    ["r2", { nom: "La Soupière", ville: "paris ", cuisine: "Soupes" }],
    ["r3", { nom: "Le Bouillon", ville: "Lyon", cuisine: "Bistrot" }],
  ]);

  const resa = (
    restaurantId: string,
    date: string,
    statut: ReservationHabitude["statut"] = "CONFIRMEE",
  ): ReservationHabitude => ({
    restaurantId,
    date: new Date(date),
    statut,
    couverts: 2,
    userId: "u",
  });

  test("lit le jour et le service à l'heure de Paris, sur la date du créneau", () => {
    const resultat = habitudes(
      [
        resa("r1", "2026-09-26T18:00:00Z"), // samedi 20h à Paris
        resa("r1", "2026-09-28T10:30:00Z"), // lundi 12h30 à Paris
        resa("r2", "2026-09-26T19:30:00Z"), // samedi 21h30 à Paris
      ],
      restaurants,
    );

    expect(resultat.parJourSemaine).toEqual([1, 0, 0, 0, 0, 2, 0]);
    expect(resultat.midi).toBe(1);
    expect(resultat.soir).toBe(2);
  });

  test("classe les lieux sur les réservations maintenues, villes regroupées sans tenir compte de la casse", () => {
    const resultat = habitudes(
      [
        resa("r1", "2026-09-26T18:00:00Z"),
        resa("r2", "2026-09-26T18:00:00Z"),
        resa("r3", "2026-09-26T18:00:00Z"),
        resa("r3", "2026-09-27T18:00:00Z"),
        resa("r3", "2026-09-28T18:00:00Z", "ANNULEE"),
      ],
      restaurants,
    );

    expect(resultat.total).toBe(4);
    expect(resultat.restaurants.map((r) => [r.libelle, r.nombre])).toEqual([
      ["Le Bouillon", 2],
      ["Chez Antoine", 1],
      ["La Soupière", 1],
    ]);
    expect(resultat.villes.map((v) => [v.libelle, v.nombre, v.part])).toEqual([
      ["Lyon", 2, 0.5],
      ["Paris", 2, 0.5],
    ]);
    expect(resultat.cuisines[0]).toMatchObject({ libelle: "Bistrot", nombre: 3, part: 0.75 });
  });

  test("ne garde que les cinq premiers d'un classement", () => {
    const beaucoup = new Map<string, RestaurantLu>(
      Array.from({ length: 8 }, (_, i) => [
        `r${i}`,
        { nom: `Resto ${i}`, ville: "Paris", cuisine: "Bistrot" },
      ]),
    );
    const resultat = habitudes(
      [...beaucoup.keys()].map((id) => resa(id, "2026-09-26T18:00:00Z")),
      beaucoup,
    );
    expect(resultat.restaurants).toHaveLength(5);
  });
});

describe("fiabilite", () => {
  test("le taux de no-show ne porte que sur les services pointés", () => {
    expect(fiabilite({ HONOREE: 8, NO_SHOW: 2, CONFIRMEE: 3, ANNULEE: 5 })).toEqual({
      honorees: 8,
      noShows: 2,
      nonPointees: 3,
      tauxNoShow: 0.2,
    });
  });

  test("aucun service pointé : pas de taux, même s'il y a eu des services", () => {
    expect(fiabilite({ CONFIRMEE: 4 }).tauxNoShow).toBeNull();
  });
});

describe("syntheseAvis", () => {
  test("moyenne et répartition des notes", () => {
    expect(
      syntheseAvis(
        new Map([
          [5, 2],
          [3, 1],
        ]),
      ),
    ).toEqual({
      total: 3,
      moyenne: 13 / 3,
      parNote: [0, 0, 1, 0, 2],
    });
  });

  test("sans avis, pas de moyenne", () => {
    expect(syntheseAvis(new Map()).moyenne).toBeNull();
  });
});

describe("syntheseAssistant", () => {
  test("la satisfaction se calcule sur les propositions votées, pas sur les servies", () => {
    const synthese = syntheseAssistant(
      new Map([
        [null, 6],
        ["AIME", 3],
        ["AIME_PAS", 1],
      ]),
    );
    expect(synthese).toEqual({
      servies: 10,
      aime: 3,
      aimePas: 1,
      tauxVote: 0.4,
      satisfaction: 0.75,
    });
  });

  test("aucun vote : pas de satisfaction", () => {
    const synthese = syntheseAssistant(new Map([[null, 4]]));
    expect(synthese.tauxVote).toBe(0);
    expect(synthese.satisfaction).toBeNull();
  });
});

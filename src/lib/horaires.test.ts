import { describe, expect, test } from "vitest";

import {
  creneauDansLesHoraires,
  creneauxDuJourSemaine,
  formaterHoraires,
  formaterMinutes,
  fusionnerPlages,
  horairesDeclares,
  minutesDepuisCreneau,
  type Plage,
} from "./horaires";

/** "Mar-Sam 12h-14h, 19h-22h30" — l'horaire du restaurant seedé, en plages. */
const MAR_SAM: Plage[] = [1, 2, 3, 4, 5].flatMap((jourSemaine) => [
  { jourSemaine, debutMinutes: 12 * 60, finMinutes: 14 * 60 },
  { jourSemaine, debutMinutes: 19 * 60, finMinutes: 22 * 60 + 30 },
]);

describe("lecture et écriture d'une heure", () => {
  test("un créneau se lit en minutes depuis minuit", () => {
    expect(minutesDepuisCreneau("12:00")).toBe(720);
    expect(minutesDepuisCreneau("22:30")).toBe(1350);
  });

  test("ce qui n'est pas une heure ne se lit pas", () => {
    expect(minutesDepuisCreneau("midi")).toBeNull();
    expect(minutesDepuisCreneau("25:00")).toBeNull();
    expect(minutesDepuisCreneau("12:60")).toBeNull();
  });

  test("l'affichage suit l'usage français, sans minutes à l'heure pile", () => {
    expect(formaterMinutes(720)).toBe("12h");
    expect(formaterMinutes(1350)).toBe("22h30");
  });
});

describe("un créneau tombe-t-il dans les horaires", () => {
  test("oui dans un service, non en dehors", () => {
    expect(creneauDansLesHoraires(MAR_SAM, 1, "12:30")).toBe(true);
    expect(creneauDansLesHoraires(MAR_SAM, 1, "18:30")).toBe(false);
  });

  test("l'heure de fermeture ne s'attable pas, la dernière demi-heure avant si", () => {
    expect(creneauDansLesHoraires([{ jourSemaine: 1, debutMinutes: 720, finMinutes: 780 }], 1, "13:00")).toBe(false);
    expect(creneauDansLesHoraires([{ jourSemaine: 1, debutMinutes: 720, finMinutes: 780 }], 1, "12:30")).toBe(true);
  });

  test("un jour sans service est fermé", () => {
    expect(creneauDansLesHoraires(MAR_SAM, 0, "12:30")).toBe(false);
    expect(creneauDansLesHoraires(MAR_SAM, 6, "20:00")).toBe(false);
  });

  /**
   * Le comportement par défaut réclamé par le ticket : un restaurant qui n'a
   * rien déclaré continue de proposer tous ses créneaux, plutôt que de
   * disparaître de la réservation du jour au lendemain.
   */
  test("un restaurant sans horaires déclarés ouvre tout", () => {
    expect(horairesDeclares([])).toBe(false);
    expect(creneauDansLesHoraires([], 0, "12:00")).toBe(true);
    expect(creneauxDuJourSemaine([], 0)).toHaveLength(12);
  });

  test("les créneaux d'un jour ouvert sont ceux des services", () => {
    expect(creneauxDuJourSemaine(MAR_SAM, 1)).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
    ]);
    expect(creneauxDuJourSemaine(MAR_SAM, 0)).toEqual([]);
  });
});

describe("mise en forme des horaires affichés", () => {
  test("les jours consécutifs qui ouvrent pareil tiennent sur une ligne", () => {
    expect(formaterHoraires(MAR_SAM)).toEqual([
      "Mardi – samedi : 12h – 14h · 19h – 22h30",
      "Fermé : lundi, dimanche",
    ]);
  });

  test("un jour seul, et deux jours, se disent autrement qu'un intervalle", () => {
    const lundiSeul: Plage[] = [{ jourSemaine: 0, debutMinutes: 720, finMinutes: 840 }];
    expect(formaterHoraires(lundiSeul)[0]).toBe("Lundi : 12h – 14h");

    const lundiMardi: Plage[] = [0, 1].map((jourSemaine) => ({
      jourSemaine,
      debutMinutes: 720,
      finMinutes: 840,
    }));
    expect(formaterHoraires(lundiMardi)[0]).toBe("Lundi et mardi : 12h – 14h");
  });

  test("deux groupes d'horaires différents font deux lignes", () => {
    const semaine: Plage[] = [
      ...[0, 1, 2].map((jourSemaine) => ({ jourSemaine, debutMinutes: 720, finMinutes: 840 })),
      ...[3, 4].map((jourSemaine) => ({ jourSemaine, debutMinutes: 1140, finMinutes: 1350 })),
    ];
    expect(formaterHoraires(semaine)).toEqual([
      "Lundi – mercredi : 12h – 14h",
      "Jeudi et vendredi : 19h – 22h30",
      "Fermé : samedi, dimanche",
    ]);
  });

  test("rien de déclaré ne s'affiche pas comme « fermé toute la semaine »", () => {
    expect(formaterHoraires([])).toEqual([]);
  });
});

describe("fusion des services d'un même jour", () => {
  test("deux services qui se chevauchent n'en font qu'un", () => {
    expect(
      fusionnerPlages([
        { debutMinutes: 720, finMinutes: 840 },
        { debutMinutes: 780, finMinutes: 900 },
      ]),
    ).toEqual([{ debutMinutes: 720, finMinutes: 900 }]);
  });

  test("deux services qui se touchent n'en font qu'un", () => {
    expect(
      fusionnerPlages([
        { debutMinutes: 840, finMinutes: 900 },
        { debutMinutes: 720, finMinutes: 840 },
      ]),
    ).toEqual([{ debutMinutes: 720, finMinutes: 900 }]);
  });

  test("midi et soir restent deux services", () => {
    expect(
      fusionnerPlages([
        { debutMinutes: 1140, finMinutes: 1350 },
        { debutMinutes: 720, finMinutes: 840 },
      ]),
    ).toEqual([
      { debutMinutes: 720, finMinutes: 840 },
      { debutMinutes: 1140, finMinutes: 1350 },
    ]);
  });

  test("l'entrée n'est pas modifiée au passage", () => {
    const services = [{ debutMinutes: 720, finMinutes: 840 }];
    fusionnerPlages([...services, { debutMinutes: 780, finMinutes: 900 }]);
    expect(services).toEqual([{ debutMinutes: 720, finMinutes: 840 }]);
  });
});

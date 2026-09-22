import { describe, expect, test } from "vitest";

import type { StatutReservation } from "@/generated/prisma";

import {
  annulabilite,
  formaterDelaiAnnulation,
  limiteAnnulation,
  peutPrevenirAbsence,
  politiqueAnnulation,
} from "./annulation";

/** Un service à 20h le 23 septembre, en heure de Paris. */
const CRENEAU = new Date("2026-09-23T18:00:00.000Z");
const confirmee = (absencePrevenueLe: Date | null = null) => ({
  date: CRENEAU,
  statut: "CONFIRMEE" as StatutReservation,
  absencePrevenueLe,
});

describe("jusqu'à quand on peut annuler", () => {
  test("sans délai déclaré, jusqu'au créneau", () => {
    expect(limiteAnnulation(CRENEAU, null)).toBeNull();
    expect(annulabilite(confirmee(), null, new Date("2026-09-23T17:59:00.000Z"))).toEqual({
      annulable: true,
    });
  });

  /** Un délai de 0 ou négatif n'est pas une politique : c'est un champ mal rempli. */
  test("un délai nul ou négatif se lit comme pas de délai", () => {
    expect(limiteAnnulation(CRENEAU, 0)).toBeNull();
    expect(limiteAnnulation(CRENEAU, -3)).toBeNull();
  });

  test("avec un délai de 24 h, la limite tombe 24 h avant le créneau", () => {
    expect(limiteAnnulation(CRENEAU, 24)?.toISOString()).toBe("2026-09-22T18:00:00.000Z");
  });

  test("juste avant la limite, oui ; à la limite et après, non", () => {
    const avant = new Date("2026-09-22T17:59:00.000Z");
    const pile = new Date("2026-09-22T18:00:00.000Z");
    const apres = new Date("2026-09-22T18:01:00.000Z");

    expect(annulabilite(confirmee(), 24, avant)).toEqual({ annulable: true });
    expect(annulabilite(confirmee(), 24, pile)).toEqual({
      annulable: false,
      raison: "delai-depasse",
    });
    expect(annulabilite(confirmee(), 24, apres)).toEqual({
      annulable: false,
      raison: "delai-depasse",
    });
  });

  /**
   * C'est le défaut que ce ticket corrige : annuler à 19h59 une table de 20h.
   * Sans délai déclaré c'est permis, avec un délai ça ne l'est plus.
   */
  test("une minute avant le service : permis sans politique, refusé avec", () => {
    const uneMinuteAvant = new Date("2026-09-23T17:59:00.000Z");
    expect(annulabilite(confirmee(), null, uneMinuteAvant).annulable).toBe(true);
    expect(annulabilite(confirmee(), 2, uneMinuteAvant).annulable).toBe(false);
  });

  test("un créneau passé se refuse avant même de regarder le délai", () => {
    const apresLeService = new Date("2026-09-23T19:00:00.000Z");
    expect(annulabilite(confirmee(), null, apresLeService)).toEqual({
      annulable: false,
      raison: "creneau-passe",
    });
    expect(annulabilite(confirmee(), 24, apresLeService)).toEqual({
      annulable: false,
      raison: "creneau-passe",
    });
  });

  test("une réservation qui n'est plus confirmée ne s'annule pas", () => {
    const tot = new Date("2026-09-20T10:00:00.000Z");
    for (const statut of ["ANNULEE", "HONOREE", "NO_SHOW"] as StatutReservation[]) {
      expect(annulabilite({ ...confirmee(), statut }, 24, tot)).toEqual({
        annulable: false,
        raison: "non-annulable",
      });
    }
  });
});

describe("prévenir qu'on ne viendra pas", () => {
  /** Une heure avant le service, avec 24 h de délai : on ne peut plus annuler. */
  const tropTard = new Date("2026-09-23T17:00:00.000Z");

  test("possible dans la fenêtre où l'on ne peut plus annuler", () => {
    expect(peutPrevenirAbsence(confirmee(), 24, tropTard)).toBe(true);
  });

  /**
   * Tant qu'on peut annuler, on annule : ça libère vraiment la table. Offrir
   * les deux ouvrirait un état que l'interface ne produit jamais — une
   * réservation annulable *et* signalée absente, que le restaurant verrait
   * et pas le dîneur.
   */
  test("impossible tant que l'annulation reste ouverte", () => {
    expect(peutPrevenirAbsence(confirmee(), 24, new Date("2026-09-22T10:00:00.000Z"))).toBe(false);
    expect(peutPrevenirAbsence(confirmee(), null, tropTard)).toBe(false);
  });

  test("impossible deux fois", () => {
    const dejaPrevenu = confirmee(new Date("2026-09-23T10:00:00.000Z"));
    expect(peutPrevenirAbsence(dejaPrevenu, 24, tropTard)).toBe(false);
  });

  test("impossible une fois le service passé — il n'y a plus rien à libérer", () => {
    expect(peutPrevenirAbsence(confirmee(), 24, new Date("2026-09-23T19:00:00.000Z"))).toBe(false);
  });

  test("impossible sur une réservation déjà annulée", () => {
    const annulee = { ...confirmee(), statut: "ANNULEE" as StatutReservation };
    expect(peutPrevenirAbsence(annulee, 24, tropTard)).toBe(false);
  });
});

describe("ce qu'on annonce au dîneur", () => {
  test("le délai se dit en heures, ou en jours quand il tombe juste", () => {
    expect(formaterDelaiAnnulation(2)).toBe("2 h avant");
    expect(formaterDelaiAnnulation(24)).toBe("1 jour avant");
    expect(formaterDelaiAnnulation(48)).toBe("2 jours avant");
    expect(formaterDelaiAnnulation(36)).toBe("36 h avant");
    expect(formaterDelaiAnnulation(null)).toBeNull();
  });

  test("la promesse faite avant de réserver dit toujours quelque chose", () => {
    expect(politiqueAnnulation(24)).toBe("annulation gratuite jusqu'à 1 jour avant");
    expect(politiqueAnnulation(null)).toBe("annulation gratuite jusqu'à l'heure du repas");
  });
});

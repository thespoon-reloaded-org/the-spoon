import { describe, expect, test } from "vitest";

import { CASES, checkDigit, encodePassword, ITEMS, verifyPassword, type Rank } from "./game";

describe("game passwords", () => {
  test("every item and rank round-trips through verify", () => {
    const ranks: Rank[] = ["S", "A", "B", "C", "SLATE"];
    for (const item of ITEMS) {
      for (const rank of ranks) {
        const result = verifyPassword(encodePassword(item.id, rank));
        expect(result).toMatchObject({
          valid: true,
          item: item.id,
          rank,
          onSlate: rank === "SLATE",
        });
      }
    }
  });

  test("the format is WORD-WORD-WORD-RC with the documented check digit", () => {
    const [first, second, third] = ITEMS[0]!.words;
    const expectedCheck = checkDigit([first!, second!, third!], 3);
    expect(encodePassword("s1-1a", "A")).toBe(`${first}-${second}-${third}-3${expectedCheck}`);
  });

  test("a wrong check digit is rejected", () => {
    const password = encodePassword("S1-1B", "B");
    const check = Number(password.at(-1));
    const tampered = `${password.slice(0, -1)}${(check + 1) % 10}`;
    expect(verifyPassword(tampered)).toMatchObject({ valid: false, reason: "wrong check digit" });
  });

  test("unknown or mixed-up words are rejected", () => {
    expect(verifyPassword("CHAT-CHIEN-LOUP-31").valid).toBe(false);
    const mixed = [ITEMS[0]!.words[0], ITEMS[1]!.words[1], ITEMS[0]!.words[2]].join("-") + "-30";
    expect(verifyPassword(mixed)).toMatchObject({ valid: false, reason: "unknown words" });
  });

  test("words and ids are unique across items of every case", () => {
    const words = ITEMS.flatMap((item) => item.words);
    expect(new Set(words).size).toBe(words.length);
    expect(ITEMS.map((item) => item.id)).toEqual([
      "S1-1A",
      "S1-1B",
      "S1-2A",
      "S1-2B",
      "S1-3A",
      "S1-3B",
      "S2-1",
      "S2-2",
      "S2-3",
    ]);
  });

  test("every case file is loaded, in order", () => {
    expect(CASES.map((gameCase) => gameCase.case)).toEqual(["01", "02"]);
  });

  test("every item has three words in A-Z, as the password format needs", () => {
    for (const item of ITEMS) {
      expect(item.words).toHaveLength(3);
      for (const word of item.words) expect(word).toMatch(/^[A-Z]+$/);
    }
  });

  test("case 1 passwords are unchanged since the first session", () => {
    // Players noted these on 20 November 2026: never let a new case shift them.
    const ranks: Rank[] = ["S", "A", "B", "C", "SLATE"];
    const expected: Record<string, string[]> = {
      "S1-1A": [
        "PLUIE-ADDITION-NEON-49",
        "PLUIE-ADDITION-NEON-38",
        "PLUIE-ADDITION-NEON-27",
        "PLUIE-ADDITION-NEON-16",
        "PLUIE-ADDITION-NEON-05",
      ],
      "S1-1B": [
        "COUTEAU-ESCALIER-LAMPE-49",
        "COUTEAU-ESCALIER-LAMPE-38",
        "COUTEAU-ESCALIER-LAMPE-27",
        "COUTEAU-ESCALIER-LAMPE-16",
        "COUTEAU-ESCALIER-LAMPE-05",
      ],
      "S1-2A": [
        "TROTTOIR-SERRURE-FUMEE-43",
        "TROTTOIR-SERRURE-FUMEE-32",
        "TROTTOIR-SERRURE-FUMEE-21",
        "TROTTOIR-SERRURE-FUMEE-10",
        "TROTTOIR-SERRURE-FUMEE-09",
      ],
      "S1-2B": [
        "IMPER-SIRENE-QUAI-43",
        "IMPER-SIRENE-QUAI-32",
        "IMPER-SIRENE-QUAI-21",
        "IMPER-SIRENE-QUAI-10",
        "IMPER-SIRENE-QUAI-09",
      ],
      "S1-3A": [
        "COMPTOIR-REVOLVER-BRUME-43",
        "COMPTOIR-REVOLVER-BRUME-32",
        "COMPTOIR-REVOLVER-BRUME-21",
        "COMPTOIR-REVOLVER-BRUME-10",
        "COMPTOIR-REVOLVER-BRUME-09",
      ],
      "S1-3B": [
        "ENSEIGNE-CENDRIER-GOUTTIERE-48",
        "ENSEIGNE-CENDRIER-GOUTTIERE-37",
        "ENSEIGNE-CENDRIER-GOUTTIERE-26",
        "ENSEIGNE-CENDRIER-GOUTTIERE-15",
        "ENSEIGNE-CENDRIER-GOUTTIERE-04",
      ],
    };
    for (const [id, passwords] of Object.entries(expected)) {
      expect(ranks.map((rank) => encodePassword(id, rank))).toEqual(passwords);
    }
  });

  test("case 2 items take a password like case 1, ids case-insensitive", () => {
    expect(encodePassword("s2-1", "A")).toMatch(/^CHAPEAU-VITRINE-PERSIENNE-3\d$/);
    expect(verifyPassword(encodePassword("S2-3", "SLATE"))).toMatchObject({
      valid: true,
      item: "S2-3",
      onSlate: true,
    });
  });
});

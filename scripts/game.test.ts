import { describe, expect, test } from "vitest";

import { checkDigit, encodePassword, ITEMS, verifyPassword, type Rank } from "./game";

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
    expect(encodePassword("s1-01", "A")).toBe(`${first}-${second}-${third}-3${expectedCheck}`);
  });

  test("a wrong check digit is rejected", () => {
    const password = encodePassword("S1-05", "B");
    const check = Number(password.at(-1));
    const tampered = `${password.slice(0, -1)}${(check + 1) % 10}`;
    expect(verifyPassword(tampered)).toMatchObject({ valid: false, reason: "wrong check digit" });
  });

  test("unknown or mixed-up words are rejected", () => {
    expect(verifyPassword("CHAT-CHIEN-LOUP-31").valid).toBe(false);
    const mixed = [ITEMS[0]!.words[0], ITEMS[1]!.words[1], ITEMS[0]!.words[2]].join("-") + "-30";
    expect(verifyPassword(mixed)).toMatchObject({ valid: false, reason: "unknown words" });
  });

  test("words are unique across items", () => {
    const words = ITEMS.flatMap((item) => item.words);
    expect(new Set(words).size).toBe(words.length);
    expect(ITEMS).toHaveLength(15);
  });
});

/**
 * Spoon City — retro "password saves" for the training game. See game/README.md.
 *
 * ```bash
 * pnpm game status                      # every item of every case
 * pnpm game password S1-1A --rank A     # password for a reviewed item
 * pnpm game password S2-1 --rank A
 * pnpm game password S1-1A --slate      # skipped item: "sur l'ardoise", score 0
 * pnpm game verify PLUIE-ADDITION-NEON-38
 * ```
 *
 * Every command accepts `--json`.
 *
 * Format: `WORD1-WORD2-WORD3-RC`. The three words identify the item
 * (game/case-NN.json, every case file is loaded), R is the rank digit (S=4, A=3, B=2, C=1, slate=0) and
 * C is a check digit: (sum of the char codes of the three words + R) mod 10.
 *
 * Not a secret, not a security mechanism: a light, trust-based proof that
 * the pair went through the review. Anyone reading this file can forge one.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type Rank = "S" | "A" | "B" | "C" | "SLATE";

export type Item = {
  id: string;
  title: string;
  type: string;
  acceptanceCriteria: string[];
  deliverables: string[];
  words: string[];
};

export type Case = {
  case: string;
  title: string;
  items: Item[];
};

const GAME_DIR = path.join(import.meta.dirname, "..", "game");

/** Every `game/case-NN.json`, in case order. */
export const CASES: Case[] = readdirSync(GAME_DIR)
  .filter((file) => /^case-\d+\.json$/.test(file))
  .sort()
  .map((file) => JSON.parse(readFileSync(path.join(GAME_DIR, file), "utf8")) as Case);

export const ITEMS: Item[] = CASES.flatMap((gameCase) => gameCase.items);

const RANK_DIGITS: Record<Rank, number> = { SLATE: 0, C: 1, B: 2, A: 3, S: 4 };

export function findItem(id: string): Item | undefined {
  const wanted = id.trim().toUpperCase();
  return ITEMS.find((item) => item.id === wanted);
}

export function checkDigit(words: string[], rankDigit: number): number {
  let sum = rankDigit;
  for (const word of words) {
    for (const char of word) sum += char.charCodeAt(0);
  }
  return sum % 10;
}

export function encodePassword(itemId: string, rank: Rank): string {
  const item = findItem(itemId);
  if (!item) throw new Error(`Unknown item: ${itemId}`);
  const rankDigit = RANK_DIGITS[rank];
  return `${item.words.join("-")}-${rankDigit}${checkDigit(item.words, rankDigit)}`;
}

export type Verification =
  | { valid: true; password: string; item: string; title: string; rank: Rank; onSlate: boolean }
  | { valid: false; password: string; reason: string };

export function verifyPassword(input: string): Verification {
  const password = input.trim().toUpperCase();
  const match = /^([A-Z]+)-([A-Z]+)-([A-Z]+)-(\d)(\d)$/.exec(password);
  if (!match) return { valid: false, password, reason: "malformed password" };
  const words = [match[1], match[2], match[3]] as string[];
  const rankDigit = Number(match[4]);
  const check = Number(match[5]);

  const item = ITEMS.find((candidate) => candidate.words.join("-") === words.join("-"));
  if (!item) return { valid: false, password, reason: "unknown words" };
  const rank = (Object.keys(RANK_DIGITS) as Rank[]).find((r) => RANK_DIGITS[r] === rankDigit);
  if (!rank) return { valid: false, password, reason: "unknown rank digit" };
  if (checkDigit(words, rankDigit) !== check) {
    return { valid: false, password, reason: "wrong check digit" };
  }
  return {
    valid: true,
    password,
    item: item.id,
    title: item.title,
    rank,
    onSlate: rank === "SLATE",
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `Usage:
  pnpm game status [--json]
  pnpm game password <ITEM> --rank S|A|B|C [--json]
  pnpm game password <ITEM> --slate [--json]
  pnpm game verify <PASSWORD> [--json]`;

function fail(message: string, json: boolean): never {
  if (json) console.log(JSON.stringify({ error: message }));
  else console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

export function main(argv: string[]): void {
  const json = argv.includes("--json");
  const args = argv.filter((arg) => arg !== "--json");
  const [command, ...rest] = args;

  if (command === "status") {
    const cases = CASES.map((gameCase) => ({
      case: gameCase.case,
      title: gameCase.title,
      items: gameCase.items.map(({ id, title, type }) => ({ id, title, type })),
    }));
    if (json) console.log(JSON.stringify({ cases }, null, 2));
    else {
      for (const gameCase of cases) {
        console.log(gameCase.title);
        for (const item of gameCase.items)
          console.log(`  ${item.id}  ${item.title}  (${item.type})`);
      }
    }
    return;
  }

  if (command === "password") {
    const itemId = rest.find((arg) => !arg.startsWith("--"));
    if (!itemId) fail("Missing item, e.g. S1-1A.", json);
    const item = findItem(itemId);
    if (!item) fail(`Unknown item: ${itemId}`, json);

    let rank: Rank;
    if (rest.includes("--slate")) rank = "SLATE";
    else {
      const flag = rest.indexOf("--rank");
      const value = flag >= 0 ? rest[flag + 1]?.toUpperCase() : undefined;
      if (value !== "S" && value !== "A" && value !== "B" && value !== "C") {
        fail("Give --rank S|A|B|C, or --slate.", json);
      }
      rank = value;
    }

    const password = encodePassword(item.id, rank);
    if (json) {
      console.log(
        JSON.stringify(
          { item: item.id, title: item.title, rank, onSlate: rank === "SLATE", password },
          null,
          2,
        ),
      );
    } else {
      console.log(password);
      if (rank === "SLATE") console.log(`${item.id} : sur l'ardoise (score 0).`);
    }
    return;
  }

  if (command === "verify") {
    const input = rest.find((arg) => !arg.startsWith("--"));
    if (!input) fail("Missing password.", json);
    const result = verifyPassword(input);
    if (json) console.log(JSON.stringify(result, null, 2));
    else if (!result.valid) console.log(`INVALID — ${result.reason}`);
    else {
      const standing = result.onSlate ? "sur l'ardoise" : `rank ${result.rank}`;
      console.log(`VALID — ${result.item} · ${result.title} · ${standing}`);
    }
    if (!result.valid) process.exitCode = 1;
    return;
  }

  fail(command ? `Unknown command: ${command}` : "Missing command.", json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}

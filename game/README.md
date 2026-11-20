# Spoon City — how to play

Spoon City is the noir game wrapped around the Product Building training. Session 1 is **« Affaire N° 1 · Les Clés »**: Git and code review on this repository. The items are `S1-01` to `S1-15`. **The backlog and your progress live on the HQ page: https://artifacts.hymalab.com/hymaia-product-builders/spoon-city-hq/** (sign in with your hymaia.com address). The acceptance criteria are also in [`case-01.json`](case-01.json), and `pnpm game status` lists the items.

## Play an item

0. **Fork this repo once**, unticking « Copy the main branch only » (some items need the old branches), and clone your fork.
1. **Pick an item** on the HQ page, e.g. `S1-01`.
2. **Branch** from an up-to-date `main` in your fork:
   ```bash
   git switch main && git pull
   git switch -c affaire-01/s1-01             # case-01/s1-01 works too
   ```
3. **Do the work.** Investigation items deliver a write-up in `docs/affaires/01/<ID>.md` (e.g. `docs/affaires/01/S1-01.md`). Code items are judged on the branch state (commits, diff, PR). Commit and push your branch.
4. **Ask for a review** in Claude Code, on your branch: `review S1-01` (or « on a fini S1-01, tu valides ? »). The `game-review` skill (`.claude/skills/game-review/`) checks that one item against its acceptance criteria, verifies the hashes, dates and authors you cite with Git, tells you what is missing and gives hints. It never edits your files.
5. **Get your password.** When the work holds up, you get a rank (S, A, B or C) and a password save. **Note it down**, and enter it on the HQ page under « Continuer ».

One item per review. Come back after improving: a new review gives a new password, and the best one counts.

## Passwords

Format `WORD1-WORD2-WORD3-RC`: three noir words that identify the item, the rank digit `R` (S=4, A=3, B=2, C=1, slate=0) and a check digit `C`.

```bash
pnpm game password S1-01 --rank A    # what the skill runs for you
pnpm game verify PLUIE-ADDITION-NEON-38
pnpm game status --json              # --json works on every command
```

No server, no secret: anyone can read `scripts/game.ts` and forge one. It is a light proof that you went through the review. Play fair.

## The slate (« sur l'ardoise »)

Stuck, or out of time? Ask to skip: « mets S1-04 sur l'ardoise ». You still get a password (rank digit 0), but the item is **on the slate**: not passed, score 0, a debt. Pay it back later by finishing the item and asking for a review again; the new password replaces the slate one.

## Trainer

Some criteria cannot be checked by the skill (something seen on screen, another pair's approval, CI on GitHub): it asks you to confirm and marks them « déclaratif ». The trainer may ask to see them.

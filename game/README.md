# Spoon City — how to play

Spoon City is the noir game wrapped around the Product Building training. Session 1 is **« Affaire N° 1 · Les Clés »**: Git and code review on this repository. Case 1 is **one track, « Enquête, puis correctif », with two use cases; pick the one you prefer**: `S1-01` « Pourquoi 100 couverts ? » (a restaurant gets too many guests) or `S1-06` « L'année qui retarde » (the footer shows the wrong year on 1 January). Same steps for both: dig through the history, write a report, then, if you code, fix the bug in a second worktree. The report alone gives rank B at best; the fix opens A and S. **The backlog and your progress live on the HQ page: https://artifacts.hymalab.com/hymaia-product-builders/spoon-city-hq/** (sign in with your hymaia.com address). The acceptance criteria are also in [`case-01.json`](case-01.json), and `pnpm game status` lists the items.

## Play an item

0. **Clone your own repo**, generated for you from this template: `gh repo clone thespoon-reloaded-org/the-spoon-<first-name>`. To do the fix, open Claude Code inside it and run `/installer-poste` (Node, pnpm, Postgres, demo data), then `nvm use`. The investigation only needs git.
1. **Pick a use case** on the HQ page: `S1-01` or `S1-06`.
2. **Investigate** on a branch from an up-to-date `main`:
   ```bash
   git switch main && git pull
   git switch -c affaire-01/s1-01
   ```
   Use `git log -S`, `git blame` and `git show` to find who changed what, when and why. Start the report in `docs/affaires/01/<ID>.md`. Don't commit it yet.
3. **Fix (optional, for people who code).** Leave the report as it is and open a second working folder on `main`:
   ```bash
   git worktree add ../the-spoon-fix -b affaire-01/s1-01-fix main
   cd ../the-spoon-fix
   pnpm install && pnpm prisma generate && cp ../the-spoon/.env .
   ```
   Fix the bug, add its test, run it, `pnpm typecheck`, `pnpm lint`, commit.
4. **Finish the report** back in `../the-spoon`: add the fix branch and commit, and the output of `git worktree list`. Commit it.
5. **Ask for a review** in Claude Code: `review S1-01`. The `game-review` skill (`.claude/skills/game-review/`) checks the report and the fix against their criteria, verifies the hashes, dates and authors you cite, tells you what is missing and gives hints. It never edits your files.
6. **Get your password.** You get a rank (S, A, B or C) and a password save. **Note it down**, and enter it on the HQ page under « Continuer ». Then `git worktree remove ../the-spoon-fix`.

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

Some criteria cannot be checked by the skill (something seen on screen, CI on GitHub, a test output from a removed worktree): it asks you to confirm and marks them « déclaratif ». The trainer may ask to see them.

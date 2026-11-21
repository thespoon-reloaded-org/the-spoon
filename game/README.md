# Spoon City — how to play

Spoon City is the noir game wrapped around the Product Building training. Session 1 is **« Affaire N° 1 · Les Clés »**: Git and code review on this repository. Case 1 has **three levels, each with its own password**: level 1, investigate the history; level 2, read Marc Ottavi's unfinished branch in a second worktree; level 3, fix the bug and merge Marc's branch, conflict included. At level 1 you **pick a case and keep it**: A « Pourquoi 100 couverts ? » (`S1-1A`, `S1-2A`, `S1-3A`) or B « L'année qui retarde » (`S1-1B`, `S1-2B`, `S1-3B`). The HQ page unlocks the next level once you enter the previous level's password. **The backlog and your progress live on the HQ page: https://artifacts.hymalab.com/hymaia-product-builders/spoon-city-hq/** (sign in with your hymaia.com address). The acceptance criteria are also in [`case-01.json`](case-01.json) and [`case-02.json`](case-02.json), and `pnpm game status` lists the items of every case.

Session 2 is **« Affaire N° 2 · Faux Témoins »**: testing. Three levels, no A/B choice: `S2-1` « La visite des tests » (read the test suite, no code), `S2-2` « Les faux témoins » (sabotage `src/lib/allergenes.ts` five times and see which tests notice), `S2-3` « 38 couverts sur une table de 3 » (choose a bound, test first, then the fix, on the prepared branch `affaire-02/couverts`).

## Play a level · case 1

0. **Clone your own repo**, generated for you from this template: `gh repo clone thespoon-reloaded-org/the-spoon-<first-name>`. To do the fix, open Claude Code inside it and run `/installer-poste` (Node, pnpm, Postgres, demo data), then `nvm use`. The investigation only needs git. Your session-1 clone of the shared `the-spoon` repo is no longer needed: work in your own.
1. **Pick a case** on the HQ page: A or B. You keep it for the three levels.
2. **Level 1 · Investigate** on `affaire-01/cas-a` (or `cas-b`) with `git log -S`, `git blame`, `git show` (cas B: `git log --author`, `--first-parent`, and `.github/workflows/ci.yml`). Write the « Enquête » section of `docs/affaires/01/cas-a.md` and commit it. Review: `review S1-1A`.
3. **Level 2 · Marc's branch.** Start the « La branche de Marc » section, don't commit it, and read Marc's branch in a second folder:
   ```bash
   git worktree add ../the-spoon-marc origin/refonte-fiche     # cas B: origin/refonte-annulation
   cd ../the-spoon-marc && git log -1 && git diff main...HEAD
   ```
   Back in `../the-spoon`, finish the section, `git worktree remove ../the-spoon-marc`, commit. Review: `review S1-2A`.
4. **Level 3 · The fix** (`/installer-poste` first). A worktree on `main`:
   ```bash
   git worktree add ../the-spoon-fix -b affaire-01/cas-a-fix main
   cd ../the-spoon-fix
   pnpm install && pnpm prisma generate && cp ../the-spoon/.env .
   ```
   Fix the bug, add its test, run it, `pnpm typecheck`, `pnpm lint`, commit. Then `git merge origin/refonte-fiche` (or rebase): resolve the conflict keeping both changes, rerun the test, commit. Cas B: find the bad commit with `git bisect run pnpm vitest run src/lib/annulation.test.ts`, undo it with `git revert`, then merge `origin/refonte-annulation`. Add the « Correctif » section to the report. Review: `review S1-3A`.
5. **After each review**, you get a rank (S, A, B or C) and a password. **Note it down** and enter it on the HQ page under « Continuer »: it unlocks the next level.

One level per review. Come back after improving: a new review gives a new password, and the best one counts.

## Play a level · case 2

Reports go on one branch, `affaire-02/rapport`, in your main folder (`../the-spoon`): `git switch main && git pull && git switch -c affaire-02/rapport`. Levels 1 and 2 need `/installer-poste` (Node, pnpm, Postgres), but no code.

1. **Level 1 · The test tour.** Run `pnpm test`, note the figures, read `src/lib/allergenes.test.ts`, find which of four README rules has no test. Write `docs/affaires/02/S2-1.md`, commit. Review: `review S2-1`.
2. **Level 2 · The false witnesses.** Five imposed sabotages in `src/lib/allergenes.ts`, one at a time: predict, apply, `pnpm vitest run src/lib/allergenes.test.ts`, note, `git restore src/lib/allergenes.ts`. Write `docs/affaires/02/S2-2.md`, commit. `src/` must end identical to `main`. Review: `review S2-2`.
3. **Level 3 · 38 covers.** The prepared branch in a second folder:
   ```bash
   git fetch origin
   git worktree add ../the-spoon-couverts affaire-02/couverts
   cd ../the-spoon-couverts
   pnpm install && pnpm prisma generate && cp ../the-spoon/.env .
   ```
   Pick a bound, ask Claude Code for the test only (`src/lib/signalement-bornes.test.ts`), see it fail, commit it; ask for the fix in `src/lib/signalement-bornes.ts`, see it pass, check the test did not move, commit. Write `docs/affaires/02/S2-3.md` on `affaire-02/rapport`. Review from `../the-spoon`: `review S2-3`, then `git worktree remove ../the-spoon-couverts`.

## Passwords

Format `WORD1-WORD2-WORD3-RC`: three noir words that identify the item, the rank digit `R` (S=4, A=3, B=2, C=1, slate=0) and a check digit `C`.

```bash
pnpm game password S1-1A --rank A    # what the skill runs for you
pnpm game password S2-1 --rank A
pnpm game verify PLUIE-ADDITION-NEON-38
pnpm game status --json              # --json works on every command
```

No server, no secret: anyone can read `scripts/game.ts` and forge one. It is a light proof that you went through the review. Play fair.

## The slate (« sur l'ardoise »)

Stuck, or out of time? Ask to skip: « mets S1-2A sur l'ardoise ». You still get a password (rank digit 0), but the level is **on the slate**: not passed, score 0, a debt. It still unlocks the next level. Pay it back later by finishing the level and asking for a review again; the new password replaces the slate one.

## Trainer

Some criteria cannot be checked by the skill (something seen on screen, CI on GitHub, a test output from a removed worktree): it asks you to confirm and marks them « déclaratif ». The trainer may ask to see them.

# Review criteria

Used by the automated reviewer (Pi, run by the SDLC control plane) on every task PR, and as a checklist for human reviewers. The reviewer also reads `AGENTS.md`. Review the diff against `main` and the task's acceptance criteria, not the whole repository.

## How to judge

Score each dimension from 1 to 5 using the anchors below. A score must follow from your findings: every score below 5 needs at least one finding that explains it, and a finding you cannot point to in the diff (file and line when possible) must not lower a score. Do not give 5 out of politeness, and do not give 1 or 2 without a blocker or major finding.

| Score | Meaning |
| --- | --- |
| 5 | No findings in this dimension. Nothing you would change. |
| 4 | Only minor findings (polish, naming, small gaps). |
| 3 | One major finding, or several minors that together hurt. Should be fixed before merging. |
| 2 | Several major findings, or a major finding in a critical area. |
| 1 | At least one blocker: the change must not merge as it is. |

Severities: **blocker** = must not merge (wrong behaviour, security hole, broken build or tests, violates a hard rule). **major** = a defect or clear rule violation that should be fixed in this PR. **minor** = polish.

Verdict: `approve` only when there is no blocker and no major finding in any dimension. Otherwise `changes_requested`.

## 1. Correctness

- Every acceptance criterion of the task is met and covered by a test or an obvious check.
- Edge cases and failure paths are handled: empty or missing data, concurrent requests, invalid input, time zone boundaries.
- Time follows the Paris-time rules documented in `README.md` ("L'heure, c'est l'heure de Paris"). Flag naive `Date` arithmetic.
- Absence of data is never presented as a positive fact (see "« Non renseigné » n'est pas « sans allergène »" in `README.md`).

## 2. Fit with the codebase

- Follows the conventions in `AGENTS.md` and the relevant `README.md` sections (screens and design charter, admin API, database migrations, training game). Flag deviations.
- Next.js: this version has breaking changes. APIs must match the docs in `node_modules/next/dist/docs/`, not memory. Flag deprecated or invented APIs.
- Keeps the existing structure and naming (domain names are French in this codebase). No new abstractions, dependencies or layers without a clear need.
- Database changes ship as a new Prisma migration. Existing migrations are never edited. The schema and the migration agree.

## 3. Tests

- New behaviour has the smallest test that protects it (Vitest). Bug fixes have a regression test.
- Tests check behaviour, not implementation details or markup. No tests that always pass.
- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. Do not claim they pass if you did not run them.

## 4. Security and privacy

- No secrets, tokens or credentials in code, logs, fixtures or comments. No new `.env` values with real data.
- Inputs are validated on the server. Authorization is checked for every new route or action (diner, restaurant contact, staff are separate spaces).
- No SQL built from strings, no raw HTML injection, no unvalidated redirects.
- Personal data is not logged or exposed beyond what the screen needs.

## 5. Readability and maintainability

- Plain control flow and clear names. Comments explain why, not what.
- Small functions and files. No dead code, no leftover debugging, no unrelated changes.
- The diff is limited to the task: flag extra files, reformatting of untouched code, or edits to specs and config that the task does not need.

## Out of scope for the reviewer

Do not edit files. Do not push. Do not review other tasks of the spec. If something in the task file itself is ambiguous or contradictory, say so in the summary instead of guessing.

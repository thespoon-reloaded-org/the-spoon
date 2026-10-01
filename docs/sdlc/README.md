# SDLC workflow and spec format

This repository is built with an agentic SDLC: specs live in Git, an automated runner (a control plane, a Daytona sandbox and the Pi coding agent) implements them one task at a time, and humans review and merge every PR. **Anyone, human or agent, who creates or edits a spec must follow this document exactly.** The control plane rebuilds its Kanban board from `main` using these rules; a spec that breaks them is shown with a "Parse error" badge and is never started.

## Where things live

```text
docs/specs/
├── 00-backlog/            ideas and drafts, never started
├── 01-ready-to-implement/ approved: merging a spec here STARTS an automated run
├── 02-implementing/       the runner moves it here in its first task PR
├── 03-done/               the runner moves it here in the completion PR
├── 99-abandoned/          stopped on purpose
└── NNN-short-slug/
    ├── SPEC.md
    └── tasks/
        ├── 001-short-slug.md
        └── 002-short-slug.md
```

- The **folder a spec sits in is its state**. The state of a task is its `status` frontmatter. Nothing else (no database) is the source of truth.
- Templates: [`templates/SPEC.md`](templates/SPEC.md) and [`templates/TASK.md`](templates/TASK.md). Copy them.

## Before you write a spec (agents: read this first)

**Ask the user: "Do you want this spec to be implemented by the SDLC runner?"** Do not decide on your own, and do not create files under `docs/specs/` before you know the answer.

- **Yes** -> follow this document: write the spec in `00-backlog/` (or, if the user explicitly approves, `01-ready-to-implement/`).
- **No** -> either do not write the spec under `docs/specs/` at all (keep the text in the conversation or in another folder, for example `docs/notes/`), or write it there with this frontmatter at the top of `SPEC.md`:

  ```yaml
  ---
  skip-sdlc-implementation: true
  ---
  ```

  A spec with `skip-sdlc-implementation: true` is shown on the board as a manual spec and is **never started by the runner**, even if it sits in `01-ready-to-implement/`. Use it for specs that a human or another tool will implement, or that only document a decision.

## Spec folder rules

- Folder name: `NNN-short-slug`. `NNN` is three or more digits and **unique across all state folders** (take the next unused number). The slug uses only letters, digits, `.`, `_` and `-` (no spaces, no accents).
- `SPEC.md` is required. Its title is the first `# ` heading. Optional YAML frontmatter is allowed; the only field with an effect is `skip-sdlc-implementation: true` (see "Before you write a spec").
- Tasks live in `tasks/` as `NNN-short-slug.md`. The file prefix is the task id.
- A spec must not exist in two state folders at once (a move must be a single rename in one PR).

## Task file format

Each task is a Markdown file that **starts with YAML frontmatter**:

```yaml
---
id: 002
title: Short imperative title
status: pending
depends_on:
  - 001
---
```

| Field | Rule |
| --- | --- |
| `id` | Required. Three or more digits, unique inside the spec, same as the filename prefix. |
| `title` | Required, non-empty, one line. |
| `status` | Required. One of `pending`, `implementing`, `implemented`, `done`, `blocked`. New tasks are `pending`. |
| `depends_on` | Optional list of task ids of the same spec. No unknown ids, no self reference, no cycles. |

What the statuses mean: `pending` not started; `done` the task PR was merged (the runner sets it inside the task's own PR, so merging the PR is the acceptance); `blocked` needs a human. `implementing` and `implemented` are legacy values from an earlier version of the workflow; the runner still accepts them and flips `implemented` to `done` in its next PR.

A task with a broken frontmatter, an unknown status, a missing id/title or a dependency problem puts the whole spec in error. After the frontmatter write the task as Markdown with a short description, an **Acceptance criteria** list and a **What to test** paragraph (see below).

### What to test

Every task ends with a `## What to test` section, written for the human reviewer (and used by the automated reviewer): the concrete things to try or check to accept this PR. For example the page to open, the command to run, the input to give and the result to expect, plus one or two edge cases or regressions worth a look. Keep it short (3 to 6 points). If nothing can be tried by hand (a pure refactor), say what to check instead (which tests cover it, what must stay unchanged). The runner copies this section into the PR description.

## Writing good specs and tasks

- **Size tasks for the reviewer** (see "Sizing tasks"). Every task costs a full cycle: a sandbox run, an automated review, a PR, a human review and a merge, so a task must be worth that cycle.
- **Keep the spec proportional.** A small change gets a short `SPEC.md` (a few lines of goal and scope). Do not write more spec than the diff it describes.
- Acceptance criteria must be **checkable**: a command that passes, a file that changes in a stated way, a behaviour a reviewer can see. Prefer "`pnpm typecheck` and `pnpm lint` pass" over "code is clean".
- State the scope and the non-goals in `SPEC.md`. Name the files expected to change.
- Put the reasoning in `SPEC.md` (goal, why, scope, non-goals, whole-spec acceptance criteria) and the concrete work in the tasks.
- Do not put secrets, credentials or personal data in a spec: its text is sent to a model and shown on the board.
- Write tasks in English (the agent's working language); the code may stay French where the codebase is.

## Sizing tasks

A task is one PR. Size it for the **reviewer**:

- **Independently reviewable.** A reviewer can understand the PR, check it and merge it without needing another task's PR. Merged alone, it leaves `main` working and consistent (it builds, there is no visible regression, no behaviour is half done).
- **Enough to test.** The PR delivers something observable the reviewer can actually try or verify: a behaviour, a screen, a command, a data change. A task that only renames a constant, or only adjusts what the previous task changed, gives the reviewer nothing meaningful to test.
- **Not too much to test.** A reviewer should be able to verify the PR in one sitting. If checking it takes several unrelated manual scenarios, or touches several areas that do not depend on each other, split it.

Consequences:

- Split along **behaviour the reviewer can test separately**, not by file or by layer.
- Do not split off a part that only makes sense together with another (a value tuned because another task changed a list, tests for code that another task adds): the reviewer could not judge it alone, and `main` would be inconsistent in between.
- A small, cohesive change is naturally one task. A spec has as many tasks as it has independently testable steps, and each one should be worth a review.

## Lifecycle

1. **Draft.** Create the spec in `00-backlog/` through a normal PR (after asking the user, see above). Nothing runs.
2. **Approve.** A human moves the folder to `01-ready-to-implement/` (one PR, a pure rename). **Merging that PR starts an automated run.** Agents must not do this move on their own; ask a human.
3. **Task PRs.** The runner creates the branch `feature/spec-NNN`, implements the first pending task whose dependencies are done, runs an automated review (see [`REVIEW.md`](../../REVIEW.md)), and opens a PR titled `SPEC-NNN / TASK-NNN — <title>`. The PR also sets the task to `done`. The first task PR moves the spec folder to `02-implementing/`.
4. **Review.** CI and a human review the PR. Request changes with a review ("Request changes") or a comment starting with `/pi`; the runner continues on the same PR (limited number of rounds). Merge when satisfied: merging is the acceptance of the task.
5. **Next task.** After the merge the runner starts the next pending task, again as its own PR.
6. **Completion.** The PR of the **last** open task also moves the spec to `03-done/`. Merging it ends the run. (Only if a spec ends up in an odd state, for example tasks edited by hand, the runner opens a separate `SPEC-NNN — complete` PR.)
7. **Abandon.** To stop a spec, close its open PR and move the folder to `99-abandoned/` in a PR. Never leave an abandoned spec in `01-ready-to-implement/`: it would start again.

Only one run is active per spec.

## The runner's sandbox: what not to run

The automated runner works in a small Daytona sandbox: about **1 GiB of memory, 1 CPU and a small disk** (`nproc` shows the host's cores and misleads tools into starting dozens of workers). A production build or a database does not fit and gets the agent killed, which wastes the run. CI is the authority for build, lint, database-backed tests and the full test suite, so the runner does not reproduce them.

In the sandbox the runner **does not**: run production builds (`next build`, `pnpm build`, `prisma migrate`), start or install a database server or any long-running service, or replay migrations. It **does**: `pnpm typecheck` and the unit tests of the files it changed, one command at a time.

What this means for specs and tasks:

- Acceptance criteria that can only be checked by a build, a migration run or database-backed tests are verified by **CI on the PR**, not by the runner. Say so in "What to test" (for example "CI `build` passes").
- Do not write criteria such as "the app builds locally" or "the migration applies on a fresh database" as something the agent must prove itself.
- A task that needs a new migration is fine: the agent writes the migration file and CI applies it.
- Review the CI result on the PR; for a failing check, comment `/pi` with what is wrong and the runner will fix it from the code and the failure text.

## What agents must not do

- Edit task `status` by hand in implementation PRs (the runner does it), or move spec folders other than as described above.
- Touch `.github/`, `AGENTS.md`, `REVIEW.md`, `netlify.toml`, `.gitmodules` or other tasks' files in a task PR: the runner rejects such PRs.
- Merge their own PRs or push to `main`.
- Create a spec directly in `01-ready-to-implement/` without human approval, or write any spec under `docs/specs/` without first asking the user whether the SDLC should implement it.

## Checking a spec before you open the PR

There is no validator command. Check by hand:

- [ ] The user said the SDLC should implement it (otherwise `skip-sdlc-implementation: true`, or not under `docs/specs/`).
- [ ] Folder `NNN-slug` is unique and well formed; `SPEC.md` has a `# ` title.
- [ ] Every task file starts with `---`, has `id`, `title`, `status: pending`, and ids match filenames.
- [ ] `depends_on` only references existing task ids and has no cycle.
- [ ] Each task has acceptance criteria that can be checked.
- [ ] Each task is independently reviewable, gives the reviewer something meaningful to test, and not too much (no task exists only to adjust what another one changes).
- [ ] Each task has a `## What to test` section.
- [ ] After merging, the board shows the spec without a "Parse error" badge.

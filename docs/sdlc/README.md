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

## Spec folder rules

- Folder name: `NNN-short-slug`. `NNN` is three or more digits and **unique across all state folders** (take the next unused number). The slug uses only letters, digits, `.`, `_` and `-` (no spaces, no accents).
- `SPEC.md` is required. Its title is the first `# ` heading. Optional YAML frontmatter is allowed but not needed.
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

What the statuses mean: `pending` not started; `implementing` the agent is working; `implemented` the task PR was merged (its code is on `main`); `done` flipped by the next PR (see below); `blocked` needs a human.

A task with a broken frontmatter, an unknown status, a missing id/title or a dependency problem puts the whole spec in error. After the frontmatter write the task as Markdown with a short description and an **Acceptance criteria** list.

## Writing good specs and tasks

- **One task = one PR = one reviewable change.** If a task needs more than a few files or more than a short conversation to review, split it. Tasks run in order, one at a time, each from the current `main`.
- Acceptance criteria must be **checkable**: a command that passes, a file that changes in a stated way, a behaviour a reviewer can see. Prefer "`pnpm typecheck` and `pnpm lint` pass" over "code is clean".
- State the scope and the non-goals in `SPEC.md`. Name the files expected to change.
- Put the reasoning in `SPEC.md` (goal, why, scope, non-goals, whole-spec acceptance criteria) and the concrete work in the tasks.
- Do not put secrets, credentials or personal data in a spec: its text is sent to a model and shown on the board.
- Write tasks in English (the agent's working language); the code may stay French where the codebase is.

## Lifecycle

1. **Draft.** Create the spec in `00-backlog/` through a normal PR. Nothing runs.
2. **Approve.** A human moves the folder to `01-ready-to-implement/` (one PR, a pure rename). **Merging that PR starts an automated run.** Agents must not do this move on their own; ask a human.
3. **Task PRs.** The runner creates the branch `feature/spec-NNN`, implements the first pending task whose dependencies are `done` or `implemented`, runs an automated review (see [`REVIEW.md`](../../REVIEW.md)), and opens a PR titled `SPEC-NNN / TASK-NNN — <title>`. The first task PR also moves the spec folder to `02-implementing/` and sets the task to `implemented`.
4. **Review.** CI and a human review the PR. Request changes with a review ("Request changes") or a comment starting with `/pi`; the runner continues on the same PR (limited number of rounds). Merge when satisfied.
5. **Next task.** After the merge the runner starts the next task. Its PR flips the previous task from `implemented` to `done`.
6. **Completion.** When every task is `implemented`/`done` the runner opens `SPEC-NNN — complete`, which marks all tasks `done` and moves the spec to `03-done/`.
7. **Abandon.** To stop a spec, close its open PR and move the folder to `99-abandoned/` in a PR. Never leave an abandoned spec in `01-ready-to-implement/`: it would start again.

Only one run is active per spec.

## What agents must not do

- Edit task `status` by hand in implementation PRs (the runner does it), or move spec folders other than as described above.
- Touch `.github/`, `AGENTS.md`, `REVIEW.md`, `netlify.toml`, `.gitmodules` or other tasks' files in a task PR: the runner rejects such PRs.
- Merge their own PRs or push to `main`.
- Create a spec directly in `01-ready-to-implement/` without human approval.

## Checking a spec before you open the PR

There is no validator command. Check by hand:

- [ ] Folder `NNN-slug` is unique and well formed; `SPEC.md` has a `# ` title.
- [ ] Every task file starts with `---`, has `id`, `title`, `status: pending`, and ids match filenames.
- [ ] `depends_on` only references existing task ids and has no cycle.
- [ ] Each task has acceptance criteria that can be checked.
- [ ] After merging, the board shows the spec without a "Parse error" badge.

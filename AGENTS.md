<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SDLC and specs

Specs live in `docs/specs/` and are implemented by an automated runner, one task per PR. Before creating or editing anything under `docs/specs/`, read [`docs/sdlc/README.md`](docs/sdlc/README.md) and copy the templates in `docs/sdlc/templates/`. Do not move a spec to `01-ready-to-implement/` (that starts a run) without human approval. Automated PRs are reviewed against [`REVIEW.md`](REVIEW.md).

# Agent de qualification des demandes de référencement

A Claude Agent SDK worker reads each new "Devenir partenaire" request, enriches it from the web, judges it against TheSpoon's criteria and prepares an email draft that the staff reviews before sending.

## Goal

Every `DemandeContactRestaurateur` gets an automatic, explained verdict (`ACCEPTEE`, `INFOS_MANQUANTES` or `REFUSEE`) and a ready-to-send email draft, visible in the staff page `/admin/contacts-restaurateurs`. A human always sends the email.

## Why

Requests arrive as free text (`nom`, `email`, `etablissement`, `adresse`, `message`) and are checked by hand today. Most of the checks (does it exist, is it in Paris, reputation, spoon dishes, real dining room) can be researched on the web and pre-filled.

## Criteria the agent judges

Each criterion gets `OK`, `KO` or `INCONNU` plus a one-sentence justification and its sources (URLs):

| Criterion | What the agent checks |
| --- | --- |
| `existence` | The establishment really exists (web presence, SIREN if found publicly). Spots fake requests. |
| `localisation` | The address is in a target zone. Phase 1: Paris only (postcodes 75001–75020, 75116), kept in one constant `ZONES_CIBLES`. |
| `reputation` | Google Business presence and rating, other reviews found on the web. |
| `menu` | The menu offers dishes eaten with a spoon (soups, risottos, stews, desserts…), from an online menu, PDF or photos. |
| `capacite` | A real dining room where clients can book a table, not takeaway only or a dark kitchen. |

Decision rule (in code, not left to the model): any `KO` on `localisation`, `menu` or `capacite`, or `existence` = `KO` → `REFUSEE`; otherwise any `INCONNU` → `INFOS_MANQUANTES`; otherwise → `ACCEPTEE`.

Email draft per verdict (French, polite, TheSpoon tone). The restaurateur receives one of three emails:
- `ACCEPTEE` → **acceptance**: welcome, and a link to step 2 on the website, where the restaurateur provides the onboarding material (menu, photos, seats, diets, PMR access, allergens). The link points to `ETAPE_2_URL` (a constant; the step 2 page itself is a separate spec).
- `REFUSEE` → **refusal**: polite, names the main reason, without showing internal notes.
- `INFOS_MANQUANTES` → **contact support**: explains what could not be checked (only the `INCONNU` criteria, for example the SIREN, the Google Business link, the menu) and invites the restaurateur to write to the support address `SUPPORT_EMAIL` (a constant, `support@thespoon.com`).

## Scope

- `prisma/schema.prisma` + a migration: request status and stored analysis.
- `src/app/api/admin/demandes/` and `src/lib/api-admin/`: list filter by status, and an endpoint to write the analysis.
- A new standalone worker `agents/qualification/` (TypeScript, `@anthropic-ai/claude-agent-sdk`), run with `pnpm agent:qualifier`. It talks to the app only through the admin API (`ADMIN_API_TOKEN`), not the database.
- `src/app/admin/contacts-restaurateurs/page.tsx`: show the verdict and the draft.

## Non-goals

- Sending emails automatically (no email provider is added; the staff sends from their mailbox).
- SIREN lookup through an official registry API and a "Google Business link" field in the form (later phase).
- Running the agent inside a Next.js request or on form submission.
- Scheduling (cron). The worker is run by hand or by an external scheduler.
- The step 2 page on the website (receiving and storing the menu, photos, seats, diets, PMR access and allergens): separate spec.

## Safety

- The request text is untrusted input. The agent gets **only** `WebSearch` and `WebFetch` tools (no Bash, no file write, no other MCP). Its output is parsed against a strict schema; anything else is rejected and the request stays `A_ANALYSER`.
- Nothing is sent to the restaurateur without a human.

## Acceptance criteria (whole spec)

- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
- A new request appears with status `A_ANALYSER`; after `pnpm agent:qualifier` it shows a verdict, the five criteria with justification and sources, and an email draft in `/admin/contacts-restaurateurs`.
- A non-Paris address always ends as `REFUSEE`.
- Each task below is a separate PR.

---
id: 001
title: Add request status and analysis storage to the admin API
status: pending
---

# Task

Give `DemandeContactRestaurateur` a lifecycle and a place to store the agent's analysis, and expose it through the admin API.

- `prisma/schema.prisma` + migration: enum `StatutDemande` (`A_ANALYSER`, `ACCEPTEE`, `INFOS_MANQUANTES`, `REFUSEE`, `MAIL_ENVOYE`), field `statut` (default `A_ANALYSER`, existing rows get it too), `analyse Json?` (the five criteria: verdict `OK|KO|INCONNU`, justification, sources), `brouillonObjet String?`, `brouillonCorps String?`, `analyseeLe DateTime?`.
- `src/lib/api-admin/`: put the decision rule from SPEC.md in a pure function (`deciderStatut(criteres)`), plus a zod schema for the analysis payload.
- `GET /api/admin/demandes?statut=A_ANALYSER` filters by status (no param: unchanged behaviour).
- New `PATCH /api/admin/demandes/[id]`: receives the criteria and the draft, validates them, computes `statut` with `deciderStatut` (the client cannot set it), sets `analyseeLe`. 404 for an unknown id, 400 for an invalid payload.

## Acceptance criteria

- Migration applies on an existing database; old requests are `A_ANALYSER`.
- Unit tests cover `deciderStatut` (all three verdicts, Paris `KO` → `REFUSEE`) and the PATCH validation, next to `src/lib/api-admin/demandes.test.ts`.
- The public form `/devenir-partenaire` still works unchanged.
- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.

## What to test

- `pnpm db:migrate`, then submit the form on `/devenir-partenaire`: the new row has `statut = A_ANALYSER` (Prisma Studio).
- `curl -H "Authorization: Bearer $ADMIN_API_TOKEN" "localhost:3100/api/admin/demandes?statut=A_ANALYSER"` returns only pending requests.
- PATCH with five `OK` criteria → `ACCEPTEE`; with `localisation: KO` → `REFUSEE`; with one `INCONNU` → `INFOS_MANQUANTES`.
- PATCH with a `statut` field in the body: it is ignored. Unknown id → 404.

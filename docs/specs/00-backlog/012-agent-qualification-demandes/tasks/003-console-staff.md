---
id: 003
title: Show the verdict and email draft in the staff page
status: pending
depends_on:
  - 001
---

# Task

In `src/app/admin/contacts-restaurateurs/page.tsx`, show for each request its status badge, the five criteria (verdict, justification, source links) and the email draft.

- The staff can edit the draft subject and body, then open it in their mail client (`mailto:` link with the restaurateur's email, subject and body prefilled) or copy it.
- A "Marquer comme envoyé" button sets the status to `MAIL_ENVOYE` (server action).
- A filter by status, default `A_ANALYSER` + `ACCEPTEE` + `INFOS_MANQUANTES` + `REFUSEE` (not yet emailed).
- Requests without analysis show "En attente d'analyse".

## Acceptance criteria

- The page renders requests with and without analysis without error.
- "Marquer comme envoyé" changes the status and the request leaves the default filter.
- Internal justifications are not copied into the email body.
- `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.

## What to test

- Open `/admin/contacts-restaurateurs` signed in as staff: analysed requests show the badge, criteria and draft; old ones show "En attente d'analyse".
- Edit the draft, click the mail link: the mail client opens with the edited text.
- Click "Marquer comme envoyé": the request disappears from the default view and appears under the `MAIL_ENVOYE` filter.
- Check on a narrow (phone) screen that the page stays readable.

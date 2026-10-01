---
id: 002
title: Consistent footer link underline offset
status: done
depends_on:
  - 001
---

# Task

In `src/components/SiteFooter.tsx`, add `underline-offset-4` to every link class string that contains `hover:underline` (the seven links in the three columns and the "Référencer mon restaurant" link), so the hover underline is spaced the same way everywhere.

## Acceptance criteria

- Every `className` in the footer that contains `hover:underline` also contains `underline-offset-4`.
- No other class, text or link changes, and no other file changes.
- `pnpm typecheck` and `pnpm lint` pass.

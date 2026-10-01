---
id: 001
title: Improve footer text contrast
status: done
---

# Task

In `src/components/SiteFooter.tsx`, replace the muted colour `text-[#8a7f85]` by `text-[#a89ea3]` on the three column headings (`Dîneurs`, `Restaurateurs`, `TheSpoon`) and on the copyright line.

## Acceptance criteria

- Exactly the four occurrences of `text-[#8a7f85]` in the footer are changed to `text-[#a89ea3]` (check with a search; no other occurrence of `#8a7f85` remains in this file).
- No other line of the file changes, and no other file changes.
- `pnpm typecheck` and `pnpm lint` pass.
- The contrast of `#a89ea3` on `#1a1418` is at least 4.5:1 (compute it and mention the ratio in the commit message).

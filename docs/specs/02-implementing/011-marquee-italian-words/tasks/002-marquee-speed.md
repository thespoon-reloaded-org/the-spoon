---
id: 002
title: Keep the marquee speed constant after the new words
status: pending
depends_on:
  - 001
---

# Task

Task 001 takes `MOTS_BANDEAU` from 26 to 32 entries. The ribbon animation is declared in `src/app/(site)/page.tsx` as `animate-[spoon-marquee_120s_linear_infinite]`, and `spoon-marquee` translates the strip by a fixed `-50%`. A longer strip travelled in the same 120 s means a faster ribbon — about 23 % faster, on an element that is already hard to read in motion.

Change the duration from `120s` to `150s` in that utility class so the ribbon keeps roughly the speed it had before the new words. Add a short comment next to it saying that the duration is tied to the number of entries in `MOTS_BANDEAU`, so the next person adding a word knows to revisit it.

## Acceptance criteria

- `src/app/(site)/page.tsx` contains `animate-[spoon-marquee_150s_linear_infinite]` and no longer contains `120s`.
- The `spoon-marquee` keyframes in `src/app/globals.css` are unchanged.
- No other line of `src/app/(site)/page.tsx` changes apart from that class and the comment, and no other file changes.
- `pnpm typecheck` and `pnpm lint` pass.

---
id: 001
title: Add Italian words to the home page marquee
status: pending
---

# Task

In `src/app/(site)/page.tsx`, add six entries to the `MOTS_BANDEAU` constant: three spoon dishes (`MINESTRONE`, `TIRAMISU`, `RIBOLLITA`) and three ways of naming an Italian restaurant (`TRATTORIA`, `SICILIEN`, `TOSCAN`).

They must be interleaved, not appended, so Italian comes back regularly during the loop, and the list must keep its dish / cuisine alternation — every odd entry is a dish, every even entry a cuisine or a kind of restaurant. The resulting array, in order:

```
VELOUTÉS, ITALIEN, RAMENS, LIBANAIS, MIJOTÉS, JAPONAIS, RISOTTOS, BISTROT,
MINESTRONE, TRATTORIA, CURRYS, THAÏ, POT-AU-FEU, BOUCHON LYONNAIS, DAHLS, CORÉEN,
TIRAMISU, SICILIEN, CHORBAS, VÉGÉ, BOUILLONS PHO, VIETNAMIEN, BLANQUETTES, INDIEN,
RIBOLLITA, TOSCAN, GASPACHOS, PORTUGAIS, TAJINES, GREC, POLENTAS, PÉRUVIEN
```

Update the doc comment above the constant so it also says that Italian is deliberately given several entries, the cuisine being one of the best represented among the partner restaurants.

Do not touch the animation class in this task — the loop getting faster is task 002.

## Acceptance criteria

- `MOTS_BANDEAU` contains exactly the 32 entries listed above, in that order, still `as const`.
- `ITALIEN` appears exactly once in the file; no entry is duplicated.
- The accents and capitals are those written above (`VELOUTÉS`, `THAÏ`, `VÉGÉ`, `CORÉEN`, `PÉRUVIEN`).
- No other line of `src/app/(site)/page.tsx` changes apart from the constant and its doc comment, and no other file changes.
- `pnpm typecheck` and `pnpm lint` pass.

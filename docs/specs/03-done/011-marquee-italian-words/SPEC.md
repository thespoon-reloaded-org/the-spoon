# Italian words in the home page marquee

Enrich the scrolling marquee of the public home page (`src/app/(site)/page.tsx`) with Italian terms, so Italian cuisine is as present in the ribbon as the other families already are.

## Goal

The marquee names Italian food in the same way it names ramen, tajines or pho: a few spoon dishes and a few ways of saying "Italian restaurant", spread across the loop — not a single `ITALIEN` passing once per turn.

## Why

- `MOTS_BANDEAU` already carries `ITALIEN`, `RISOTTOS` and `POLENTAS`, but they sit in the first third of a 26-word loop. On a wide screen the ribbon moves for roughly a minute and a half before Italian comes back around, while Asian and North African cuisines each get several entries spread over the list.
- Italian is one of the best-represented cuisines among the partner restaurants (it is in both `scripts/seed-dev.ts` and `scripts/jeu-formation/donnees.ts`), and it has its own fallback photo (`/images/cuisine-italien.jpg`). The ribbon under-represents what the catalogue actually offers.
- The marquee is a brand element, not a catalogue: the fix is to add well-chosen words, not to wire it to the database.

## Scope

- `src/app/(site)/page.tsx`: the `MOTS_BANDEAU` constant and the marquee's `animation` utility class.

## Non-goals

- No change to the cuisine filter pills, which stay driven by `prisma.restaurant.findMany({ distinct: ["cuisine"] })`.
- No new seed data, no database change, no new image in `public/images/`.
- No change to the `spoon-marquee` keyframes in `src/app/globals.css`, to the markup of the ribbon, or to its colours and rotation.
- `ITALIEN` is not duplicated: it is already in the list and stays exactly once.

## Acceptance criteria (whole spec)

- `pnpm typecheck` and `pnpm lint` pass.
- `MOTS_BANDEAU` holds 32 entries, with no duplicate, and keeps its dish / cuisine alternation (odd position = a dish, even position = a cuisine or a kind of restaurant).
- The ribbon scrolls at the same perceived speed as before the change.
- The two tasks below are each a separate PR.

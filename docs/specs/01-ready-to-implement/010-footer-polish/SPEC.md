# Footer polish

Small cosmetic fix to the public site footer (`src/components/SiteFooter.tsx`). It is also the first end-to-end test of the SDLC control plane on a tiny change, so keep it minimal.

## Goal

Make the footer's small grey text easier to read and make its links look consistent.

## Why

- The three column headings and the copyright line use `#8a7f85` on the dark footer background (`--color-ink`, `#1a1418`). At 11 px and 14 px that is below the WCAG AA contrast ratio of 4.5:1 for normal text.
- The footer links underline on hover, but the underline sits tight against the text and differs from the "Référencer mon restaurant" link.

## Scope

- Only `src/components/SiteFooter.tsx`.
- Class names only: no markup, text, link or behaviour changes.

## Non-goals

- No new components, no new colours in `globals.css`, no layout changes.
- No changes to other pages, tests configuration or dependencies.

## Acceptance criteria (whole spec)

- `pnpm typecheck` and `pnpm lint` pass.
- The rendered text and links of the footer are identical to before.
- The two tasks below are each a separate PR.

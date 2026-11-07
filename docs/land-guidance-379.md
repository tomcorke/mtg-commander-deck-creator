# Land guidance before/after (#379)

The user reported that 35 lands felt short for a Rabbit deck on Upgraded with average mana value 3.1. The exact deck was not supplied, so the cases below are synthetic 64-spell decks retained as tests in `src/deck-analysis.test.ts`. Before is the previous formula on `main` at `7ca7e29`; after is `estimateLandGuidance`.

| Case                                                 | Before | After |
| ---------------------------------------------------- | ------ | ----- |
| Rabbit/Upgraded (3.1 avg, 22% at 5+, 6 ramp, 6 draw) | 35–37  | 37–39 |
| Low-curve aggro (2.1 avg, 14 ramp, 12 draw)          | 31–33  | 31–33 |
| Flat midrange (3.1 avg, 10 ramp, 10 draw)            | 34–36  | 33–35 |
| Partial deck, 10 spells at 3, no ramp                | 37–39  | 32–38 |

## What changed

- The same average now gives different ranges for a top-heavy curve and a flat one, and light draw adds lands.
- A partial deck no longer reads its few role cards as a full deck's counts. Before, ten spells with no ramp asked for 38 lands. The range is now wider while the deck is small.
- Previously the builder showed the range only when the land target sat outside it, so a user at 35 saw no guidance. It now always shows the range. Its expandable details list each adjustment and what the heuristic ignores.

## Measured or estimated

Everything above is a heuristic estimate. No play data or simulation was used to calibrate the coefficients. Only the outputs in the table are measured, and they come from synthetic decks. They are not land-drop rates. The builder's land-drop simulation (`src/deck-simulation.ts`) is unchanged and remains the measured view of a specific list.

## Not covered

- The original deck, offer history and Sol Ring path need a live EDHREC recording, blocked on #309.
- Calibration against real decks belongs to #98's evaluation infrastructure.

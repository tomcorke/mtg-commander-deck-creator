# Land guidance before/after (#379)

The user reported that 35 lands felt short for a Rabbit deck on Upgraded with average mana value 3.1. The exact deck was not supplied, so the cases below are synthetic 64-spell decks retained as tests in `src/deck-analysis.test.ts`. Before is the previous formula on `main` at `7ca7e29`; after is `estimateLandGuidance` from #382. The last column is the same formula after #587 raised the baseline to 38 and the limits to a 34–42 centre and 32–44 range.

| Case                                                 | Before | After (#382) | Baseline 38 (#587) |
| ---------------------------------------------------- | ------ | ------------ | ------------------ |
| Rabbit/Upgraded (3.1 avg, 22% at 5+, 6 ramp, 6 draw) | 35–37  | 37–39        | 40–42              |
| Low-curve aggro (2.1 avg, 14 ramp, 12 draw)          | 31–33  | 31–33        | 33–35              |
| Flat midrange (3.1 avg, 10 ramp, 10 draw)            | 34–36  | 33–35        | 36–38              |
| Partial deck, 10 spells at 3, no ramp                | 37–39  | 32–38        | 36–42              |

The #382 column predates #576, which scaled a partial deck's curve adjustments; the #587 column includes it.

## What changed

- The same average now gives different ranges for a top-heavy curve and a flat one, and light draw adds lands.
- A partial deck no longer reads its few role cards as a full deck's counts. Before, ten spells with no ramp asked for 38 lands. The range is now wider while the deck is small.
- Previously the builder showed the range only when the land target sat outside it, so a user at 35 saw no guidance. It now always shows the range. Its expandable details list each adjustment and what the heuristic ignores.

## Baseline 38 (#587)

The baseline moved from 35 to 38, and new decks start with a 38-land target. Saved decks keep their stored target; the range and **Use N** suggest the new count. The coefficients did not change, so each case moves up by 3 lands before clamping. The low-curve case would centre on 33 and is held at the new 34 floor, giving 33–35. The 38 comes from Karsten's 2022 Commander formula at average mana value 3 with about 10 cheap draw/ramp spells. EDHREC's 2022 decklist median is 36. Both are heuristics, and the formula's `c` uses Karsten's classifier, not this app's roles; see [heuristics](domain/heuristics.md) for the sources and limits.

## Measured or estimated

Everything above is a heuristic estimate. No play data or simulation was used to calibrate the coefficients. Only the outputs in the table are measured, and they come from synthetic decks. They are not land-drop rates. The builder's land-drop simulation (`src/deck-simulation.ts`) is unchanged and remains the measured view of a specific list.

## Not covered

- The original deck and offer history were never supplied. [functional-support-379.md](functional-support-379.md) records a pinned stand-in case and the Sol Ring path.
- Calibration against real decks belongs to #98's evaluation infrastructure. That includes the 38 baseline, the 34–42 and 32–44 limits, and the average-MV slope (2 here, about 3.13 in Karsten's formula).

# Recommendation and deck guidance design

## Goal

Make recommendations feel specific to the chosen commander, declared theme, selected cards, and emerging deck direction. Generic staples should support the deck rather than dominate each batch.

## Data sources

- EDHREC commander JSON is the primary recommendation source. Fetch current data each session and rely on its CDN cache headers.
- Scryfall supplies card rules, legality, images, printings, mana values, and fallback recommendations.
- Keep the app client-only. If EDHREC is unavailable or its undocumented JSON shape changes, fall back to Scryfall and show `Limited recommendations`.
- Persist user state, not remote recommendation data.

## Ranking

Use these weights as guidance, not fixed batch quotas:

- Declared theme: 40%
- Confirmed inferred sub-themes: 30%
- Commander synergy: 20%
- Deck needs: 10%

Each four-card batch should:

- Include no more than one generic infrastructure card unless deck health shows an urgent gap.
- Prefer cards matching the declared theme or active sub-themes.
- Sometimes include a supported two-card synergy plus two standalone choices.
- Reserve one slot for a lower-popularity, theme-relevant `Interesting pick` when confidence is high.
- Keep each card independently selectable.

A synergy pair gets a shared visual marker and one concrete explanation naming the interaction. Selecting either card increases the other's later rank.

## Preference signals

- `Add` strengthens tags and mechanics shared by selected cards.
- `More like this` is a stronger signal than `Add` and boosts the card's tags, mechanics, and EDHREC theme associations in the next batch.
- `Later` is neutral. The card may return after at least three batches.
- `Ignore` prevents that card returning and gradually reduces related theme weights. It does not ban a theme after one rejection.
- Undecided cards wait at least two batches before returning.
- Accepted and ignored cards never return.

Choices remain visible until `Next recommendations` is clicked. Ranking changes apply to the next batch.

## Sub-themes

After two related selections, offer a non-blocking prompt above `Next recommendations`, such as `Lean into +1/+1 counters?`.

- Clicking the prompt activates the sub-theme and advances the batch.
- Dismissal continues without changing ranking.
- Show declared theme and active sub-themes as removable chips.
- Support at most two active sub-themes.
- `Choose sub-theme` opens searchable choices from EDHREC commander themes, followed by tags inferred from selected cards.
- Commander stays fixed when themes change.

## Recommendation explanations

Show one primary reason on each card. Optional details can explain:

- Commander synergy
- Declared or active sub-theme match
- Deck-gap contribution
- Pair interaction

Avoid labels that only say a card is popular.

## Deck analysis

Always show:

- Mana-value curve split into permanents and non-permanents
- Coloured mana symbols required
- Actual mana production by colour from selected sources
- Editable targets for lands, ramp, card draw, targeted removal, and board wipes

Clicking a mana-value bar highlights matching cards in the deck list. Clicking it again clears the highlight. On narrow screens, charts remain available in a horizontally scrollable layout.

### Defaults

- Lands: 35
- Ramp: 10
- Card draw: 10
- Targeted removal: 8
- Board wipes: 3

Show a calculated land range based on average mana value and selected ramp, but keep the user's target authoritative. Do not infer mana production from commander colour identity.

Before 70 cards, show analysis without warnings. At 70 cards, show quiet gap guidance. At 85 cards, strengthen warnings for targets the remaining slots cannot comfortably satisfy.

## Deck lifecycle

- Persist commander or partner pair, deck, filters, targets, active sub-themes, ignored cards, and recommendation history in `localStorage`.
- Parse stored data through Zod before use. Stored envelope includes a numeric version.
- Keep schema changes forwards compatible where practical: add optional fields with defaults, preserve unknown future fields when migrating, and add explicit migrations before changing or removing existing fields. Never treat unvalidated storage as app state.
- `Start over` requires confirmation.
- Removing a selected card is neutral and differs from `Ignore`.
- A partner deck remains 100 cards total, leaving 98 library slots.
- At 100 main-deck cards, stop recommendations and make deck review the primary action. Removing a card resumes recommendations.

### Planned lifecycle stages

- Stage 4.1: save, name, load, and delete multiple in-progress or complete decks.
- Stage 4.1.5: allow cards beyond the 100-card main deck in a separate sideboard.
- Stage 4.2: import deck lists, including Moxfield set and collector-number syntax, plus Moxfield and Archidekt URLs.

## Accessibility

- Pair links and chart highlights use text or icons as well as colour.
- All controls support keyboard focus.
- Recommendation updates are announced to assistive technology.

## Delivery

1. EDHREC recommendations and varied batches
2. Sub-theme detection, manual sub-themes, and synergy pairs
3. Deck analysis, editable targets, and late-build warnings
4. Persistence and deck-completion flow
5. Stage 4.1: multiple saved decks
6. Stage 4.1.5: sideboard support beyond 100 cards
7. Stage 4.2: deck-list, Moxfield URL, and Archidekt URL import

Validate and publish each stage before starting the next.

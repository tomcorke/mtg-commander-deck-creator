# B3: Deck Doctor

## Goal

Add an optional diagnostic flow from Deck review. Deck Doctor explains possible weak spots and offers player-approved swaps. It never changes the deck without an explicit action.

## Player flow

1. Open Deck Doctor directly from the builder or from Deck review. Use a full-page mode for diagnosis and change selection, with clear navigation back to the builder.
2. Allow the flow at any main-deck size. Always show the current count. Show card-level theme clues at any size; follow existing deck-guidance thresholds for deck-wide gaps: no role-gap warnings before 70 cards, quiet guidance from 70, stronger warnings from 85.
3. Offer optional commander exploration for each run, off by default. The current commander remains support evidence and is not a normal cut candidate.
4. Group repeated concerns and replacement candidates. Let the player select flagged cards and replacements from separate image grids, then show the proposed changes side by side before approval. Require equal cut/add counts so the deck size stays constant.
5. Let the player choose whether to move cut cards to the sideboard. Default this option to off; retain the player's choice for later changes in the same run.
6. Show a post-change history with individual undo. Keep history in memory for the current app session, not saved-deck storage. Clear it on reload, deck switch, or an external deck edit that makes an undo unsafe.

## Diagnostic rules

Use the current declared theme and selected sub-themes as theme intent. Do not infer intent from incidental tags in the deck. Reuse `tagsFor`, `deckTagCoverage`, `rolesForCard`, `analyseDeck`, `findSynergyPair`, `deckTargets`, and the current mana fields before adding classifiers.

- A card is a possible weak connection only when it has no tag matching the declared theme or selected sub-themes, no detected deck role, and no known synergy. Exclude commanders from cut suggestions. State that a missing tag is not proof that a card lacks value.
- Count theme support in the main deck, excluding commanders and sideboard. Zero matches means no supported tag was detected; one match is a single point of support. Both are prompts, not automatic cut decisions.
- When theme support is zero or one, allow additional swaps that improve the declared theme's tag coverage. Do not cut a card that is the only source of a role the deck is still short on.
- Compare costs, coloured pips, curve, land sources, and ramp counts. Describe source counts as signals, not draw odds. Render full costs and colour gaps with mana icons, including generic symbols; omit brace notation, duplicate colour names beside icons, separate colour-identity icons beside a full cost, and derived `MV` totals.
- Keep rules-defined mana value separate from estimated casting effort. For `{2/color}` hybrid symbols, estimate one less generic mana per matching colour source, capped at the number of symbols. Treat source counts as a heuristic, not draw odds.
- Use the player's editable role targets. Never infer that a card is bad from one tag or one low count alone.

## Swap candidates

Use the existing recommendation queue first. If it has too few legal candidates, fetch targeted Scryfall and EDHREC candidates on demand. Merge and deduplicate by card name. Respect Commander legality, colour identity, current deck and sideboard contents, collection mode, and recommendation exclusions. Recheck legality and duplicates when applying a plan because the deck may have changed since the findings were computed.

Show one shared replacement pool rather than repeating the same candidates under each finding. Sort candidates by current recommendation score and show stars and qualitative fit labels instead of raw scores. Page through three candidates at a time without losing selections. Let players select the same number of cut cards and additions. Keep the approval control fixed at the viewport bottom while the plan is balanced. Show both card images for every proposed pair, label the in-deck card, and apply the full plan atomically only after approval. Optional sideboard retention moves each cut card there instead of removing it.

Commander exploration is separate from ordinary card swaps. Search only when the player opts in. Suggest only Commander-legal commanders whose colour identity keeps every current non-commander main-deck and sideboard card legal; show any colour changes and reasons. These are comparisons only: B3 never changes the active commander or deck from this section. Defer alternative suggestions for partner pairs; other Deck Doctor findings still work for those decks.

## Simulation work

Attempt a small, dependency-free simulation of opening hands, draws, and one land drop per turn for the first ten turns. Exclude the commander and sideboard. For simple mana costs, estimate whether the lands played could pay for one drawn spell in isolation; this is not a simulated play line. Ignore ramp, tapped-land timing, mulligans, Oracle text, opponents, and competing spells. Skip unsupported mana costs. Do not report win probability.

Use a deterministic random source in tests and evaluate the simulation against small known decks, including healthy, land-light, and colour-inconsistent examples. Check that results agree with expected land-draw behavior and add useful guidance beyond static counts. Surface results only as an explicitly qualified land-only castability estimate if evaluation supports them; otherwise remove the runtime result and record the no-go.

## Implementation plan

1. Add pure diagnostic rules and tests for theme matches, single-point support, role gaps, mana outliers, and valid exceptions.
2. Add the bounded simulation and test its output against fixed-seed deck examples. Compare it with the existing static findings before exposing it.
3. Add candidate enrichment using the current queue first, then on-demand Scryfall and EDHREC results with existing settings and legality checks.
4. Add atomic batch swaps, session-only history, sideboard retention, and individual undo. Invalidate history rather than overwrite unrelated deck edits.
5. Add a full-page Doctor mode with direct builder and review entry points; inspect it in light/dark modes and narrow layouts.

## Acceptance checks

- The full-page flow opens directly from the builder and from Deck review for partial and complete main decks. Theme clues appear at any size; role-gap severity follows the 70/85 thresholds. Sideboard cards do not count toward findings.
- Findings use explicit theme selections, cite card-level evidence, name heuristic uncertainty, and treat a single tagged card as a prompt rather than a cut decision.
- A theme with zero or one tagged card can receive swaps that increase supported theme coverage without removing the only needed card for a deficient role.
- Static mana findings treat source counts as signals, not draw odds. Hybrid alternatives affect only the outlier estimate; rules-defined mana value remains unchanged. Findings display complete mana-cost icons rather than identity-only icons; no separate identity row or derived `MV` total appears beside a full cost. Any simulated castability estimate states its land-only assumptions and appears only if fixed-seed known-deck tests show value beyond static analysis.
- Findings and replacements appear once in visual card grids. Show complete mana-cost icons instead of separate colour-identity icons. Candidate pages sort strongest-first, show qualitative ratings without raw scores, and retain selections across pages. Card names preview art on hover/focus and open details on activation. Small card images enlarge when hovered or focused directly. Comparisons show both card images and mark the card currently in the deck.
- Players can select equal numbers of cards to cut and add, inspect every image pair, and apply the plan explicitly. Batch validation is atomic; cut cards can optionally move to sideboard.
- Optional commander exploration is off by default, preserves the legality of every existing card, and never changes deck state. Partner-pair decks retain their existing commander and still get other findings.
- The post-run history lists all applied swaps and can undo any safe swap in the current session. Unsafe undo is rejected without overwriting later deck edits.
- Tests, lint, typecheck, production build, and browser smoke checks pass. The manual check covers the Doctor entry, candidate sources, commander comparison opt-in, swaps, sideboard choice, history/undo, light/dark themes, and mobile layout.

## Approved test seams

- Public diagnostic and simulation functions, exercised with fixed-seed card/deck examples.
- Public atomic plan and individual undo functions, exercised through deck and sideboard state transitions.
- Scryfall and EDHREC adapters, mocked only at their fetch boundary.
- Browser smoke across direct and review entry, card preview/details, batch selection and undo, and responsive/theme states.

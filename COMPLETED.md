# Completed work

Closed goals moved from [TODO.md](TODO.md). IDs remain reserved and are not reused.

## [B13] Correct deck-analysis and simulation mana semantics

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — The fixes are local to analysis, simulation, and card conversion, and the rules are verified.

**Status:** Complete — merged in `e70fee2`; not yet released.

### Completed behavior

Simulation draws on turn one (CR 103.8c). Transforming cards with a land back face no longer count as land drops from hand, and spell/land MDFCs count as optional land drops rather than both a land and a spell. Imported and manually added DFCs keep their face mana costs. Mana symbols come from Scryfall `/symbology` `svg_uri` (so `{W/U/P}` renders correctly), `{H}` is treated as generic Phyrexian and `{P}` as the pawprint, `{C/W}`-style hybrids are recognised, and colour guidance shows `{C}` and `{S}`. Only DFC layouts get back images; split, Adventure, and flip cards no longer trigger repeated back-image repair fetches.

Implemented by Pi (gpt-6-luna); Opus browser review with fixes (dark-mode `{H}` visibility, mana summary wording).

### Acceptance checks

- Tests cover the turn-one draw, Westvale Abbey, a spell/land MDFC, an imported DFC's cost, `{W/U/P}` and `{C/W}` rendering, and a split card without a repair fetch.
- Chrome review: Phyrexian hybrid and `{H}` in light and dark, `{C}`/`{S}` rows, unchanged costs and Oracle text, 390px, and an Adventure card with no back-image fetch. Not checked in the browser: a real `{C/W}` cost, a nonzero `{S}` cost, split cards.
- Known trade-off: until the symbology request completes (or if it fails), mana symbols render as text; card images also depend on Scryfall.
- All 220 tests, lint, typecheck, and production build pass.

## [B14] Keep deck-review drafts across navigation and settings changes

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Draft choices already survive in-review step changes; the gaps are browser history and settings refreshes.

**Status:** Complete — merged in `6580817`; not yet released.

### Completed behavior

Leaving Deck review with pending choices (browser Back, a typed or changed hash, or the explicit Back to builder) shows one in-app prompt: Keep choices or Discard and leave. Keep restores the review route and choices; Escape and the shared close button keep choices. Changing a recommendation setting from review keeps picked additions that still pass and names the ones removed.

Implemented by Pi (gpt-6-luna); Opus browser review with fixes (typed hash exits now prompt instead of stalling routing, dark-mode prompt contrast, shared close button).

### Acceptance checks

- Tests cover draft retention through settings changes and the explicit-exit prompt; the hash-exit fix lives in a browser event handler and has no unit test.
- Chrome review: Back Keep/Discard, settings change keeps the allowed pick and names the removed one, hash edits, Back to builder, light, dark, 390px (iframe), Tab wrap, Escape. Not verified: focus returning to the review heading after dismissing the prompt.
- All 212 tests, lint, typecheck, and production build pass.

## [A11] Richer recommendation tuning

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Medium — Mapping reasons to scoring changes needs validation so feedback visibly improves later batches.

**Status:** Complete — merged in `8e1546c`; not yet released.

### Completed behavior

Recommendation settings use one Priority control (Theme first, Balanced, Deck needs first, Surprise me) beside an independent Power control; stored legacy goals and the deck-health flag map to the new options. A "How recommendations work" disclosure replaces the opening caveat. An optional maximum price per card hides pricier cards (cards without a price are kept) and appears in the settings summary. Ignore stays one click and then offers optional inline reasons (Not my style, Too expensive, Off-theme, Have something similar) that feed preference scoring; "Too expensive" offers a one-click "Hide cards over $N". Below-target rows in Deck targets focus batches on that role, shown as a removable chip; focus clears automatically at target. With a role focused, each Next advances exactly one batch and says when the role has no more suggestions; without focus, an exhausted pool still jumps ahead to returning Later cards. Keyboard focus moves to a sensible place when the price offer or focus chip disappears.

Implemented by Pi (gpt-6.1-sol, follow-ups on gpt-6-luna); Opus browser review and re-review with small fixes.

### Acceptance checks

- Tests cover Priority mapping, price capping, ignore reasons, role focus, one-batch advancement with focus, and the unfocused fast-forward.
- Opus Chrome review in light, dark, and 390px (iframe), then a focused re-review of focus handling, batch counting, and the focused empty state. Not checked in the browser: the missing-price fallback, disabled controls during loading, and the unfocused fast-forward (unit tests only).
- All 209 tests, lint, typecheck, and production build pass.

## [B9] Make deck review one clear workflow

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Reorganises existing sections without new analysis.

**Status:** Complete — merged in `828b440`; not yet released.

### Completed behavior

The builder has one Deck review entry point. Review runs as three route-backed steps (Diagnose, Choose changes, Confirm) with a fixed summary of pending cuts and additions; drafts survive step navigation and nested dialogs, Escape goes back one step, and an explicit exit asks before discarding drafts. Change history opens in its own dialog. One "How review works" disclosure replaces the caveat paragraphs, sidebar labels use plain language, and "Compare commanders" sits beside "Change commander". Changing settings from review refreshes candidates without leaving the page.

Implemented by Pi (gpt-6.1-sol) from a partial Claude start; reviewed by Opus from code and screenshots, then interactively in Chrome with small fixes (single Back control, compact primary button, Escape after Undo in history, singular count labels).

### Acceptance checks

- Tests cover review routing, draft retention, settings refresh navigation, and history focus.
- Chrome review: Diagnose → Choose changes → Confirm → apply and undo on partial and 100-card decks; over-100 trim; light, dark, and narrow; settings from review. A Playwright script (`scripts/check-deck-review.ts`) covers the discard prompt and browser Back. Follow-up: browser Back discards drafts without warning (B14).
- All 193 tests, lint, typecheck, and production build pass.

## [A12] Defer basic-land fill

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — The fill action exists; this changes when and how it is offered.

**Status:** Complete — merged in `9c2030f`; not yet released.

### Completed behavior

Early in a build, the Deck targets sidebar keeps land progress visible but replaces the primary fill button with "Fill lands once most spells are in." and a small "Fill now" action. Once the deck nears its non-land total, a primary "Fill to land target" button appears. Its "Choose lands" dialog lists recommended nonbasic lands for the commander's colours first, then fills the remaining slots with basics split by current pip demand. Adding a nonbasic recalculates the remaining room, the basic split, and the button label, brings in a new suggestion, and moves focus to the next Add button. The dialog traps Tab, closes on Escape, and returns focus to its trigger.

Implemented by Pi (gpt-6.1-sol); reviewed and fixed by Opus in the browser.

### Acceptance checks

- Tests in `src/deck-analysis.test.ts`, `src/app/useBuilderData.test.ts`, and `src/app/deck-actions.test.ts` cover the promotion threshold, nonbasic suggestions, and the basic split.
- Opus browser review: early-deck deferral, promotion at 59 non-land cards with nonbasics before basics, the add/recalculate/focus flow, Tab trap, Escape and focus return, hover previews, light and dark, and 390px (iframe). Not checked: opening card details from a dialog thumbnail by keyboard, and the dialog with commander theming off.
- All 185 tests, lint, typecheck, and production build pass.

## [A10] Make set selection clear and stable

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Scryfall set data already provides the fields needed for filtering and icons.

**Status:** Complete — merged in `e057554`; not yet released.

### Completed behavior

Recommendation settings has a "Sets to build from" picker. Digital, token, memorabilia, and promo sets are hidden behind a "Show promos and digital sets" toggle; each main set's Commander product is a checkbox on the same row. Rows show the set icon, name, release year, and a checkbox, and stay in place when selected (the dialog now anchors to the top so it grows downward). An empty search lists recent main releases. A single Scryfall request counts legal cards for the selection while the dialog is open, with a warning in Only mode below 150 cards. Selected sets appear as removable chips in the builder. The mode menu reads "Prefer these sets" / "Only these sets", the summary says "All sets" instead of "Collection off", the printing-details button reads "Prefer this set" / "Stop preferring this set", and leftover "collection" labels use set wording.

Implementation: `src/domain/set-picker.ts`, `src/features/modals/RecommendationSettingsModal.tsx`, `src/shared/CardDetails.tsx`, the count effect in `src/app/useAppEffects.ts`, and the builder chips in `BuilderView.tsx`.

### Acceptance checks

- `src/domain/set-picker.test.ts` covers set filtering, Commander grouping, and ordering.
- Browser checks: searching "dusk" shows only Duskmourn: House of Horror with its Commander option unless the toggle is on; row positions are unchanged after selecting; Only mode with a small selection shows the count and warning; light, dark, and 390px render correctly. A recheck after A8 and B8 found no regressions. Not rendered: the dialog in dark at 390px, the set-browser heading, and the Only-mode error text.
- All 180 tests, lint, typecheck, and production build pass.

## [A7] Keep recommendation progress when settings change

**Complexity:** Low · **Value:** High · **Delivery risk:** Low — The queue already supports re-ranking; the fix is mostly wiring and tests.

**Status:** Complete — merged in `59d8bc0`; not yet released.

### Completed behavior

Changing recommendation settings no longer restarts the recommendation cycle. When the settings dialog closes (or a sub-theme is chosen), the visible batch's Later, like, and Add decisions are recorded first; deferred cards, the batch number, ignored cards, and preference scores carry over. Ranking-only changes re-rank the existing pool without spending undecided cards or advancing waiting periods. Changes to the candidate pool (commander, power and exclusions, theme and sub-themes, set selection and collection mode, including Prefer) re-fetch, then apply the same progress. The builder's pending-changes notice is gone; the dialog says changes apply when it closes.

Implementation: `refreshRecommendationSettings` and `nextBatch` in `src/features/builder/interactions.ts`; `recommendationPoolKey` and progress-preserving `start` in `src/app/recommendation-actions.ts`; the close-triggered refresh in `src/app/useAppActions.ts`.

### Acceptance checks

- `src/features/builder/interactions.test.ts` covers ranking-only and pool-changing paths, Later deferral across a settings change, recorded likes and adds, and ignores and deferrals applied to a re-fetched pool.
- Browser checks with mocked providers in light, dark, and narrow layouts; the live-provider flow was not checked.
- All 175 tests, lint, typecheck, and production build pass.

## [A13] Investigate collection import

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** High — Export formats vary, and name and printing matching may be unreliable without a server.

**Status:** Investigation complete — no-go; merged in `3c6ade3`. Keep set-based selection.

### Findings

Parsing CSV exports client-side is feasible, and matching names with the existing `cardNameKey` normalization resolved 107 of 108 names (99.07%) on the Anikthea deck used as a collection proxy (104/108 without normalization; 108/108 by printing identifier). No native collection export was obtained from Moxfield, Archidekt, ManaBox, or Deckbox, so the gate that every major format parses without losing records is unproven. Imported ownership would also need card-level identities rather than the current set-based candidate search in `collectionRecommendations`.

Report: [docs/a13-collection-import-investigation.md](docs/a13-collection-import-investigation.md).

### Reconsider when

Anonymized, untouched exports from all four tools are available (both ManaBox variants, and an Archidekt export with optional fields changed). Approve implementation only if every native format parses without losing records, the sample reaches at least 98% by name, and misses are visible to the player.

## [A8] Explain recommendations in plain language

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Uses existing score and evidence data; the work is wording and placement.

**Status:** Complete — merged in `6347a22`; not yet released.

### Completed behavior

Each recommendation shows a short label and one plain-language sentence under the card name, built from existing evidence: the share of EDHREC decks where known, the deck role it fills, theme matches, and "Played with <card>, which is in your deck" for signature-card results. The heart button reads "More like this". Large card images and four-card batches are unchanged. The action row wraps at the 521–800px layout so the label never overlaps the image.

Implementation: `explainRecommendation` and `recommendationReason` in `src/features/builder/BuilderView.tsx`, with evidence fields in `src/domain/recommendation-sources.ts` and `src/domain/recommendation-types.ts`.

### Acceptance checks

- Browser checks before the final rebase: light and dark at desktop width, plus 760px and 380px in iframes; nothing overflows. The "Played with <card>" sentence is type-checked but was not seen in the browser.
- All 169 tests, lint, typecheck, and production build pass.

## [B8] Fit deck review to the deck's state

**Complexity:** Medium · **Value:** High · **Delivery risk:** Low — Existing analysis and candidate data are sufficient; changes are presentation and swap rules.

**Status:** Complete — merged in `71ff6c9`; not yet released.

### Completed behavior

Deck review adapts to deck size: below 90 main-deck cards it leads with "Add N more cards" and role-gap buttons, with cuts optional in a collapsed section; 90–100 cards shows the full review; above 100 it asks the player to cut down to 100. Cuts and additions no longer need to match: paired cuts and additions become swaps, extra cuts are removed, and extra additions are appended, each with its own undoable history entry. The plan shows the resulting deck size before applying. Duplicate cards are grouped into one tile with a count and a cut quantity. Flagged cards come first; the rest of the deck appears after choosing a type, role, or All. Replacements show 12 per page, filterable by role gap or the selected theme. The sidebar's 0–7+ curve is now the shared `src/features/builder/ManaCurve.tsx`, and colour rows show only the commander's colours.

Implementation: `deckReviewMode`, `groupDeckCards`, and unequal plans in `applyDeckDoctorSwapPlan`/`undoDeckDoctorSwap` in `src/deck-doctor.ts`; `src/features/builder/DeckDoctorView.tsx`.

### Acceptance checks

- `src/deck-doctor.test.ts` covers mode thresholds, grouping 9 Swamps and 26 Forests into two tiles, cutting three Forests, add-only plans, and undoing mixed plans.
- Browser checks (dark and light, desktop) with a Meren deck: 38 cards shows add-only gap filling and only black and green colour rows; basics appear as two grouped tiles; add-only and uneven plans apply and undo correctly; 105 cards asks for five cuts. Narrow viewports were not checked.
- All 168 tests, lint, typecheck, and production build pass.

## [B7] Show API request activity

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Both providers share a request scheduler; deferred retries are reported separately.

**Status:** Complete — released with implementation `6a3a731`.

### Completed behavior

A small network icon with a queued-count badge appears at the right of the start and builder headers. Hover or keyboard focus opens its details; click pins them open. Escape or an outside click dismisses the native popover. Text and accessible labels accompany idle, active, and waiting colours. The same component supports light/dark themes and narrow layouts.

The scheduler exposes per-client snapshots of active and queued EDHREC/Scryfall operations. Active slots include response-body transfer. Shared calls count once; cache hits and card-image downloads do not count. Provider cooldowns and the next active enrichment retry/allowance check appear separately from the queue. Cancelled contexts remove their retry waits; an expiry timer updates waiting status without polling providers or retaining request history. Existing pacing, concurrency, foreground priority, caches, and budgets are unchanged.

Implementation: `src/shared/RequestActivityIndicator.tsx`, `src/styles/request-activity.css`, `src/adapters/request-scheduler.ts`, and `watchSignatureResults()` in `src/app/signature-actions.ts`.

### Acceptance checks

- `src/adapters/request-activity.test.ts` covers coalescing, cache hits, queued cancellation, slow response bodies, rejected operations, client/provider isolation, observer cleanup, cooldowns, and independent retry watchers.
- Chromium checks with mocked providers verify live badge/table counts, hover/focus/click, Escape/outside dismissal, cooldown expiry, retry cancellation, text wrapping, and viewport bounds. Light/dark builder layouts were inspected at 390px and 1536px; the start header was also checked. Screenshots and harnesses remain outside Git.
- The existing rendered recommendation checks still pass: late append and later batches, stable choices/deferrals, saved-deck switching, silent 403 failures, full-deck suspension, and card-reference previews/details.
- All 162 tests, lint, application and standalone test typechecks, production build, and diff checks pass. Existing nonblocking React and bundle-size warnings remain. No dependency or downloaded card art was added.

## [A5] Cache Scryfall data and deduplicate requests

**Complexity:** Medium · **Value:** High · **Delivery risk:** Medium — The shared adapter is a natural reuse point; cache freshness, printing identity, and cancellation need care.

**Status:** Complete.

### Completed behavior

The shared adapter caches successful raw cards and fully paginated printing lists for 15 minutes, with a 2,000-entry session limit. Named and bulk lookups share pending records; printing-specific lookups remain distinct. Only missing identifiers are batched. Import and detail hydration use the same cache, and basic-land prefetch no longer owns a separate indefinite cache.

EDHREC refreshes skip selected and ignored names before hydration. Current legality, exclusions, collection constraints, and goal scoring still apply. Returned data is copied; commander art/finish choices and manual printing selections remain intact. Individual cancellation does not abort another consumer; the last cancellation aborts shared work. Failed and missing records can be retried.

Expired records are fetched on their next lookup. `clearScryfallCache()` explicitly invalidates data without clearing the 429 cooldown; old pending responses cannot repopulate the new cache. Normal recommendation refresh reuses warm data.

### Acceptance checks

- Warm refreshes reuse card/printing data; overlapping lookups fetch each missing record only once. Request-count checks cover named/bulk overlap, missing-only batches, and detail reuse.
- Failures, cancellation, expiry, and explicit refresh recover without corrupting another caller's result or selected printings.
- Tests verify current legality, exclusions, collection constraints, and goal scores on warm data, plus selected commander art and foil details.
- All 132 tests, lint, typecheck, and production build pass. Browser checks cover light/dark desktop/narrow review, details/settings return, swaps/undo, candidate refresh, overview navigation, and legacy routes. Existing hook and bundle-size warnings remain.

Cache policy: [docs/recommendation-design.md](docs/recommendation-design.md#scryfall-session-cache).

## [A4] Explain Scryfall rate limits and retry timing

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — The shared adapter now preserves rate-limit details for existing error displays.

**Status:** Complete — merged in `7cc37e1`; not yet published.

### Completed behavior

Scryfall HTTP 429 errors report a retry wait and local retry time. The adapter reads `Retry-After` seconds or HTTP dates and accounts for server clock skew using `Date` when exposed. Missing, invalid, or CORS-hidden retry headers produce a clearly labelled one-minute estimate, not a promise of recovery.

All adapter endpoints share a cooldown per fetch client/tab. Further requests fail locally with updated retry guidance until that deadline; concurrent responses retain the longest cooldown. Collection requests no longer retry 429 after 500/1000 ms. Existing transient-server retries, search no-match handling, and cancellation remain intact. Requests already in flight finish normally; reloads and other tabs do not share the cooldown.

Recommendation fallbacks no longer swallow rate-limit advice. Optional printing enrichment stops quietly without discarding existing suggestions, and manual printing details retain the retry message. The builder's Retry action preserves deck cards instead of restarting the deck.

### Acceptance checks

- Adapter checks cover every endpoint, numeric/date headers, clock skew, expired/invalid/missing headers, shared cooldowns, concurrent limits, expiry, and cancellation.
- Recommendation tests verify the detailed error reaches the displayed state without fallback requests or deck resets; optional printing failures keep suggestions.
- Browser checks inject 429 responses with numeric, date, missing, and CORS-hidden headers. They verify rendered guidance, no network requests on early Retry, deck-card preservation, and light/dark desktop/narrow layouts.
- All 116 tests, lint, typecheck, and production build pass. Existing hook and bundle-size warnings remain.

## [B6] Unify deck review and goal-driven recommendations

**Complexity:** Medium · **Value:** High · **Delivery risk:** Medium — Existing analysis and swap controls were reused; recommendation consistency and navigation needed regression checks.

**Status:** Complete — merged in `7cc37e1`; not yet published.

### Completed behavior

Detailed review and Deck Doctor now share one full-page **Deck review**: overview, findings, explicit swap plans, optional commander comparisons, and session change history. Section controls move focus to their destination; overview counts return to matching builder cards. Details and settings keep the review open and preserve selections. Loading printing metadata no longer clears planned cuts. Existing Doctor/history links and import/completion handoffs remain supported.

Thematic, Fun & varied, Balanced, and Competitive are explicit goals. Balanced stays the default with its existing neutral weights. Thematic favors identity; Fun rewards discovery; Competitive emphasizes evidence and deck needs without forced reason/theme diversity. Creature inclusion remains optional. Legacy Story and Optimized choices migrate to Thematic and Competitive in saved decks and local options. Goal ranking remains separate from eligibility filters and makes no bracket or win-rate promise.

Recommendation surfaces share a scoring-context builder. Replacements are scored against the deck after selected cuts, and ready plans show role-count and theme-match changes before approval. Replacement fetching excludes ignored, existing, off-colour, and known-illegal candidates, preserves commander evidence when merging theme results, and keeps the full candidate pool. Changed eligibility options invalidate fetched results; stale responses cannot replace newer ones. Mana-fit penalties now cover non-creature spells too.

### Acceptance checks

- Unit checks cover goal-specific ranking, legacy migration, creature inclusion, non-creature mana fit, candidate filtering/evidence preservation, and replacement scoring after cuts.
- Existing import, completion, route, swap, and safe-undo tests pass.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass. Existing hook and bundle-size warnings remain.
- Rendered checks cover partial/complete decks, 1366px/390px layouts, light/dark themes, card-name and image previews, details/settings return, equal-count swaps, undo, candidate refresh, overview filters, and legacy links. Screenshots and the browser smoke script stay outside the repository; no artwork is committed.

Ranking details: [docs/recommendation-design.md](docs/recommendation-design.md).

**Released reload fix: `ac6b2ea`.** Restore the current batch's saved Add/Later/Ignore decisions on startup instead of initializing an empty map and autosaving it. Both reload and saved-deck loading recover missing Add flags when queued cards already exist in the main deck or sideboard. Existing decisions remain authoritative; recovery does not invent lost Later/Ignore choices or change either board or the queue.

`src/app/useRecommendationState.test.ts` exercises storage, the real hook initializer, and first-click removal at 100 cards. All 164 tests, lint, typecheck, build, and standalone regression typecheck pass. Chromium reproduced the missing Liliana, Death Wielder badge before the fix, then verified 99-to-100 addition, reload highlighting, immediate removal, re-add/reload, legacy empty-map recovery, saved-deck loading, and sideboard removal. Light/dark desktop/narrow checks passed; harnesses and screenshots remain outside Git.

## [A1] Improve land and mana-support recommendations

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — The existing basic-land planner and mana data provide a base; reliable castability scoring still needs judgment calls.

**Status:** Complete — merged in `0103075` (`feat: improve land and mana recommendations`).

The builder can recommend on-theme creatures without checking whether the deck has enough mana to cast them. It can also leave the deck below its land target without reliably offering enough lands, especially basics. Weak ramp makes expensive cards harder to cast; weak draw makes it harder to find lands, ramp, and other needed cards. Recommendations should account for those gaps alongside theme and commander synergy.

### Required behavior

- Treat lands as a recommendation need. Use the current editable land target and remaining deck slots. Surface enough legal lands to address the gap, including basic lands; do not rely on an occasional `Land or mana` card in a batch.
- Distribute basic lands using commander colour identity and the deck's coloured mana requirements. Preserve basic-land quantities, allow repeat copies, and never exceed the target or the 100-card deck limit.
- Judge creature suggestions against the deck's mana support. Consider land count, ramp, curve, mana value, and coloured pips. Do not force a creature into a batch when its mana demands are a poor fit and useful support cards are available. Avoid a blanket ban: affordable, castable creatures can still be good recommendations.
- Treat card draw as consistency and access to resources, not as mana production. When draw is below target, make draw support more competitive with redundant theme cards.
- Keep commander legality, selected deck targets, recommendation style, and theme/synergy preferences in view. Recommendations should return to normal theme and synergy priorities as support gaps close.

### Context when planned

- `src/deck-analysis.ts` defines editable targets (defaults: 35 lands, 10 ramp, 10 draw), role counts, mana curve, coloured mana requirements, and `deckRoleBoosts`. `rolesForCard` identifies ramp and draw with card-data fields and rules-text heuristics.
- `basicLandPlan` calculates a basic-land count to fill the target gap and distributes it by commander colour identity and coloured mana demand. `src/features/builder/BuilderView.tsx` exposes this through a separate “Fill to land target” action after five non-land cards; normal recommendation batches do not guarantee it.
- `src/domain/recommendation-queue.ts` builds four-card batches, generally reserving up to three non-mana picks before trying one `Land or mana` pick. The creature-inclusion option can reserve a creature without considering whether its mana cost fits the deck. Initial and displayed-batch scoring set the land role boost to zero (`src/app/recommendation-actions.ts`, `src/app/useBuilderData.ts`).
- EDHREC is the primary recommendation source; Scryfall supplies card details and fallback recommendations. The app remains client-only. Useful card data includes mana cost, mana value, produced mana, colour identity, and Oracle text.

### Acceptance checks

- A deck below its land target gets actionable land recommendations or a basic-land fill that reaches the target without exceeding 100 cards. Basic-land colours stay within commander identity and follow coloured mana demand; colourless decks use Wastes.
- When land, ramp, or draw support is deficient, suitable support cards can outrank redundant picks. An expensive, colour-intensive creature is not forced into a batch when the deck cannot reasonably support it; cheaper suitable creatures remain eligible.
- Once support needs are met, theme and commander-synergy recommendations recover their normal priority. User-edited targets and recommendation settings still apply.
- Cover mono-colour, multicolour, and colourless decks; decks below, at, and above their land targets; and nearly full decks in tests.

## [B1] Add a detailed deck review

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — Static review reuses builder data; simulation is not justified by available metadata.

**Status:** Complete — merged in `992375d` (`feat: add detailed deck review dashboard`).

- Make deck review available at any time, including before the deck is complete.
- Open review automatically when the main deck first reaches 100 cards, whether the player fills it manually or imports a complete list. Keep it available afterward without reopening it on every render.
- Go beyond the builder sidebar: explain deck strengths and risks using mana curve, land/ramp/draw coverage, coloured requirements and sources, theme and keyword coverage, and other relevant card-type counts. Make findings understandable and actionable.
- Goldfish decision: no-go for B1. Available card metadata cannot model turn sequencing or game interactions reliably enough to improve on the inspectable static analysis. Revisit only if a model tested against simple known decks adds useful guidance beyond that analysis.

### Completed behavior

The builder offers detailed review at any deck size and opens it when the main deck reaches 100 cards. Complete imports use the same review; sideboard cards do not count toward completion. The review covers curve, roles, coloured mana, theme tags, and card types. Selecting a count closes the review, highlights matching cards, and jumps to the deck list.

### Acceptance checks

- Players can open and close review from the builder at any deck size. Filling the main deck to 100 opens it once; sideboard cards do not count toward completion.
- Review findings link to the cards or gaps they describe and do not replace the existing detailed analysis with unexplained scores.
- Goldfish simulation remains out of scope unless tests against simple known decks show that it adds useful information beyond static analysis.

## [B2] Connect deck import to deck review

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — The review exists; the work is to explain the handoff and give players a per-import choice without weakening validation.

**Status:** Complete.

### Completed behavior

For a parsed 100-card main deck (commander included; sideboard excluded), the import modal says that a successful import opens Deck review. The checkbox is checked by default for each import; opting out keeps the player in the builder, where review remains available. Partial imports stay in the builder and can be reviewed manually. Import validation and error messages remain in place.

### Acceptance checks

- Before importing a complete main deck, the player sees the handoff and can opt out for that import.
- A complete import opens the same review when opted in; an opted-out import remains in the builder. Manually completing a deck still opens review.
- Partial imports remain editable, sideboard cards do not count toward 100, and illegal or unresolved cards are reported before the current deck is replaced.

## [B3] Add Deck Doctor from deck review

**Complexity:** High · **Value:** High · **Delivery risk:** High — Heuristic tags and candidate recommendations need careful limits.

**Status:** Complete — merged in `360728f`.

### Completed behavior

The optional Doctor opens from Deck review at any deck size. It reports selected-theme support, cards with no detected theme, role, or synergy link, role gaps at the existing 70/85-card thresholds, and expensive or colour-intensive cards. Findings name their evidence and limits. They prompt review; they do not make automatic cuts.

A bounded simulator estimates land drops and land-only castability for one drawn, supported-cost spell at a time. It skips unsupported costs and omits ramp, tapped-land timing, mulligans, and card effects. Its estimates are not win rates or full-game predictions.

Players can approve legal swaps from the current recommendation queue or fetch more candidates on demand, optionally move cuts to the sideboard, and safely undo swaps during the session. Opt-in commander comparisons preserve the legality of current deck cards and never change deck state. Partner-pair comparisons are skipped.

The Doctor logic and swap/undo behavior have unit coverage, including fixed-seed known-deck simulation checks. Browser smoke checks covered review handoff, swaps and undo, sideboard retention, mocked commander comparisons, light/dark themes, and a narrow viewport.

Detailed spec: [docs/specs/b3-deck-doctor.md](docs/specs/b3-deck-doctor.md).

### Acceptance checks

- The Doctor opens from review at any deck size; role-gap guidance follows the 70/85-card thresholds.
- Findings use selected themes and sub-themes, name evidence, and explain heuristic uncertainty. Low support is a review prompt, not a cut decision.
- Balanced changes show both cards, mark the in-deck card, respect legality, and require explicit approval. Sideboard retention and session-only safe undo work.
- Commander comparisons are opt-in, preserve the current deck's legality, and never change the commander. Partner pairs retain other Doctor findings.
- Fixed-seed known-deck tests show the bounded simulation adds land-drop and spell-castability estimates beyond static analysis; unsupported costs and excluded effects are labelled.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and browser smoke checks pass.

## [B5] Make Deck Doctor a visual workspace

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — The main risk was keeping card selection, comparisons, and undo clear across a dense workflow.

**Status:** Complete — merged in `360728f`.

### Completed behavior

Deck Doctor is a full-page mode reachable directly from the builder or Deck review. It groups repeated mana concerns and weak-connection cards, and presents one shared replacement grid. Players choose equal numbers of cuts and additions, compare each pair with art and an in-deck label, then explicitly apply the atomic plan. Legal candidates, optional sideboard retention, and individual session undo remain supported. Commander comparisons remain opt-in and read-only.

Card names preview art on hover or focus and open the existing card-details modal; off-deck cards are read-only. Small card images also enlarge on hover or focus. Card tiles show full mana-cost icons instead of repeating colour identity; they omit derived mana-value totals. The mode reflows for narrow screens.

### Acceptance checks

- Direct builder and Deck review entry both open the full-page Doctor; card details return to the same workflow with selections intact.
- Mana concerns are grouped; candidates appear once. Card grids show art and full mana-cost icons without a duplicate colour-identity row, and every proposed pair marks the card currently in the deck.
- Batch validation is atomic, keeps deck size and commander legality, supports sideboard retention, and preserves individual safe undo.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and browser smoke checks pass in light, dark, and narrow layouts.

## [A3] Search and add multiple cards

**Complexity:** Medium · **Value:** High · **Delivery risk:** Low — Scryfall supports the search criteria; the main changes are query construction and a persistent search workspace.

**Status:** Complete.

### Completed behavior

The builder's “Search & add cards” action opens a full-page workspace with the shared top bar and commander context. Name and inclusive mana-value bounds are optional. Each criterion can be required, excluded, or ignored. Colour options follow commander identity by default and match mana-cost symbols, including hybrid and Phyrexian costs. Colourless cards, colourless payment, X, hybrid, and Phyrexian costs have separate options.

Keyword and effect filters cover lifelink, trample, flying, haste, hexproof, indestructible, ward, +1/+1 and -1/-1 counters, counterspells, sacrifice, ETB triggers, draw, tokens, and lifegain. Additional rules-text phrases can be required or excluded. The UI explains that tags and text matches can include mentions or granted abilities; they do not guarantee an interaction. Searches always request Commander-legal cards, and additions still enforce commander identity and existing copy limits.

Results show art, full mana-cost icons, rules text, and individual Add controls. Existing deck and sideboard cards are hidden by default; opting in highlights and labels their location. Players can select cards across result pages and add them together. The main deck fills to 100, then further cards go to the sideboard without closing search or opening review. Basic-land copies remain supported.

Search displays twelve cards per page and can load further Scryfall pages. Sorting, reset, empty results, retry, and cancellation are supported. Details reuse the card modal and retain alternate-printing selection. Filters, result pages, and selections remain intact when opening details, export, import, or save/load; changed commander context resets search.

### Acceptance checks

- Filter-only searches work without a name; generated queries keep names and rules-text phrases literal and validate mana-value bounds.
- Required and excluded criteria combine correctly, including hybrid colour costs and colourless commander identity.
- Existing cards are hidden by default, visibly labelled when shown, and cannot be added twice unless existing rules allow additional copies.
- Multiple additions fill the main deck up to 100 cards, then go to the sideboard without closing search or opening review.
- Selections survive result-page changes and card details. Search errors and cancelled requests cannot replace newer results.
- Tests, lint, typecheck, build, and light/dark/mobile browser smoke pass.

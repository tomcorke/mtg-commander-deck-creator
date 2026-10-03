# Recommendation and deck guidance design

## Goal

Recommend cards for the player's chosen goal, commander, declared theme, and existing deck. Theme, variety, and effectiveness are different priorities; no goal guarantees fun, a bracket, or a win rate.

## Data sources

- EDHREC commander JSON is the primary recommendation source. Fetch current data each session and rely on its CDN cache headers.
- Scryfall supplies card rules, legality, images, printings, mana values, and fallback recommendations.
- Keep the app client-only. If EDHREC is unavailable or its undocumented JSON shape changes, fall back to Scryfall and show `Limited recommendations`.
- Persist user state and its card snapshots; keep provider source-page and hydration caches in memory only.

## Scryfall session cache

The shared adapter caches successful raw card records and complete printing lists for 15 minutes from receipt, with a 2,000-entry limit per fetch client/tab. Nothing is persisted. Named and bulk lookups share normalized name keys; set/collector-number keys remain separate. Searches and printing lists also warm exact-printing records without changing the name-only default.

Bulk hydration reserves missing identifiers before dispatch, so overlapping requests share each lookup. Missing records are sent in batches of at most 75, sequentially within each call. EDHREC hydration excludes commanders and, during refresh, main-deck, sideboard, and ignored cards before requesting records. Recommendation goals, safety filters, and collection constraints are applied again to raw results; scores and query results are not cached.

Each caller receives a copy of cached data. Cancelling one caller leaves other consumers running; cancelling the last consumer aborts shared work. Failed, missing, and fully cancelled results are not retained. Successful printing lists include all pages. Recommendation refresh preserves commander art/finish choices, and enrichment does not overwrite a manual printing choice.

Expired entries are fetched on the next lookup. For an explicit data refresh, call `clearScryfallCache()` before looking up cards or printings again; it clears the default client's data and pending-request registry without changing deck selections or the 429 cooldown. Existing consumers finish independently, and their old responses cannot refill the new cache. A normal recommendation refresh reuses unexpired raw data. Reloading the page starts a new session. The uncached `fetchScryfallCollection` function remains the retrying HTTP transport; application lookups use `resolveScryfallIdentifiers` or `fetchScryfallCardsByIdentifiers`.

## Signature-card trial

Commander recommendations still load first. While the partial-deck builder is idle, a two-second pause can select up to three main-deck engines. Supported families are +1/+1 counters, blink/ETB, sacrifice, tokens/populate, enchantments, artifacts, lifegain, graveyard/recursion, spellslinger, landfall, and equipment. Each engine needs two other mechanic participants. A declared mechanic outranks incidental card-tag overlap; otherwise the existing fit score breaks ties. Commanders, lands, sideboard cards, generic staples, and unsupported mechanics are not seeds; legendary status earns no bonus.

Use one validated EDHREC page per seed, at most 24 novel names per page, and at most one 72-name Scryfall collection POST per pass. Rolling-hour ceilings are eight background source attempts and four POSTs per deck, or 24 and 12 across the tab. Timestamps expire individually after one hour; this is not an hourly reset. Every actual background dispatch, including retries and subsequently cancelled requests, counts. Cached results, cancellation before dispatch, and work promoted to foreground do not add background charges. Saving retains the same usage and pending work. Reloading starts a new tab session. Successful raw EDHREC pages still share the 15-minute/32-entry cache keyed by kind and slug.

Transient network, 429, and 5xx failures remain pending. Retry the failed step after exponential 10s/20s/40s backoff, with up to 20% positive jitter and a five-minute delay cap. A later usable, browser-exposed Retry-After/provider cooldown always wins, even beyond that cap. A 429 with inaccessible or unusable retry timing uses the existing estimated 60-second cooldown. Exhausted budgets defer work until both deck and tab allowances permit dispatch. Stop on other HTTP errors, malformed JSON/schema, or unresolvable cards. Reuse a successful source-page checkpoint while hydration is pending, recalculating exclusions for the current context; do not refetch the page merely because its hydration retry waits longer than the ordinary cache TTL. Background transport makes one attempt per scheduled run; it does not fetch printings or invoke fallback.

Retry only while the partial-deck builder is visible and idle. Hiding the tab, leaving the builder, changing context, or completing the deck cancels its timer and unused work. Pending state survives hook remounts and deck switches in the same tab, but only currently selected seeds resume. Successful nonempty results are acknowledged after the committed-context merge, so a discarded stale response does not permanently mark a seed complete. Recovery depends on provider availability and an active eligible builder; no durable or guaranteed recovery is claimed.

Foreground and background transport share provider scheduling: at most two active Scryfall requests with at least 500 ms between dispatches; at most one active EDHREC request with at least one-second spacing. Slots remain occupied until response bodies finish, not just until headers arrive. Foreground work wins queued slots, including shared requests promoted by foreground consumers. Provider cooldowns block background dispatch. Background failure stays silent and never triggers the foreground fallback.

Recheck Commander legality, colour identity, exclusions, collection constraints, deck/sideboard, ignored names, and deferred cards before merging. Require a concrete engine connection rather than a broad tag or incidental reminder text. Preserve the current four objects and all choices; append only unseen pending candidates and use ordinary goal-aware ranking on advancement. Deck identity/generation and current eligibility context reject stale responses, including switches between saved decks sharing a commander.

Optional per-seed/list/page evidence persists with candidates and selected cards. New cards display `Seen with <seed>` through the shared card reference, not `Commander synergy`; source-only score boosts are not added. Complete 100-card main decks pause enrichment. The [A6 report](a6-signature-card-investigation.md#rolling-hour-recovery) distinguishes the released baseline from the expanded implementation, live Anikthea checks, transport/browser validation, and remaining player review. These rules are a tested heuristic, not coverage of every combo, typal deck, or unsupported Energy package.

## Ranking

The four goals use the same inspectable score factors, with different weights and ordering:

- **Thematic:** downweight generic popularity, favor selected themes and collections, and preserve identity-focused batches. Deck-health prioritization defaults off but remains available.
- **Fun & varied:** retain the Balanced weights and add a discovery bonus for `Interesting new pick` cards. Allow more discovery picks in varied batches. Novelty is a source-based heuristic, not a measure of fun or a guarantee of lower popularity.
- **Balanced:** keep the neutral mix of commander evidence, theme, preferences, and deck needs. This is the default; it has no discovery bonus or thematic popularity penalty.
- **Competitive:** increase commander-evidence and role-gap weights, reduce theme and preference weights, and keep score order without reason/theme diversity quotas. The optional creature-inclusion preference still applies. This is not a cEDH optimizer or a bracket validator.

Scores combine source evidence, theme/sub-theme matches, collection preferences, picked-card tags, player preferences, role deficits and candidate scarcity, and mana-fit penalties. Apply mana-fit penalties to spells, not just creatures. On tied total scores, prefer the card that fills a greater deck need. The scoring module owns the numerical weights.

Builder scoring, batch advancement, printing highlights, and review replacements share a ranking-context builder. Review replacements use the candidate pool and the deck after selected cuts; they do not copy the builder's score for the unmodified deck. Star labels describe heuristic fit, not card power.

Priority (Theme first, Balanced, Deck needs first, Surprise me) changes recommendation ranking. Power (Core, Upgraded, High) applies app-specific recommendation filters; it does not set or reset the independent exclusions. Collection-only mode, ignored cards, legality, and commander colour identity still apply.

Balanced, Theme first, and Surprise me batches retain reason variety and theme coverage. Deck needs first bypasses those adjustments. Keep each card independently selectable and offer supported synergy pairs without making them mandatory.

Saved `story` goals migrate to Thematic and `optimized` goals to Competitive. Saved Balanced goals stay Balanced; missing or unknown values default to Balanced. Normalize both saved decks and stored goal options.

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

When three of the last 12 selected cards share a supported tag, offer a non-blocking prompt above `Next recommendations`, such as `Lean into +1/+1 counters?`.

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

The unified **Deck review** combines overview, findings, proposed swaps, and session change history. It is available for partial and complete decks. Existing Doctor and history routes remain supported. Section controls move focus to their destination; card details and settings preserve the current review selections.

Selecting an overview count returns to matching cards in the builder. Show the role-count and theme-match effects of a ready swap plan before approval. Swaps remain explicit, equal-count, atomic, and undoable; commanders are not ordinary cuts. Fetch fresh replacements on demand when eligibility settings change, and discard stale responses.

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

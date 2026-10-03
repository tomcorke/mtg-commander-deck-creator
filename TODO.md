# TODO

## How to maintain this file

- Keep one independently deliverable goal per `## [ID]` section. Use stable IDs: A for recommendations and first-use flow; B for review and follow-on workflows. Add the next number in the matching group; do not renumber or reuse IDs.
- Put ratings directly below each title using `**Complexity:** … · **Value:** … · **Delivery risk:** … — short rationale.`
- Give each item a concise goal, required behavior, relevant current context, and testable acceptance checks. Use bullets for requirements and checks; include source paths when they clarify existing behavior.
- Mark uncertain work as an investigation with a go/no-go condition. Do not present a speculative approach as a committed implementation.
- Move completed goals to [COMPLETED.md](COMPLETED.md), retaining their IDs; keep only active goals here.
- Update the suggested order when ratings, dependencies, or scope change.

## Rating key

Rate each dimension Low / Medium / High:

- **Complexity:** Low is localized work; Medium spans connected parts; High is cross-cutting or algorithm-heavy.
- **Value:** Low benefits a narrow case; Medium meaningfully helps a subset of players; High improves a core workflow or deck quality.
- **Delivery risk:** Low means a clear path and existing patterns; Medium means material assumptions need validation; High means uncertain feasibility or data quality could consume substantial effort and still produce little value.

Completed goals: [COMPLETED.md](COMPLETED.md) — A1, A3, A4, A5, B1, B2, B3, B5, B6, B7, B8, A7, A8, A10, and A13.

## Suggested order

Suggested sequence balances user value, delivery risk, and dependencies. Revisit it as estimates change. Items A7–A13 and B8–B11 come from the [design and UX review](docs/ux-review.md).

| Order | ID  | TODO                                     | Complexity | Value  | Delivery risk | Reason                                                                                                     |
| ----- | --- | ---------------------------------------- | ---------- | ------ | ------------- | ---------------------------------------------------------------------------------------------------------- |
| 1     | A12 | Defer basic-land fill                    | Low        | Medium | Low           | Small change that stops a premature 35-basic mana base distorting analysis.                                |
| 2     | A2  | Play-style step, resume, and intro guide | Medium     | High   | Medium        | Sets intent before the first batch; waits for A11's Priority control. Tour compatibility needs validation. |
| 3     | A9  | Commander discovery on the start screen  | Medium     | Medium | Medium        | Better first impression; the query-backed commander source needs validation.                               |
| 4     | A6  | Signature-card recommendations           | High       | High   | Medium        | Expanded engine families and bounded requests are implemented; representative player review remains.       |
| 5     | B9  | One deck-review workflow                 | Medium     | Medium | Low           | Naming, real steps, and layout cleanup; B8 is complete.                                                    |
| 6     | B10 | Finding-driven swap suggestions          | High       | High   | Medium        | Highest-value review change but needs pairing logic; builds on B8 and B9.                                  |
| 7     | A11 | Richer recommendation tuning             | Medium     | Medium | Medium        | Ignore reasons, price cap, and role shortcuts build on A7 and existing preference scoring.                 |
| 8     | B11 | Builder UI consistency pass              | Medium     | Medium | Low           | Type scale, duplicate controls, and deck rail; verify light, dark, and narrow layouts.                     |
| 9     | B4  | Finish builder-view module ownership     | High       | Medium | Medium        | Complete remaining refactor seams after the higher-value product work; B8 and B9 touch the same views.     |

## [A12] Defer basic-land fill

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — The fill action exists; this changes when and how it is offered.

"Fill to land target" is the most prominent sidebar action from the first card. With three cards in the deck it offered 35 basics split from four pips, leaving the deck 38% "complete" before any spells or nonbasic lands.

- Keep land progress visible, but promote the fill action only once most non-land slots are filled (for example 55 or more non-land cards), or when the player opens it deliberately.
- Before adding basics, offer recommended nonbasic lands for the commander's colours, then fill the remaining slots with basics split by current pip demand.

Current context: the sidebar renders the fill button in `src/features/builder/DeckOverview.tsx`; the confirmation dialog lives in `BuilderView`. A1 in [COMPLETED.md](COMPLETED.md) covers land recommendations.

Acceptance checks:

- An early deck shows land progress without a primary fill action.
- A deck near its non-land total sees nonbasic suggestions before the basic split.

## [A2] Add a play-style step, resume, and optional intro guide

**Complexity:** Medium · **Value:** High · **Delivery risk:** Medium — Settings can be preselected with existing state, but React Joyride compatibility needs validation.

Power level, deck goal, and exclusions are only reachable in Recommendation settings after the first batch, with defaults the player never sees. The start page also offers no way back to a deck in progress.

- After choosing a commander and before the first batch, ask how the player wants to play it with three large choices mapped to existing settings: Casual (Core, Thematic, exclusions on), Upgraded (Upgraded, Balanced), High power (High, Competitive, exclusions off). Offer an optional link to the set picker and a "Skip, use defaults" action. Keep all options editable in Recommendation settings.
- When a deck is in progress, show a "Continue building" card at the top of the start page with commander art, card count, and last-edited time.
- Move display preferences (commander art and colours, motion and finishes, dark mode) from the start header into one settings menu.
- Add an optional intro guide, controlled by a checkbox on the initial screen. Check it by default for first-time users. Run it once, after the first batch of the player's first new deck, then switch the checkbox off; players can switch it back on from the start screen. Persist and honor each player's choice.
- Try React Joyride for the guide. It is not currently installed; check compatibility with the app's React 19 setup before adding it. Keep the guide skippable and make its controls usable by keyboard and assistive technology.

Current context: `src/features/start/StartView.tsx` asks for a theme or colours and a commander. Recommendation settings already include style, power target, deck-health priority, and creature inclusion; `useStoredOption` persists settings in local storage, and the current deck persists through `src/deck-state.ts`. There is no play-style step, resume entry, or first-run guide state.

Acceptance checks:

- A first-time player can choose a play style and start with matching recommendation options; the player can still change them later, and skipping keeps the defaults.
- Returning to the start page with a deck in progress offers to continue it.
- With no saved preference, the guide checkbox is checked. Returning users get their saved choice; opting out prevents the tour from starting until they opt in again.
- The tour can be skipped without blocking deck creation, and existing recommendation preferences remain intact.

## [A9] Improve commander discovery on the start screen

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Medium — A query-backed commander source must return relevant, legal results within the existing request limits.

Theme and colour choices cancel each other, each theme maps to six hard-coded commanders shown three at a time, and commander rows show only a name and mana cost with the image on hover.

- Let a theme and colours combine as filters on one commander list.
- Show commanders as a card-art grid of about 8–12 with a one-line reason each, reusing `FinishedCardImage`.
- Investigate sourcing theme commanders from Scryfall or EDHREC theme pages through the shared request scheduler. Go/no-go: results for each supported theme are recognisably on-theme and legal; otherwise keep curated lists, expanded beyond six.
- Remove the 01/02 step numbering unless the steps become sequential.

Current context: `themeCommanders` in `src/domain/commander-catalog.ts`; `chooseTheme` and `toggleColour` in `src/app/useAppActions.ts:167-182` clear each other.

Acceptance checks:

- Choosing Tokens and then green and white shows only green-white token commanders, and both choices stay visibly selected.
- The grid shows card art without hover; hover or focus still enlarges it.

## [A6] Expand recommendations using signature cards in the deck

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — The bounded integration is tested; heuristic relevance and undocumented provider sources still need player review.

Commander-based EDHREC lists can miss cards that support engines already chosen for the deck. Keep the commander as the initial source, then supplement it from selected main-deck engines.

**Released baseline (2026-09-30): `47dab89`.** The [investigation and validation report](docs/a6-signature-card-investigation.md#implemented-trial) records the counters, blink/ETB, and sacrifice trial. It selects at most two supported engines after a two-second pause, reads one page per seed, and hydrates at most 48 names through the shared cache. Provider pacing, cooldowns, request ceilings, eligibility rechecks, persisted seed evidence, partner exclusions, and stale saved-deck responses are covered. Browser checks preserve current choices and later-batch behavior. The supplied Anikthea deck produced four eligible additions beyond its commander pool when tested as an 86-card partial deck; its complete 100-card main deck correctly pauses enrichment. Unsupported mechanics do not trigger fetching. Requests remain user-driven; permission is not an investigation gate. Player acceptance remains unproven.

**Released expansion: mechanics `d18fc56` and rolling-hour recovery `f928509`.** Added tokens/populate, enchantments, artifacts, lifegain, graveyard/recursion, spellslinger, landfall, and equipment profiles with labeled positive/negative checks. Limits are three seeds and at most 72 hydration names per pass, eight background source attempts/four POSTs per deck per rolling hour, and 24/12 per tab per rolling hour. The user approved rolling replenishment and automatic recovery of transient failures. Retries use 10s/20s/40s exponential backoff with jitter, capped at five minutes, and never precede provider cooldowns. Each actual background retry consumes allowance; cached, queued-cancelled, and foreground-promoted work does not consume an extra request. Pending source and hydration work resumes only in the visible, idle partial-deck builder. Shared transport still permits one EDHREC request and two Scryfall requests at a time, including response bodies, with unchanged pacing and foreground priority. The expanded Anikthea pass used three source GETs and one collection POST, adding 18 names absent from its complete commander pool. Novelty does not establish player relevance; the [report](docs/a6-signature-card-investigation.md#expanded-mechanics-and-limits) records that distinction.

**Released seed precision fix: `5829d80`.** Equipped/enchanted death and combat triggers (Skullclamp, Swords) no longer count as Equipment or Sacrifice engines, and opponent-triggered sentences (Smothering Tithe) are ignored when testing engine wording. A staples-only deck now selects no incidental seeds. A hardcoded staple list was rejected: lift ≥ 1.5 already filters staple results, and some staples (Phyrexian Altar) are real engines. Completed results now merge into the queue once.

- Keep seed selection tied to repeatable engine wording and at least two other main-deck participants. Legendary or planeswalker status earns no bonus; commanders, sideboard cards, lands, and ordinary staples are not seeds.
- Use card-page co-occurrence or a suitable blink commander's page. Skip an unavailable source without trying a second route. Do not use the Recs endpoint or add a proxy for this trial.
- The user approved the expanded profiles, rolling-hour request allowances, and transient-failure retries. Keep further increases subject to explicit approval, and review the supported families with players. Broader coverage must produce useful additions without selecting every card on every deck change.
- Build on A5's cache and deduplication. Bound concurrency, request frequency, and total work for both EDHREC and Scryfall; foreground requests take priority, and background work respects provider cooldowns.
- Quietly merge completed results into the pending recommendation pool. Keep the visible batch and Add/Later/Ignore/like choices stable; new cards should naturally enter subsequent batches through the same goal-aware scoring and ranking as all other candidates.
- Deduplicate results, retain source/seed evidence for explanations, and respect commander identity, legality, exclusions, collection constraints, ignored cards, and deferred-card cooldowns.
- Cancel or discard stale jobs when the deck or recommendation context changes. Background failures must not clear the queue, block local batches, or replace the main workflow with an error screen.

Current context: `edhrecRecommendations` in `src/app/recommendation-actions.ts` uses the commander or partner pair and hydrates names through Scryfall. `src/domain/recommendation-queue.ts` owns batching and deferrals; the shared scoring/context modules should also evaluate added candidates.

Go/no-go: the released baseline and approved expansion have source, transport, queue, and browser evidence. Representative player review remains necessary before claiming improved relevance; the current approval does not authorize unrestricted scans or future cap increases. If a mechanic cannot produce useful additions within the current budget, retain commander-first behavior rather than inventing unsupported recommendations.

Acceptance checks:

- Known decks demonstrate useful signature-card selection and additional candidates beyond the commander pool; non-legendary theme engines can be considered without selecting every staple.
- Late results appear in later batches with the same scoring rules, without duplicates, resurrected ignored/deferred cards, or changed current choices.
- Measured request counts, rolling-hour boundaries, repeated deck edits, backoff, rate limits, failures, hidden tabs, and deck switches demonstrate bounded work and safe recovery. Successful work is reused; permanent failures do not retry.

## [B9] Make deck review one clear workflow

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Reorganises existing sections without new analysis.

The feature appears as "Deck review" (two builder buttons and the page title), "Deck analysis" (sidebar), and Deck Doctor (code and history modal). The page opens with three caveat paragraphs, its Overview / Findings / Swap cards / History buttons scroll one long page, and the Diagnosis column stays empty beside a long cut list.

- Use one user-facing name, "Deck review", and one builder entry point.
- Replace the scroll anchors with real steps: Diagnose → Choose changes → Confirm, with a sticky summary of pending cuts and additions. Keep history in the existing history modal.
- Replace the caveat paragraphs with one "How review works" disclosure.
- Rename jargon labels such as "Sources reported" and "Tag matches found" in plain language.
- Move "Try another commander" to the commander header as "Compare commanders".

Current context: `src/features/builder/DeckDoctorView.tsx` renders all sections on one page; builder entry points are in `BuilderView.tsx` and `DeckOverview.tsx`.

Acceptance checks:

- The builder shows one review entry point, and no user-facing text says "Deck Doctor".
- Each step fits its content without a long empty column; Back and Escape behave predictably between steps.

## [B10] Suggest swaps from review findings

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — Pairing cuts with additions needs a ranking rule that players find sensible.

Findings describe problems but leave players to choose cuts and additions separately and pair them mentally.

- For each actionable finding, propose up to three concrete swaps, for example "Cut Swamp → Add Deadly Dispute: ramp 2→3, card draw 0→1".
- Show both card images, label the in-deck card, and show the role and curve impact before applying.
- Keep manual cut and addition selection as an advanced path.
- Respect goal, power, exclusions, collection settings, and ignored cards.

Current context: findings come from `src/deck-doctor.ts`; replacement ranking already uses the shared scoring. `docs/agents/ui.md` defines comparison presentation.

Acceptance checks:

- A deck with a ramp shortfall receives ramp swap suggestions whose cuts come from flagged or low-fit cards.
- Applying a suggested swap updates the deck, findings, and history in one action.

## [A11] Richer recommendation tuning

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Medium — Mapping reasons to scoring changes needs validation so feedback visibly improves later batches.

Add, Later, Ignore, and like are the only in-flow tuning. Ignore records no reason, there is no budget control although prices are shown, and no action targets a missing role directly.

- Let Ignore take an optional quick reason: Not my style, Too expensive, Off-theme, Have something similar. Feed each reason into an existing mechanism (preference score, price cap, theme weighting).
- Add an optional maximum price per card to Recommendation settings.
- Replace the overlapping Deck goal and Prioritize deck health controls with one Priority setting (Theme first, Balanced, Deck needs first, Surprise me), keeping Power separate. Choosing one control must not silently reset another.
- Replace the modal's opening caveat paragraph with one "How recommendations work" disclosure.
- Make each below-target row in the Deck targets sidebar open a batch filtered to that role, keeping the normal batch size.

Current context: preference learning lives in `src/domain/recommendation-queue.ts` and the scoring modules; role detection in `src/deck-analysis.ts`. Depends on A7.

Acceptance checks:

- Ignoring a card as Too expensive offers or applies a price cap, and later batches respect it.
- Selecting Ramp 2/10 shows only ramp candidates in a normal-size batch.

## [B11] Builder UI consistency pass

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Styling and layout work inside existing components.

- Raise decision-driving text (settings help, findings, score rows, sidebar targets) to at least 14 px, and reduce oversized headings on working screens.
- Keep one "+ Search & add cards" control on the builder screen.
- Replace the name-only deck list below the recommendations with a compact grid or a collapsible deck rail, as `docs/agents/ui.md` requires.
- Separate "Start over" from routine header actions and give it a destructive style; keep its confirmation.
- Profile rendering with Motion and finishes on; the browser stalled once while capturing a builder screenshot.
- Verify light mode, narrow viewports, and keyboard-only use; the UX review could not check them.

Acceptance checks:

- Rendered review passes in light, dark, and narrow layouts with no duplicated builder controls.
- No measurable main-thread stall on the builder with four tiles and motion on.

## [B4] Finish builder-view module ownership

**Complexity:** High · **Value:** Medium · **Delivery risk:** Medium — The application root is modular, but the builder view still owns several independent dialogs and the feature-level style and lint boundaries are incomplete.

Finish the remaining module-ownership work without splitting markup that has no useful seam.

### Required behavior

- Move the remaining collection-browser and basic-land dialogs into focused components with their related interaction state where practical. Card search and export are already extracted. Keep `BuilderView` responsible for composing the builder workflow.
- Move responsive and theme rules from `src/styles/responsive.css` into the owning feature styles; leave genuinely shared rules in shared styles.
- Apply function-length, nested-callback, and cognitive-complexity checks to helpers and callbacks in feature TSX. Keep any exceptions narrow and documented rather than disabling checks for all feature views.

### Existing implementation to build on

- `src/features/builder/BuilderView.tsx` is about 1,390 lines and still renders the collection-browser and basic-land dialogs. `CardSearchView` owns search filters, requests, result pages, and selections; its theme and responsive rules live in `src/styles/card-search.css`. Export is composed through `ExportDeckModal`.
- `src/styles/responsive.css` combines viewport rules with theme rules for several features.
- `eslint.config.js` disables function-length, nested-callback, and cognitive-complexity checks across `src/features/**/*.tsx`.
- The application root, start and builder views, adapters, domain logic, focused modals, formatter, and base complexity checks are already in place.

### Acceptance checks

- Each independent builder dialog has a focused component and no longer carries unrelated view state.
- Responsive and theme rules live with their owning styles; shared base rules remain shared.
- Lint checks helper and callback functions in feature TSX, with no blanket feature-level exclusions.
- Existing tests, lint, typecheck, production build, and the manual UI smoke check pass without behavior or accessibility regressions.

## Migrated GitHub issues

- **#1 — Make recommendations theme-first and collection-aware:** the scoring, queue, collection, persistence, and preference-learning behavior is implemented and tested; no remaining scope needs a TODO.
- **#2 — Refactor app into cohesive modules and readable source formatting:** the main extraction and formatting work landed. The remaining view, style, and TSX-check gaps are tracked in B4.

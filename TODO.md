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

Completed goals: [COMPLETED.md](COMPLETED.md) — A1, A3, A4, A5, B1, B2, B3, B5, and B6.

## Suggested order

Suggested sequence balances user value, delivery risk, and dependencies. Revisit it as estimates change.

| Order | ID  | TODO                                 | Complexity | Value  | Delivery risk | Reason                                                                                               |
| ----- | --- | ------------------------------------ | ---------- | ------ | ------------- | ---------------------------------------------------------------------------------------------------- |
| 1     | A6  | Signature-card recommendations       | High       | High   | Medium        | Expanded engine families and bounded requests are implemented; representative player review remains. |
| 2     | A2  | Initial user flow                    | Medium     | Medium | Medium        | Useful onboarding improvement; intent mapping and tour compatibility need validation.                |
| 3     | B4  | Finish builder-view module ownership | High       | Medium | Medium        | Complete remaining refactor seams after the higher-value product work.                               |

## [A6] Expand recommendations using signature cards in the deck

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — The bounded integration is tested; heuristic relevance and undocumented provider sources still need player review.

Commander-based EDHREC lists can miss cards that support engines already chosen for the deck. Keep the commander as the initial source, then supplement it from selected main-deck engines.

**Released baseline (2026-09-30): `47dab89`.** The [investigation and validation report](docs/a6-signature-card-investigation.md#implemented-trial) records the counters, blink/ETB, and sacrifice trial. It selects at most two supported engines after a two-second pause, reads one page per seed, and hydrates at most 48 names through the shared cache. Provider pacing, cooldowns, request ceilings, eligibility rechecks, persisted seed evidence, partner exclusions, and stale saved-deck responses are covered. Browser checks preserve current choices and later-batch behavior. The supplied Anikthea deck produced four eligible additions beyond its commander pool when tested as an 86-card partial deck; its complete 100-card main deck correctly pauses enrichment. Unsupported mechanics do not trigger fetching. Requests remain user-driven; permission is not an investigation gate. Player acceptance remains unproven.

**Approved expansion: implemented, not yet published.** Added tokens/populate, enchantments, artifacts, lifegain, graveyard/recursion, spellslinger, landfall, and equipment profiles with labeled positive/negative checks. Limits are three seeds and at most 72 hydration names per pass, eight seed attempts/four background POSTs per deck, and 24/12 per tab. Shared transport allows one EDHREC request and two Scryfall requests at a time, including response bodies, while retaining pacing, cooldowns, foreground priority, and no automatic background retries. The expanded Anikthea pass used three source GETs and one collection POST, adding 18 names absent from its complete commander pool. Novelty does not establish player relevance; the [report](docs/a6-signature-card-investigation.md#expanded-mechanics-and-limits-unreleased) records that distinction.

- Keep seed selection tied to repeatable engine wording and at least two other main-deck participants. Legendary or planeswalker status earns no bonus; commanders, sideboard cards, lands, and ordinary staples are not seeds.
- Use card-page co-occurrence or a suitable blink commander's page. Skip an unavailable source without trying a second route. Do not use the Recs endpoint or add a proxy for this trial.
- The user approved the expanded profiles and request allowances. Keep further increases subject to explicit approval, and review the supported families with players. Broader coverage must produce useful additions without selecting every card on every deck change.
- Build on A5's cache and deduplication. Bound concurrency, request frequency, and total work for both EDHREC and Scryfall; foreground requests take priority, and background work respects provider cooldowns.
- Quietly merge completed results into the pending recommendation pool. Keep the visible batch and Add/Later/Ignore/like choices stable; new cards should naturally enter subsequent batches through the same goal-aware scoring and ranking as all other candidates.
- Deduplicate results, retain source/seed evidence for explanations, and respect commander identity, legality, exclusions, collection constraints, ignored cards, and deferred-card cooldowns.
- Cancel or discard stale jobs when the deck or recommendation context changes. Background failures must not clear the queue, block local batches, or replace the main workflow with an error screen.

Current context: `edhrecRecommendations` in `src/app/recommendation-actions.ts` uses the commander or partner pair and hydrates names through Scryfall. `src/domain/recommendation-queue.ts` owns batching and deferrals; the shared scoring/context modules should also evaluate added candidates.

Go/no-go: the released baseline and approved expansion have source, transport, queue, and browser evidence. Representative player review remains necessary before claiming improved relevance; the current approval does not authorize unrestricted scans or future cap increases. If a mechanic cannot produce useful additions within the current budget, retain commander-first behavior rather than inventing unsupported recommendations.

Acceptance checks:

- Known decks demonstrate useful signature-card selection and additional candidates beyond the commander pool; non-legendary theme engines can be considered without selecting every staple.
- Late results appear in later batches with the same scoring rules, without duplicates, resurrected ignored/deferred cards, or changed current choices.
- Measured request counts, repeated deck edits, rate limits, failures, and deck switches demonstrate bounded work and safe stale-result handling.

## [A2] Improve the initial user flow

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Medium — Settings can be preselected with existing state, but deck-intent mapping and React Joyride compatibility need validation.

- Ask what kind of deck the player wants to build, then use the answer to set starting recommendation options. Keep those options editable in the existing settings.
- Add an optional intro guide, controlled by a checkbox on the initial screen. Check it by default for first-time users, then persist and honor each player's choice.
- Try React Joyride for the guide. It is not currently installed; check compatibility with the app's React 19 setup before adding it. Keep the guide skippable and make its controls usable by keyboard and assistive technology.

Current context: `src/features/start/StartView.tsx` currently asks for a theme or colours and a commander. Recommendation settings already include style, power target, deck-health priority, and creature inclusion; `useStoredOption` persists settings in local storage. There is no deck-intent questionnaire or first-run guide state.

Acceptance checks:

- A first-time player can choose a deck intent and start with matching recommendation options; the player can still change them later.
- With no saved preference, the checkbox is checked. Returning users get their saved choice; opting out prevents the tour from starting until they opt in again.
- The tour can be skipped without blocking deck creation, and existing recommendation preferences remain intact.

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

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

Completed goals: [COMPLETED.md](COMPLETED.md) — A1, A3, A4, A5, B1, B2, B3, B5, B6, B7, B8, A7, A8, A10, A12, A11, A13, B9, B13, and B14.

## Suggested order

Suggested sequence balances user value, delivery risk, and dependencies. Revisit it as estimates change. Items A7–A13 and B8–B11 come from the [design and UX review](docs/ux-review.md).

| Order | ID  | TODO                                     | Complexity | Value  | Delivery risk | Reason                                                                                                                |
| ----- | --- | ---------------------------------------- | ---------- | ------ | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1     | A14 | Multi-tab drafts and autosaves           | High       | High   | High          | Top priority: prevent cross-tab draft loss.                                                                           |
| 2     | A2  | Play-style step, resume, and intro guide | Medium     | High   | Medium        | Sets intent before the first batch; waits for A11's Priority control. Tour compatibility needs validation.            |
| 3     | A9  | Commander discovery on the start screen  | Medium     | Medium | Medium        | Better first impression; the query-backed commander source needs validation.                                          |
| 4     | A6  | Signature-card recommendations           | High       | High   | Medium        | Expanded engine families and bounded requests are implemented; representative player review remains.                  |
| 5     | B10 | Finding-driven swap suggestions          | High       | High   | Medium        | Highest-value review change but needs pairing logic; builds on B8 and B9.                                             |
| 6     | B11 | Builder UI consistency pass              | Medium     | Medium | Low           | Type scale, duplicate controls, and deck rail; verify light, dark, and narrow layouts.                                |
| 7     | B4  | Finish builder-view module ownership     | High       | Medium | Medium        | Complete remaining refactor seams after the higher-value product work; B8 and B9 touch the same views.                |
| 8     | B12 | Commander construction rules             | High       | High   | Medium        | Several paths accept illegal decks or reject legal ones; from the domain audit, so reprioritize against the UX items. |
| 9     | A15 | Current policy and provider fixes        | Medium     | Medium | Low           | Outdated bracket wording and the EDHREC list rename mislead players and weaken reasons.                               |

## [A14] Support multiple tabs and safer autosaves

**Complexity:** High · **Value:** High · **Delivery risk:** High — Tab isolation, recovery choices, and safe retention span startup, persistence, and saved-deck flows.

`localStorage` stores one current work-in-progress deck for the app origin, so every tab restores and autosaves the same state. Concurrent deck building can overwrite another tab's draft; named manual saves live separately.

- Investigate a client-only storage model that gives each tab its own deck workspace while retaining recoverable autosaves after reload. Define duplicate-tab behavior and whether loading a draft in another tab resumes or forks it; never silently share writes.
- Clearly identify when a new tab automatically loads the latest work-in-progress deck, including its commander and last-saved time. Let the player choose another autosaved deck or start a new deck before editing.
- List autosaved work separately from manual saves, showing each deck's identity, progress (such as card count), and last-saved time or age.
- Make autosave retention configurable: allow a maximum number of autosaves and an age limit, with a sensible default (one week is a candidate). Never prune a live workspace's only recovery point or a manual save.

Current context: `src/deck-state.ts` stores the in-progress deck under the shared `commander-deck-state` key and manual saves separately under `commander-saved-decks`. `src/app/AppController.tsx` restores the shared draft at startup; `src/app/useAppEffects.ts` autosaves idle changes. A2 also tracks a start-screen "Continue building" card; reuse the draft picker rather than creating a separate resume path.

Go/no-go: proceed only after a browser-only design proves that two concurrent workspaces stay isolated and each can be recovered after reload without collisions with manual saves. If duplicate-tab behavior cannot be made clear, resolve that before implementing autosave retention.

Acceptance checks:

- Two tabs can edit different decks; switching or reloading either tab restores its own work without changing the other's autosave.
- A new tab identifies the draft it auto-loaded and when it was last saved, and offers other autosaved decks or a new deck before editing.
- Autosaved decks are distinct from manual saves and show deck identity, progress, and age.
- Configured count and age limits clean up only eligible inactive autosaves; active workspaces and manual saves remain intact.

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

## [B12] Enforce Commander construction rules at one boundary

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — Several entry paths disagree on legality today; a shared validator is clear, but saved-deck migration and partner pairing need care.

**Status:** Partly implemented. `src/domain/commander-construction.ts` now checks start, import, search/manual add, recommendation Add decisions and guidance, basic additions, sideboard-to-deck moves, promotion, and review swaps/undo. It handles basic and Oracle copy exceptions, front-face eligibility and Grist, the five partner ability families, basic land types, and unknown legality/identity/mana value. Imported pairs resolve separately; the six curated aliases remain display shortcuts, not pairing authority. Chosen-colour commanders are explicitly rejected. New persisted snapshots retain Oracle identity and policy fields; legacy snapshots still need hydration.

**Verified:** Regression tests cover basic/Oracle copy limits, interchangeable identities, front-face eligibility, Grist, banned/unknown metadata, Crypt Ghast, all supported partner abilities and mismatches, and consistent mutation rejection. Browser checks with mocked providers pass in light/dark at 1440px and dark at 390px: illegal Add decisions leave the deck unchanged, legal Add succeeds, and there is no horizontal overflow or runtime error. These checks do not verify fresh policy data on saved-deck load.

**Remaining:** Undoing a review swap whose cut card predates the B12 snapshot fields fails and drops its history entry (found in the B9 review). Refresh and revalidate saved decks, startup drafts, visible/queued cards, and deferrals against current legality and Game Changer data. Show persistent warnings for changed/unknown data, and keep an invalid 100-card snapshot from silently appearing complete. Preserve user printings, choices, and recovery data during migration; do not delete cards on a failed refresh. Legacy snapshots without Oracle IDs still use name matching. Unknown mana value retains the numeric display fallback with `manaValueKnown: false`; validation rejects it, but analysis of old snapshots still needs care.

The original audit found that start, promotion, manual add, recommendations, Doctor swaps, import, and saved-deck load each applied different subsets of the Commander rules. Some paths accept illegal decks; others reject legal ones. Route every path through one validator built on [docs/domain/commander-rules.md](docs/domain/commander-rules.md) and [docs/commander-eligibility.md](docs/commander-eligibility.md).

- Copy limits: treat "basic" as a supertype so snow basics and Wastes repeat freely. Honour Oracle text allowing any number or a fixed number of copies (Relentless Rats, Seven Dwarves, Nazgûl). Compare cards by `oracle_id`, not display name.
- Commander eligibility: judge the front face only. Westvale Abbey and Elbrus, the Binding Blade are not commanders. Grist, the Hunger Tide is a commander, because its creature ability works outside the game. Import must use the shared eligibility check, not "type line contains Legendary or Background".
- Partner pairs: replace the six hard-coded pair aliases with the five partner abilities in CR 702.124. Fix imported pairs, which are currently joined into one exact-name lookup. Until a pairing keyword is supported, reject the pair with a clear message.
- Legality: require `legalities.commander === 'legal'` for commanders and cards on every path. Unknown legality, unknown colour identity, and unknown mana value must fail closed, not become legal, colourless, or zero.
- Colour identity: never rebuild identity from reminder text (Crypt Ghast's extort reminder is not white). Prefer fresh Scryfall `color_identity` over the fallback scanner; treat a missing value as unknown.
- Persistence: revalidate saved decks and queued candidates on load against current legality and Game Changer data, and tell the player what changed.
- Chosen-colour commanders (The Prismatic Piper, Faceless One): investigate support or reject them explicitly; do not treat them as colourless.

Current context: [the 2026-10-03 assumption audit](docs/domain/assumption-audit-2026-10-03.md) lists each path with line references. Code has changed since that audit (A7, A8, A10), so recheck the paths. Key files are `src/domain/commander-promotion.ts`, `src/domain/commander-catalog.ts`, `src/domain/recommendation-scoring.ts`, `src/app/deck-actions.ts`, `src/deck-import.ts`, and `src/deck-state.ts`.

Acceptance checks:

- Tests cover snow basics, Wastes, Relentless Rats, Seven Dwarves above and at seven, Westvale Abbey, a legendary non-creature without permission, Grist, a banned legendary creature, Crypt Ghast's identity, and each supported partner ability, including a mismatched pair.
- Import, manual add, recommendations, Doctor swaps, and promotion return the same verdict for the same card and deck.
- A saved deck containing a newly banned card loads with a visible warning rather than silently counting as complete.

## [A15] Align recommendation filters and provider assumptions with current policy

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Mostly labels, mappings, and query changes; EDHREC's undocumented JSON remains a risk.

Some recommendation settings and provider mappings encode outdated policy or data. See [docs/domain/format-policy.md](docs/domain/format-policy.md) and [docs/domain/data-sources.md](docs/domain/data-sources.md).

- Present the tutor and extra-turn exclusions as player preferences. Wizards removed tutor restrictions from brackets in October 2025. Do not describe Core as "precon" level, because Wizards decoupled Bracket 2 from precons.
- Map EDHREC's `highliftcards` list to the Commander-synergy reason, as `highsynergycards` was.
- Recheck colour identity on the foreground EDHREC path and in `decide()`; EDHREC co-occurrence is not a legality check.
- Stop excluding every `is:commander` card from Scryfall recommendations; legendary creatures are valid main-deck cards.
- Replace `order=random`, which Scryfall does not document and which returned alphabetical results.
- Make `scripts/recommendation-audit.ts` respect the 500 ms Scryfall spacing.
- Verify the export modal's claim that Moxfield cannot import commanders with the main deck, and record the date checked.
- Optional: show a deck-wide Game Changer count against the chosen power target's bracket limit (zero, up to three, unlimited).

Acceptance checks:

- Settings copy names official bracket limits only for Game Changers. Other exclusions are labelled as preferences.
- A live EDHREC fixture with `highliftcards` produces Commander-synergy reasons.
- An off-identity EDHREC card cannot be added from a batch.
- The audit script cannot dispatch Scryfall collection requests less than 500 ms apart.

## Migrated GitHub issues

- **#1 — Make recommendations theme-first and collection-aware:** the scoring, queue, collection, persistence, and preference-learning behavior is implemented and tested; no remaining scope needs a TODO.
- **#2 — Refactor app into cohesive modules and readable source formatting:** the main extraction and formatting work landed. The remaining view, style, and TSX-check gaps are tracked in B4.

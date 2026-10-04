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

Completed goals: [COMPLETED.md](COMPLETED.md) — A1, A3, A4, A5, B1, B2, B3, B5, B6, B7, B8, A7, A8, A10, A12, A11, A13, B9, B13, B14, A14, A2, A9, B10, B11, B4, and B12.

## Suggested order

Ship the completed-feature batch before starting A16–A19 or B15–B17. A6's representative-player gate and A15's Moxfield verification remain open; their technical work does not establish those outcomes.

A16–A19 and B15–B17 come from the 2026-10-04 Chrome interaction review of `chore/todo-shipping@64efe8f`. A20–A33 and B18–B32 come from the 2026-10-04 visual design and UX review of the live site (`main@0ccbaed`); B18 comes first because it can lose decks. Release evidence and nonblocking follow-ups are in [the acceptance record](docs/completed-features-acceptance-2026-10-04.md).

| Order | ID  | TODO                                   | Complexity | Value  | Delivery risk | Reason                                                                             |
| ----- | --- | -------------------------------------- | ---------- | ------ | ------------- | ---------------------------------------------------------------------------------- |
| 1     | B18 | Saved decks out of localStorage        | High       | High   | Medium        | Storage is full on the live site; autosaves fail and decks can be lost.            |
| 2     | A6  | Signature-card player review           | High       | High   | Medium        | Technical validation is complete; representative-player relevance is not verified. |
| 3     | A15 | Remaining Moxfield verification        | Medium     | Medium | Medium        | Policy/provider fixes are implemented; browser access blocked the import check.    |
| 4     | A16 | Clear batch decisions and tile states  | Low        | High   | Low           | Most-used screen; selected Later and Ignore need distinct states.                  |
| 5     | B17 | Consistent mana and land guidance      | Low        | Medium | Low           | Align existing targets and identity-based presentation.                            |
| 6     | B15 | Actionable review progress and results | Medium     | High   | Low           | Review navigation, feedback and incomplete-deck guidance.                          |
| 7     | B19 | Consistent card tiles; text deck list  | Medium     | High   | Low           | Five tile styles today; condensed deck list requested.                             |
| 8     | B31 | Better layout for review additions     | Medium     | High   | Low           | 13 pages of small tiles; builds on B19.                                            |
| 9     | A22 | Start screen as a full page            | Medium     | High   | Low           | Commander choice is a key step squeezed into a narrow column.                      |
| 10    | B20 | Replace the 0-100 score display        | Low        | Medium | Low           | Low absolute scores make good picks look poor.                                     |
| 11    | A28 | Calm card-data check status            | Low        | Medium | Low           | Red banner, layout shift and empty curve on every reload.                          |
| 12    | A30 | Card art clear of tile controls        | Low        | Medium | Low           | Art covers a decision control.                                                     |
| 13    | A31 | Card details from recommendation names | Low        | Medium | Low           | Reuse CardReference as ui.md requires.                                             |
| 14    | B28 | Deck review on small decks             | Low        | Medium | Low           | Early review looks broken and shows false success checks.                          |
| 15    | B30 | Plain labels for review additions      | Low        | Medium | Low           | Copy only.                                                                         |
| 16    | A21 | Simpler commander Choose button        | Low        | Medium | Low           | Removes three-line wrapping and misalignment.                                      |
| 17    | A20 | Clearer commander tile captions        | Low        | Medium | Low           | Copy and layout only.                                                              |
| 18    | A24 | Builder starts at the top              | Low        | Medium | Low           | Header is cut off after choosing a commander.                                      |
| 19    | A26 | Clearer play-style cards               | Low        | Medium | Low           | First choice after picking a commander.                                            |
| 20    | B27 | Clearer search results and actions     | Low        | Medium | Low           | Copy and action styling.                                                           |
| 21    | B22 | Investigation: button hierarchy        | Medium     | Medium | Low           | Spike and prototype before any change.                                             |
| 22    | B24 | Document repeated role-target figures  | Low        | Medium | Low           | Doc for a layout decision.                                                         |
| 23    | B25 | Confirmation dialog consistency        | Low        | Medium | Low           | Replace window.confirm after agreeing a pattern.                                   |
| 24    | B16 | Role-tag and cut-flag accuracy         | High       | High   | Medium        | Investigate labelled real decks before changing heuristics.                        |
| 25    | A17 | Forgiving, transparent import          | Medium     | Medium | Low           | Front-face matching, partial imports and replacement confirmation.                 |
| 26    | A18 | Narrow-screen layout                   | Medium     | Medium | Low           | Keep progress visible and remove overflow.                                         |
| 27    | A19 | Start-screen keyboard and SR state     | Low        | Medium | Low           | Finish result navigation and focus handoff on the new discovery flow.              |
| 28    | B26 | Readable search filters                | Medium     | Medium | Low           | Narrow nested-scroll panel and unclear labels.                                     |
| 29    | B29 | Remaining dialog issues                | Medium     | Medium | Low           | Save/load, export and settings fixes; storage usage after B18.                     |
| 30    | B23 | Consistent content widths              | Medium     | Medium | Low           | Shared page widths; A22 and B19 benefit.                                           |
| 31    | B21 | Shared text components                 | High       | Medium | Medium        | Agree a type scale first; touches most screens.                                    |
| 32    | A23 | Consistent header labels               | Low        | Low    | Low           | Copy only.                                                                         |
| 33    | A25 | Correct card-count wording             | Low        | Low    | Low           | Copy only.                                                                         |
| 34    | A27 | Accurate setup and loading headings    | Low        | Low    | Low           | Copy by state.                                                                     |
| 35    | A29 | Less prominent Start over              | Low        | Low    | Low           | Button style.                                                                      |
| 36    | A32 | Intro guide placement                  | Low        | Low    | Low           | Popover positioning.                                                               |
| 37    | A33 | Move the API request indicator         | Low        | Low    | Low           | Move one control.                                                                  |
| 38    | B32 | Step-heading focus style               | Low        | Low    | Low           | CSS.                                                                               |

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

## [A15] Verify remaining Moxfield guidance after policy/provider fixes

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Medium — The policy/provider fixes are implemented; the remaining import check depends on access to Moxfield.

**Implemented and validated:** Tutor and extra-turn filters are labelled as player preferences; Core is not described as precon level. EDHREC `highliftcards` maps to Commander-synergy reasons. Foreground recommendations and Add recheck colour identity, eligible legends remain in main-deck searches, undocumented random ordering is removed, and the audit uses the shared 500 ms scheduler. Settings help uses shared keyboard-accessible, viewport-bounded popovers.

**Remaining:** Verify Moxfield's native import treatment of commanders and record the date checked. The export copy no longer claims Moxfield cannot import them: it describes what this app's export includes.

The review browser could reach Moxfield help, but the app did not load; headless access returned 403/Cloudflare. This is not evidence of import capability. See [audit row I2](docs/domain/assumption-audit-2026-10-03.md) and [current policy](docs/domain/format-policy.md).

Acceptance check:

- In a working Moxfield UI, import a native list with its commander, record whether designation is preserved or needs a separate action, and update guidance only from that result.

## [B15] Make review progress and results easier to act on

**Complexity:** Medium · **Value:** High · **Delivery risk:** Low — Layout and feedback changes inside the existing three-step review.

The 2026-10-04 interaction review (Chrome, `chore/todo-shipping@64efe8f`, 97-card Teysa Karlov import) found that Deck review hides its key actions and results.

- Stop the overview grid from stretching every panel to the height of Role coverage. At 1440px, "At a glance" and "Mana-value curve" left about 600px of empty boxes.
- The 1 Diagnose / 2 Choose changes / 3 Confirm stepper looks like tabs, but its steps are plain list items. Make them links, or keep a "Choose changes" action in the sticky footer. Today the only way forward is a button at the end of a 5,300px page.
- After "Apply", show a confirmation such as "Added Orzhov Enforcer · Undo", and offer the next step. Today the page jumps back to the top of Diagnose and only the "Change history (1)" count changes.
- When the deck is below 100 cards, open with a finding that names the gap (for example, "3 slots open") and suggests additions to fill it. The 97-card deck got only one-for-one swaps, so no suggested swap could complete it.
- Make the star ratings on additions readable. Filled and empty stars are almost the same colour, so every row looks like five stars. Add a text rating or raise the contrast.
- Hide "Move cut cards to the sideboard" when there are no cuts.
- Give "No theme selected — Choose a theme to check its cards" an action that opens the theme picker.

Current context: `src/features/builder/DeckDoctorView.tsx` and `DeckReviewCard.tsx` render the review; `docs/agents/ui.md` covers full-page workflows.

Acceptance checks:

- At 1440px, no overview panel is more than about 100px taller than its content.
- A player can move between steps without scrolling to the end of Diagnose.
- Applying changes shows what changed and offers an undo, and the deck and change history agree.
- A 97-card deck shows a fill-the-gap finding with add-only suggestions.

## [B16] Check role tags and cut flags against real decks

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — Role detection feeds labels, targets, findings, and swaps; any fix needs fixtures that players agree with.

Wrong role tags now show up in the most visible parts of the app. Seen with Teysa Karlov:

- Rally the Ancestors is labelled "Interaction · Fills a needed role", and a swap that adds it claims "Board wipes 2 → 3". Cutting Sun Titan claims "Targeted removal 11 → 10".
- Fountainport (a land) shows the "Card draw" label in the batch, and Carrier Thrall shows "Land or mana".
- Liesa, Shroud of Dusk is flagged as having "no detected theme, role, or synergy link", although she is a death-trigger payoff in a sacrifice deck, and the top swap cuts her.
- "May be difficult to cast" flags Requiem Angel, Butcher of Malakir, and Sun Titan only for being "well above the deck average". Six-drops are normal top end in a deck averaging 2.9.

Investigate first: collect five or six representative decks, label each card's roles by hand, and compare them with the detector. Go/no-go: fix detection where the labelled set shows a clear rule. Otherwise, show lower-confidence roles more cautiously instead of stating them as facts in swap deltas.

Current context: role detection lives in `src/deck-analysis.ts` and the scoring/context modules; findings and swaps come from `src/deck-doctor.ts` (B10). Read `CONTEXT.md` before changing role heuristics.

Acceptance checks:

- The labelled fixtures pass for the roles shown in batch labels, sidebar targets, and swap deltas.
- Rally the Ancestors is not counted as a board wipe, Sun Titan is not counted as targeted removal, and a death-trigger payoff in a sacrifice deck is not flagged as unlinked.
- Curve findings flag cards relative to a normal Commander top end, not only to the deck average.

## [B17] Make mana and land guidance agree

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Presentation and one target rule; the analysis data already exists.

- The sidebar shows "Suggested lands 39-41" next to a fixed Lands target of 35 (`landRange` in `src/deck-analysis.ts` versus the `lands: 35` default). Use one number, or make the target follow the suggestion until the player edits it.
- The sidebar Sources bar shows blue, red, and green sources (7 each) for a white-black deck, because Command Tower, Exotic Orchard, and Fellwar Stone count as any colour. Show only colours inside the commander's identity, plus colourless.
- The review's Mana costs panel lists Colourless and Snow rows with 0 symbols. Hide rows that have no demand. Done: released in `main@2e9f7c0` and verified on the live review.

Acceptance checks:

- On the same deck, the sidebar and review agree on the land target.
- A two-colour deck shows no off-identity source counts.

## [A16] Make batch decisions and card tiles unambiguous

**Complexity:** Low · **Value:** High · **Delivery risk:** Low — Styling and copy on the existing recommendation tile.

- A selected Later has `aria-pressed="true"` but looks the same as an unselected button; only the tile dims. Add, Later, and Ignore each need a clearly selected state in light and dark mode.
- In light mode, Ignore has a transparent border and grey text, so it looks disabled.
- One tile per batch can show a "Recommended" badge with no explanation, although every tile is a recommendation. Explain it or remove it.
- The "Added to deck" status label crowds the role label above the decision buttons.
- Pressing "Next recommendations" quietly treats undecided cards as Later. Say so, for example "1 undecided card will come back later".
- A recommended legendary card can show a red alert listing about 45 deck cards ("Cannot use as commander: colour identity omits Black, required by …") before the player has done anything. Show a short reason and keep the full list behind a disclosure, or hide the action when promotion is impossible.

Current context: recommendation tiles render in `src/features/builder/`; the promotion check is in `src/domain/commander-promotion.ts`.

Acceptance checks:

- A screenshot of a batch with one card set to each of Add, Later, and Ignore shows every choice without hover, in light and dark mode.
- No recommendation tile shows a multi-line error before the player interacts with it.

## [A17] Make import forgiving and transparent

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Uses the existing Scryfall collection lookup and autosave drafts.

- "Brightclimb Pathway" returned "Not found", and that one miss blocked the whole 97-card import. Match double-faced cards by their front-face name, and let the player import the cards that matched while listing the misses.
- Importing over a deck in progress replaced it without asking. The earlier deck was kept as a separate autosave, but nothing said so. Confirm before replacing, and say where the previous draft went.
- The Cancel button in the import dialog has an unthemed grey fill (`rgb(107,107,107)`). Use the shared secondary button style.

Current context: `src/deck-import.ts` parses lists; A14 autosaves in `src/deck-state.ts` keep earlier drafts.

Acceptance checks:

- A list with Pathway, modal double-faced, and split-card front names imports them.
- A list with one unknown card offers "Import 96 found cards" and names the miss.
- Importing over an active deck asks first and names the draft that keeps the previous deck.

## [A18] Fix narrow-screen layout on the start and builder screens

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — CSS and layout order; checked in a 390px frame.

Checked at 390px wide in a same-origin frame, because the test browser ignores window resizing.

- The start screen panels overflow by about 10px (`article.start-panel` right edge at 385px with a 375px viewport), which causes horizontal scrolling.
- The header wraps into four rows (about 240px). The deck-progress status shrinks to 9px wide, so "98 / 100 cards" disappears.
- On the builder, Deck overview starts about 5,770px down and the deck list about 6,650px down an 11,700px page, so targets and progress are out of sight while the player decides on cards. Add a compact progress and targets summary near the batch, or a sticky deck bar.
- The restored-draft banner adds about 200px above the commander before any content.

Acceptance checks:

- At 390px, no screen scrolls horizontally.
- The header stays at two rows or fewer and keeps the card count visible.
- While viewing a batch at 390px, the player can see the card count and the shortest target without scrolling more than one screen.

## [A19] Start-screen keyboard and screen-reader state

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Attribute and focus changes; coordinate with the in-progress A2/A9 branch.

- Theme chips and colour buttons show their selected state only through a CSS class. Add `aria-pressed`. The colour buttons also lack `type="button"`.
- Pressing "Choose" with an empty search does nothing and gives no feedback.
- Arrow keys do not move through commander search results. Use the combobox/listbox pattern or say how many results appeared.
- After a commander is chosen, focus falls to `<body>`. Move it to the builder's main heading, as Deck review already does with its step headings.

Current context: `src/features/start/StartView.tsx`. The `feat/a2-a9-first-use` worktree has uncommitted start-screen changes, so land this after or alongside A2/A9.

Acceptance checks:

- A screen reader announces which theme and colours are selected.
- A keyboard-only player can search, pick a commander with arrow keys and Enter, and land on the builder heading.

## [B18] Move saved decks and autosaves out of localStorage

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — Persistence, migration, and cross-tab sync change together; an error loses player decks.

On the live site, localStorage held about 5.0M characters, which is the browser's limit. Saved decks used 3.66M, the current deck state 948K, and each autosave about 200K. The app then showed "Autosave unavailable. Export your deck before closing this tab." The stored deck state held a 100-card deck while the page showed a 3-card draft, so recent saves may have failed silently.

Two causes add up: localStorage is capped at about 5MB per origin, and each saved card stores its full Scryfall data (about 4.8K per card), plus a recommendation queue of up to about 300 cards.

- Move saved decks, autosaves, and the current deck state to IndexedDB. Its quota is a share of free disk space, usually hundreds of megabytes or more, and it stores structured objects without JSON string limits. Keep small display preferences (`theme`, `option:*`) in localStorage.
- Store compact deck state: card identity (Scryfall ID or name plus printing and finish), counts, and player decisions. Rehydrate card details through the existing Scryfall cache instead of persisting full card objects. Decide whether the recommendation queue is persisted or rebuilt.
- Use a small wrapper over the native IndexedDB API; avoid a new dependency unless it clearly saves code.
- Migrate existing localStorage data once, verify the copy, then remove the old keys. Keep the original data if migration fails.
- Replace the `storage` event in `src/app/useWorkspaceState.ts` with `BroadcastChannel` notifications; `src/autosaves.ts` already uses a channel.
- Request persistent storage with `navigator.storage.persist()`, and show usage from `navigator.storage.estimate()` in Save/load (see B29).
- Keep the quota-error path: the "Autosave unavailable" message must still appear if a write fails.

Current context: `src/deck-state.ts` (`saveDeckState`, `loadSavedDecks`, `deckStateForStorage`) and `src/autosaves.ts` (workspace autosaves, retention, quota retries) both use the synchronous `StorageLike` interface. Moving to async storage changes every caller.

Acceptance checks:

- A browser profile with the current 5M-character data migrates without loss: every saved deck and autosave opens with the same cards, printings, and decisions.
- Saving 20 complete decks and 10 autosaves succeeds with no quota error.
- Two open tabs see each other's saves and autosaves.
- A failed IndexedDB write shows the existing autosave warning.

## [B19] Consistent card tiles; return the deck list to a condensed text list

**Complexity:** Medium · **Value:** High · **Delivery risk:** Low — Shared component and styles across existing screens.

The app draws cards in five styles: start-screen commander tiles, recommendation tiles, search results, review cut/addition tiles, and deck-list tiles. Each has its own image size, caption position, badge style, and selection control, so the screens feel like separate tools.

- Define one card-tile component with deliberate size variants (for example, large for recommendations and small for grids) and shared caption, mana, badge, and selection slots. Use it on the start, search, and review screens.
- Revert the builder deck list to the text-focused list it was before `2b94cbc` (B11): one dense line per card with name, mana cost, and a remove action. Drop the thumbnail tiles. Card names keep `CardReference` hover previews and details.
- Keep recommendation tiles large (an intentional choice) and keep their full rules text, because some printings are hard to read.

Current context: deck list in `src/features/builder/BuilderView.tsx` (`deck-card-tile`); review tiles in `DeckReviewCard.tsx`; search in `CardSearchView.tsx`; start grid in `src/features/start/StartView.tsx`; styles in `src/styles/cards.css`.

Acceptance checks:

- A 100-card deck list fits in about a third of its current height at 1440px.
- Start, search, and review grids use the same tile component; screenshots show matching caption, mana, and selection placement.

## [B20] Replace the 0–100 recommendation score display

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Presentation only; scoring is unchanged.

First-batch cards score 5 or 8 out of 100, and theme picks 25–35, so good recommendations look poor. The radar chart turns into a single line when most factors are zero, and one row showed `Preferences 7.199999999999999 / 10`.

- Remove the /100 total and the radar chart from tiles. Lead with the existing reason sentence.
- Move the factor breakdown behind a disclosure such as "Why this card", with rounded values.
- If a summary signal is needed, use a relative label within the batch or queue (for example "Top pick") rather than an absolute score.

Current context: `src/features/score/ScoreBreakdown.tsx`.

Acceptance checks:

- No tile shows an out-of-100 score or radar chart by default.
- Every breakdown value shows at most one decimal place.

## [B21] Shared text components for consistent typography

**Complexity:** High · **Value:** Medium · **Delivery risk:** Medium — Touches most screens; needs a type scale agreed before migration.

Rendered text uses ten sizes from 10px to 36px. About 90 visible text elements on one review screen are 10–12px, including key data such as target counts and "Show N in deck". Small muted text in dark mode is hard to read.

- Define a type scale of five or six steps and name them by use, for example page title, section heading, card name, body, data label, and caption.
- Create shared text components or classes for those uses, with light and dark colours, and migrate screens to them.
- Set a minimum size for readable data (suggested 13px) and keep 11px or smaller only for decorative labels.

Acceptance checks:

- Rendered screens use only the agreed sizes.
- Target counts, deck counts, and mana labels meet WCAG AA contrast in light and dark mode.

## [B22] Investigation: button hierarchy and primary-action use

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — A spike with prototypes; no committed implementation.

Primary (filled) styling is overused or placed on the wrong action: "Skip – use current settings" on the play-style step, "Back to builder" in Deck review, and twelve "Add to deck" buttons on one search page.

- Audit every screen's buttons and propose rules: one primary per view for the next step, secondary for alternatives, quiet for repeated per-item actions, and a separate style for destructive actions.
- Build a throwaway prototype of two or three screens with the proposed rules for review.

Go/no-go: implement only after the proposal and prototype are reviewed and the rules are agreed. Record them in `docs/agents/ui.md`.

## [B23] Consistent content widths and alignment

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Layout CSS across builder, review, and search.

- The builder column is about 1220px wide with a sidebar, while the deck list, its progress bar, and its section dividers each end at different widths. Deck review fills the full width.
- Small status labels ("Batch 2", "0 findings · 0 changes") sit alone at the far right of the page header.
- Define shared page and content widths and apply them to the builder, deck list, review, and search. Place status labels next to the heading they describe.

Acceptance checks:

- At 1440px and 2560px, section dividers, progress bars, and panels on each screen share left and right edges.

## [B24] Document repeated role-target figures for a decision

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Documentation and screenshots only.

Before a deck reaches 100 cards, Deck review shows the same five role targets three times: as "add N" chips, in Role coverage, and in the builder sidebar (which also shows Deck targets).

- Write a short doc in `docs/` listing every place role targets, land counts, curve, and colour balance appear, with screenshots and what each place is for.
- Propose options: one source per screen, linked summaries, or keeping the repetition where it supports a different task.

Go/no-go: change the UI only after the doc is reviewed and an option is chosen.

## [B25] Review confirmation dialogs for consistency

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Inventory, proposal, then small changes.

"Start a new deck" and the autosave-limits form use the browser's `window.confirm`; other confirmations use themed dialogs or inline two-step buttons (deck-list removal). The native dialog blocks the page and also stalls browser automation.

- List every confirmation: `src/app/deck-actions.ts` and `src/features/modals/SavedDecksModal.tsx` use `window.confirm`, plus inline confirmations and themed modals.
- Propose one pattern for each risk level, for example undo for reversible actions, an inline two-step for small deletions, and a themed modal for workspace-level changes.

Go/no-go: implement after the proposal is agreed. Acceptance check: no `window.confirm` remains in `src/`.

## [A20] Clearer captions on start-screen commander tiles

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Copy and layout in one grid.

Every commander tile repeats "Scryfall commander search" under the name, which tells the player nothing.

- Remove the source line, or replace it with useful context such as the colour identity or the matched theme.
- Keep the commander name readable at one or two lines.

Current context: `src/features/start/StartView.tsx`.

## [A21] Simpler "Choose" button on commander tiles

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — One button's content and layout.

The button repeats the full commander name and mana cost, wraps to three lines, and sits at a different height in each tile.

- Label it "Choose" and give it an accessible name that includes the commander.
- Align buttons to the bottom of each tile so a row lines up.

Acceptance check: every button in a row shares the same height and baseline.

## [A22] Size the start screen as a full page

**Complexity:** Medium · **Value:** High · **Delivery risk:** Low — Layout of an existing screen.

Choosing a commander is a key step, but the start screen sits in a 675px column. On a wide display the commander images are too small to read.

- Lay it out as a full page that uses the shared content width (B23): filters beside or above a wide grid, with larger card images.
- Keep the layout working at narrow widths (A18).

Acceptance check: at 1440px the commander grid shows at least as many columns as today, with images at least 50% larger.

## [A23] Consistent header labels between start and builder

**Complexity:** Low · **Value:** Low · **Delivery risk:** Low — Copy only.

The start header shows "Import deck" and "Drafts / saved decks (0 saves)"; the builder shows "Import" and "Save / load". Use the same label for the same action on every screen.

## [A24] Start the builder at the top after choosing a commander

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Scroll handling on view change.

After a commander is chosen, the builder keeps the start screen's scroll position, so the header is cut off. Scroll to the top when the view changes, and keep it compatible with A19's focus handoff.

## [A25] Correct card-count wording

**Complexity:** Low · **Value:** Low · **Delivery risk:** Low — Copy fix.

The deck heading shows "1 cards". Use correct singular and plural forms here and in other counts ("1 finding", "1 change", "1 selected").

## [A26] Clearer play-style cards

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Copy and layout on one step.

The Casual, Upgraded, and High power cards are tall boxes with one line of jargon each, such as "Core · Theme first. Exclude Game Changers, tutors and extra turns."

- Lead with what the player gets in plain words, then list the settings in a smaller line.
- Size the cards to their content.
- See B22 for the "Skip – use current settings" button style.

Current context: `src/features/builder/PlayStyleStep.tsx`. Read `CONTEXT.md` before describing brackets or Game Changers.

## [A27] Accurate builder heading during setup and loading

**Complexity:** Low · **Value:** Low · **Delivery risk:** Low — Heading copy by state.

The builder header shows "Next pick: Add to your deck" during the play-style step and while the first batch loads. Show headings that match the state, for example "Choose a play style" and "Finding cards…".

## [A28] Calm card-data check status

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Status styling and placeholder state.

While saved card data is checked, a red banner says "Checking current card data. Cards and choices are kept." and the sidebar mana curve is empty with "Avg 0.0", even on a 98-card deck. When the check ends, the banner disappears and the page shifts.

- Show the check as neutral status that does not move the layout.
- Keep the last known curve in the sidebar, or show a loading placeholder instead of zero values.

Acceptance check: reloading a 98-card draft never shows "Avg 0.0" or a red banner.

## [A29] Less prominent "Start over"

**Complexity:** Low · **Value:** Low · **Delivery risk:** Low — Button style.

"Start over" is red-tinted in the header on every builder visit, so it is the most eye-catching action. Style it as a normal header action and keep any warning for the confirmation step (B25).

## [A30] Stop card art overlapping tile controls

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Tile layout CSS.

The first recommendation's card image overlaps its "More like this" button. Keep images and their hover enlargement clear of the decision buttons, in light and dark mode.

## [A31] Card details from recommendation names

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Reuse `CardReference`.

Recommendation card names are plain `<h3>` headings, so they neither preview the card nor open details, unlike card names elsewhere. Render them with `CardReference` as `docs/agents/ui.md` requires.

## [A32] Intro guide placement

**Complexity:** Low · **Value:** Low · **Delivery risk:** Low — Popover positioning.

The intro guide's first step covers the art and name of the card it describes. Place the popover so the target control and its card stay visible.

Current context: `src/features/builder/IntroGuide.tsx`.

## [A33] Move the API request indicator out of the main header

**Complexity:** Low · **Value:** Low · **Delivery risk:** Low — Move one control.

The header shows a network icon with a count badge for EDHREC and Scryfall request activity. It looks like a developer tool. Move it to the Display menu or a footer, and keep a quiet sign when requests are throttled or failing.

Current context: `src/shared/RequestActivityIndicator.tsx`.

## [B26] Readable search filters

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Layout and labels in the search view.

- The filter column is about 175px wide and scrolls inside the page. Widen it, or move filters into a collapsible top panel, so it does not scroll separately.
- The "Need" dropdowns beside the name and mana-value filters are unexplained. Use clear labels such as "Must match" or "Exclude".
- The white colour row shows only an icon; other rows have text labels. Label every row.
- Put the "Search cards" button next to the name field or search as the player types.

Current context: `src/features/builder/CardSearchView.tsx`, `src/styles/card-search.css`.

## [B27] Clearer search results and actions

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Copy and action styling.

- Replace "135 available of 135 loaded · 135 Scryfall matches" with plain wording, such as "135 cards".
- Each result has a "Select" checkbox and a filled "Add to deck" button. Keep one direct action per tile, show bulk selection only when the player turns it on, and use a quiet button style (see B22).

## [B28] Deck review on small decks

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Entry-point state and messaging.

At 3 of 100 cards, Deck review shows mostly empty panels and misleading checks, such as "Mana sources found ✓" from one source.

- Below a minimum size (suggested about 60 cards), either disable the Deck review entry point with a reason or open a short summary that says the full review needs more cards.
- Decide between blocking and warning during implementation; warning keeps access for players who want early checks.

Acceptance check: a 3-card deck never shows a green success check based on its contents.

## [B29] Fix the remaining dialog issues

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Several small changes in existing dialogs.

- Save/load: some deck thumbnails do not load (Saheeli and Veyran on the live site). Show a fallback image.
- Save/load: two drafts are both titled "Teysa Karlov". Add the theme or last change to the title, or show the card count and time more prominently.
- Save/load: the autosave limit settings sit between the draft and manual-save lists. Move them to the end or behind a disclosure.
- Save/load: show storage used and available (after B18).
- Export: an empty deck shows a blank list and an active "Copy to clipboard" button. Show an empty-state message and disable copying.
- Recommendation settings: the set picker scrolls inside the scrolling dialog. Let the dialog scroll once, or make the set list a separate full-page step.

Current context: `src/features/modals/`.

## [B30] Plain labels for review additions

**Complexity:** Low · **Value:** Medium · **Delivery risk:** Low — Copy only.

Every candidate in "Select additions" is labelled "Replacement", which adds nothing and suggests a cut is required. Remove the label, or use labels that tell candidates apart, such as the role or theme they fill.

Current context: `src/features/builder/DeckReviewCard.tsx`, `DeckDoctorView.tsx`.

## [B31] Better layout for review additions

**Complexity:** Medium · **Value:** High · **Delivery risk:** Low — Layout of one review section, using B19's tile.

A 98-card Teysa Karlov deck showed 156 additions across 13 pages of small tiles, with star ratings that are hard to read (also noted in B15).

- Group candidates by the role or theme they fill, with the strongest few shown first and "Show more" per group, instead of numbered pages.
- Use the shared card tile (B19) at a size where card text is readable on hover or focus.

Acceptance check: a player can see the top candidates for each open role without paging.

## [B32] Step-heading focus style in Deck review

**Complexity:** Low · **Value:** Low · **Delivery risk:** Low — CSS.

When a review step's heading receives focus programmatically, it shows a thick white outline in dark mode. Hide the outline for script-set focus on headings (`tabindex="-1"`) while keeping `:focus-visible` outlines on controls.

## Migrated GitHub issues

- **#1 — Make recommendations theme-first and collection-aware:** the scoring, queue, collection, persistence, and preference-learning behavior is implemented and tested; no remaining scope needs a TODO.
- **#2 — Refactor app into cohesive modules and readable source formatting:** the main extraction and formatting work landed. The remaining view, style, and TSX-check gaps are tracked in B4.

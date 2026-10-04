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

The remaining UX items come from the 2026-10-04 Chrome interaction review of `chore/todo-shipping@64efe8f`. Release evidence and nonblocking follow-ups are in [the acceptance record](docs/completed-features-acceptance-2026-10-04.md).

| Order | ID  | TODO                                   | Complexity | Value  | Delivery risk | Reason                                                                             |
| ----- | --- | -------------------------------------- | ---------- | ------ | ------------- | ---------------------------------------------------------------------------------- |
| 1     | A6  | Signature-card player review           | High       | High   | Medium        | Technical validation is complete; representative-player relevance is not verified. |
| 2     | A15 | Remaining Moxfield verification        | Medium     | Medium | Medium        | Policy/provider fixes are implemented; browser access blocked the import check.    |
| 3     | A16 | Clear batch decisions and tile states  | Low        | High   | Low           | Most-used screen; selected Later and Ignore need distinct states.                  |
| 4     | B15 | Actionable review progress and results | Medium     | High   | Low           | Review navigation, feedback and incomplete-deck guidance.                          |
| 5     | B16 | Role-tag and cut-flag accuracy         | High       | High   | Medium        | Investigate labelled real decks before changing heuristics.                        |
| 6     | B17 | Consistent mana and land guidance      | Low        | Medium | Low           | Align existing targets and identity-based presentation.                            |
| 7     | A17 | Forgiving, transparent import          | Medium     | Medium | Low           | Front-face matching, partial imports and replacement confirmation.                 |
| 8     | A18 | Narrow-screen layout                   | Medium     | Medium | Low           | Keep progress visible and remove overflow.                                         |
| 9     | A19 | Start-screen keyboard and SR state     | Low        | Medium | Low           | Finish result navigation and focus handoff on the new discovery flow.              |

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
- The review's Mana costs panel lists Colourless and Snow rows with 0 symbols. Hide rows that have no demand.

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

## Migrated GitHub issues

- **#1 — Make recommendations theme-first and collection-aware:** the scoring, queue, collection, persistence, and preference-learning behavior is implemented and tested; no remaining scope needs a TODO.
- **#2 — Refactor app into cohesive modules and readable source formatting:** the main extraction and formatting work landed. The remaining view, style, and TSX-check gaps are tracked in B4.

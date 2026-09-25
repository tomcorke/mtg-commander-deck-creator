# TODO

## How to maintain this file

- Keep one independently deliverable goal per `## [ID]` section. Use stable IDs: A for recommendations and first-use flow; B for review and follow-on workflows. Add the next number in the matching group; do not renumber or reuse IDs.
- Put ratings directly below each title using `**Complexity:** … · **Value:** … · **Delivery risk:** … — short rationale.`
- Give each item a concise goal, required behavior, relevant current context, and testable acceptance checks. Use bullets for requirements and checks; include source paths when they clarify existing behavior.
- Mark uncertain work as an investigation with a go/no-go condition. Do not present a speculative approach as a committed implementation.
- Update the suggested order when ratings, dependencies, or scope change.

## Rating key

Rate each dimension Low / Medium / High:

- **Complexity:** Low is localized work; Medium spans connected parts; High is cross-cutting or algorithm-heavy.
- **Value:** Low benefits a narrow case; Medium meaningfully helps a subset of players; High improves a core workflow or deck quality.
- **Delivery risk:** Low means a clear path and existing patterns; Medium means material assumptions need validation; High means uncertain feasibility or data quality could consume substantial effort and still produce little value.

## Suggested order

Suggested sequence balances user value, delivery risk, and dependencies. Revisit it as estimates change.

| Order | ID  | TODO                                  | Complexity | Value  | Delivery risk | Reason                                                                                |
| ----- | --- | ------------------------------------- | ---------- | ------ | ------------- | ------------------------------------------------------------------------------------- |
| 1     | A1  | Land and mana-support recommendations | High       | High   | Medium        | Addresses core deck usability; existing land planning limits scope.                   |
| 2     | B1  | Detailed deck review                  | High       | High   | Medium        | High-value foundation for import review and Deck Doctor; keep goldfish optional.      |
| 3     | B2  | Import-to-review flow                 | Medium     | Medium | Low           | Bounded follow-up once B1 exists.                                                     |
| 4     | A2  | Initial user flow                     | Medium     | Medium | Medium        | Useful onboarding improvement; intent mapping and tour compatibility need validation. |
| 5     | B3  | Deck Doctor                           | High       | High   | High          | Defer until review signals are trustworthy; swap quality needs validation.            |
| 6     | B4  | Finish builder-view module ownership  | High       | Medium | Medium        | Complete remaining refactor seams after the higher-value product work.                |

## [A1] Improve land and mana-support recommendations

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — The existing basic-land planner and mana data provide a base; reliable castability scoring still needs judgment calls.

The builder can recommend on-theme creatures without checking whether the deck has enough mana to cast them. It can also leave the deck below its land target without reliably offering enough lands, especially basics. Weak ramp makes expensive cards harder to cast; weak draw makes it harder to find lands, ramp, and other needed cards. Recommendations should account for those gaps alongside theme and commander synergy.

### Required behavior

- Treat lands as a recommendation need. Use the current editable land target and remaining deck slots. Surface enough legal lands to address the gap, including basic lands; do not rely on an occasional `Land or mana` card in a batch.
- Distribute basic lands using commander colour identity and the deck's coloured mana requirements. Preserve basic-land quantities, allow repeat copies, and never exceed the target or the 100-card deck limit.
- Judge creature suggestions against the deck's mana support. Consider land count, ramp, curve, mana value, and coloured pips. Do not force a creature into a batch when its mana demands are a poor fit and useful support cards are available. Avoid a blanket ban: affordable, castable creatures can still be good recommendations.
- Treat card draw as consistency and access to resources, not as mana production. When draw is below target, make draw support more competitive with redundant theme cards.
- Keep commander legality, selected deck targets, recommendation style, and theme/synergy preferences in view. Recommendations should return to normal theme and synergy priorities as support gaps close.

### Existing implementation to build on

- `src/deck-analysis.ts` defines editable targets (defaults: 35 lands, 10 ramp, 10 draw), role counts, mana curve, coloured mana requirements, and `deckRoleBoosts`. `rolesForCard` currently identifies ramp and draw with card-data fields and rules-text heuristics.
- `basicLandPlan` already calculates a basic-land count to fill the target gap and distributes it by commander colour identity and coloured mana demand. `src/features/builder/BuilderView.tsx` exposes this through a separate “Fill to land target” action after five non-land cards; it is not guaranteed by normal recommendation batches.
- `src/domain/recommendation-queue.ts` builds four-card batches, generally reserving up to three non-mana picks before trying one `Land or mana` pick. The creature-inclusion option can reserve a creature without considering whether its mana cost fits the deck. Initial and displayed-batch scoring set the land role boost to zero (`src/app/recommendation-actions.ts`, `src/app/useBuilderData.ts`).
- EDHREC is the primary recommendation source; Scryfall supplies card details and fallback recommendations. Keep this client-only. Useful existing card data includes mana cost, mana value, produced mana, colour identity, and Oracle text.

### Acceptance checks

- A deck below its land target gets actionable land recommendations or a basic-land fill that reaches the target without exceeding 100 cards. Basic-land colours stay within commander identity and follow coloured mana demand; colourless decks use Wastes.
- When land, ramp, or draw support is deficient, suitable support cards can outrank redundant picks. An expensive, colour-intensive creature is not forced into a batch when the deck cannot reasonably support it; cheaper suitable creatures remain eligible.
- Once support needs are met, theme and commander-synergy recommendations recover their normal priority. User-edited targets and recommendation settings still apply.
- Cover mono-colour, multicolour, and colourless decks; decks below, at, and above their land targets; and nearly full decks in tests.

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

## [B1] Add a detailed deck review

**Complexity:** High · **Value:** High · **Delivery risk:** Medium — Static analysis can reuse builder data; goldfish simulation is uncertain and should remain a go/no-go investigation.

- Make deck review available at any time, including before the deck is complete.
- Open review automatically when the main deck first reaches 100 cards, whether the player fills it manually or imports a complete list. Keep it available afterward without reopening it on every render.
- Go beyond the builder sidebar: explain deck strengths and risks using mana curve, land/ramp/draw coverage, coloured requirements and sources, theme and keyword coverage, and other relevant card-type counts. Make findings understandable and actionable.
- Offer an optional goldfish simulation only if investigation shows a shallow model can provide useful guidance. Test a model based on available card tags, land/mana/ramp roles, creatures, keywords, and other card types. Compare it with simpler static analysis first. Do not present a heuristic as a full rules simulation or a win-rate estimate; show its limits and assumptions.

Current context: the builder already shows a curve, coloured mana analysis, editable role targets, and gap guidance. At 100 cards it currently presents sideboard actions and a “Review and export deck” button; that button opens export, not a detailed review. `docs/recommendation-design.md` already says deck review should become the primary action at 100 cards. Card metadata and heuristic tags are available in `src/deck-analysis.ts`, `src/domain/card-model.ts`, and `src/domain/recommendation-themes.ts`. The app has no simulation engine or related dependency.

Acceptance checks:

- Players can open and close review from the builder at any deck size. Filling the main deck to 100 opens it once; sideboard cards do not count toward completion.
- Review findings link to the cards or gaps they describe and do not replace the existing detailed analysis with unexplained scores.
- If a goldfish model is retained, document what it models, test its estimates against simple known decks, and label the output as approximate. Drop it if it adds no useful information beyond static analysis.

## [B2] Connect deck import to deck review

**Complexity:** Medium · **Value:** Medium · **Delivery risk:** Low — Import already validates and loads decks; the main dependency is the review flow in B1.

Improve the handoff from import to review. After a successful import, route the player into the same review experience when the imported main deck is complete; allow partial imports to enter review manually. Preserve import errors and validation feedback, and distinguish the main deck from sideboard when checking completion.

Current context: `src/features/modals/ImportDeckModal.tsx` accepts pasted deck-list text, while `src/deck-import.ts` parses commander, mainboard, and sideboard sections. `applyImportedDeck` in `src/app/deck-actions.ts` resolves cards through Scryfall and checks commander, colour identity, and the 100-card limit. URL import is not supported in the client-only app; `docs/recommendation-design.md` lists Moxfield and Archidekt URL import as future work.

Acceptance checks:

- A complete imported deck opens the same review as a deck built in the app. A partial import remains editable and can be reviewed on demand.
- Import validation still identifies unresolved or illegal cards before replacing the current deck.

## [B3] Add Deck Doctor from deck review

**Complexity:** High · **Value:** High · **Delivery risk:** High — Heuristic tags and candidate recommendations may produce untrustworthy findings or weak swaps without substantial tuning.

Build an optional diagnostic flow from review. It should:

- Flag cards that appear weakly connected to the declared theme or deck direction, and strategies or keywords with unusually little support. Treat single-source or single-consumer findings as prompts to review, not automatic cut decisions.
- Compare mana costs and coloured requirements with the deck's lands, ramp, and curve. Highlight expensive or colour-intensive outliers that may be hard to cast consistently.
- Suggest user-approved swaps with concrete reasons: for example, replace a rarely castable or situational card with a synergistic card that improves a weak role such as draw.
- Use goldfish results only if the review investigation validates them. Otherwise explain recommendations from deck roles, tags, mana data, and synergy evidence. Never change the deck automatically.

Current context: `src/domain/recommendation-themes.ts` assigns heuristic tags and recognizes a small set of card-pair synergies. `src/deck-analysis.ts` provides curve and role counts, but these signals do not establish that a card is bad or that a keyword needs more support. Keep findings transparent and let the player decide.

Acceptance checks:

- Each finding names the cards or deck evidence behind it and states uncertainty where tag or rules-text heuristics may be incomplete.
- Swap suggestions explain both the proposed cut and addition, including the role or synergy change. Players confirm every change.
- Test cards with isolated keywords, narrow themes, colour-intensive costs, and otherwise valid exceptions to avoid treating unusual cards as automatic mistakes.

## [B4] Finish builder-view module ownership

**Complexity:** High · **Value:** Medium · **Delivery risk:** Medium — The application root is modular, but the builder view still owns several independent dialogs and the feature-level style and lint boundaries are incomplete.

Finish the remaining module-ownership work without splitting markup that has no useful seam.

### Required behavior

- Move the collection browser, card search, basic-land, and export dialogs into focused components with their related interaction state where practical. Keep `BuilderView` responsible for composing the builder workflow.
- Move responsive and theme rules from `src/styles/responsive.css` into the owning feature styles; leave genuinely shared rules in shared styles.
- Apply function-length, nested-callback, and cognitive-complexity checks to helpers and callbacks in feature TSX. Keep any exceptions narrow and documented rather than disabling checks for all feature views.

### Existing implementation to build on

- `src/features/builder/BuilderView.tsx` is about 1,770 lines and still renders the collection browser, card search, basic-land, and export dialogs.
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

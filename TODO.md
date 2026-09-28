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

Completed goals: [COMPLETED.md](COMPLETED.md) — A1, B1, B2, B3, and B5.

## Suggested order

Suggested sequence balances user value, delivery risk, and dependencies. Revisit it as estimates change.

| Order | ID  | TODO                                 | Complexity | Value  | Delivery risk | Reason                                                                                |
| ----- | --- | ------------------------------------ | ---------- | ------ | ------------- | ------------------------------------------------------------------------------------- |
| 1     | A2  | Initial user flow                    | Medium     | Medium | Medium        | Useful onboarding improvement; intent mapping and tour compatibility need validation. |
| 2     | B4  | Finish builder-view module ownership | High       | Medium | Medium        | Complete remaining refactor seams after the higher-value product work.                |

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

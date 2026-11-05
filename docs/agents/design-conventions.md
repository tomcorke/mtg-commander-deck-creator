# Design conventions

The shared reference for the whole-app design review (#278). Read it before starting a slice. When your slice settles a convention, update **Canonical patterns** in the same PR. `docs/agents/ui.md` holds the house rules, and this doc names the concrete component or class that meets each one.

Audit snapshot: `main@4e6fc84`, 2026-11-05. Line numbers drift, so search for class names.

Baseline screenshots stay local in `E:/working/agent-sandbox/research/design-review/baseline/` (not committed). Folders are `light/` (every state), `dark/`, `themed/` (light with commander colours, Meren of Clan Nel Toth, black-green), and `narrow/` (375×812, dark with commander colours). `outlines/<state>.txt` lists each light state's headings, controls and classes. `results-<variant>.json` records page and dialog overflow per state. Screenshot names match the state ids in **Reaching each state**. If the folder is missing on your machine, replay those scripts to regenerate it.

## Canonical patterns

Use the form in the second column. **Known divergences** lists every place that differs.

| Pattern               | Canonical form                                                                                                                                                                                                                                                  | Example                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Region heading        | `.eyebrow` paragraph (uppercase accent label) above one `h2`, sized by `--type-section`. Page titles use `--type-page-title`.                                                                                                                                   | Builder "Your deck / 84 cards"; Doctor sections           |
| Header actions        | `.export` buttons in the region's header row, beside its heading.                                                                                                                                                                                               | "Deck review" in Deck overview                            |
| Main action           | `.primary`, one per region. It confirms or commits the region's task.                                                                                                                                                                                           | Add on an offer; Import deck; Done                        |
| Navigation            | `.nav-back` / `.nav-forward`. The CSS adds the arrow segment. This covers step changes inside a mode.                                                                                                                                                           | "Back to builder"; "Next recommendations"                 |
| Secondary action      | `.export`.                                                                                                                                                                                                                                                      | Saved decks; Adjust goals and filters                     |
| Destructive action    | Provisional. Red outline: border and text from `--text-danger`, transparent fill, confirmed before acting. No shared class exists. #280 creates one and replaces this row; the nearest today is `.saved-deck-delete.confirm`, the armed second-click state.     | Saved decks Delete, once armed                            |
| Toggle / segmented    | Grouped buttons with `aria-pressed`. The selected one is tinted, never `.primary`.                                                                                                                                                                              | Add to Deck/Sideboard; Any/Must/Not                       |
| Card name             | `CardReference` (`.card-reference-name`): previews on hover or focus, opens details on activation.                                                                                                                                                              | Deck board rows; findings                                 |
| Mana cost             | `OracleText` / `ManaSymbols` with every symbol, generic included. Colour identity shows as icons only.                                                                                                                                                          | Deck board rows; tile captions                            |
| Card tile             | `CardTile` (`src/shared/CardTile.tsx`): art, then a name line, then muted detail (cost, type or reason), then actions.                                                                                                                                          | Start grid; card search; Doctor tiles                     |
| Small image + preview | `SmallCardImage`, with `placement="reference"` inside any scroll container.                                                                                                                                                                                     | Basic-land gallery; saved-deck rows                       |
| Commander context     | `CommanderCardArt` + `CommanderSummary` in `.intro.commander-header`, identical on Builder, Card search and Deck review.                                                                                                                                        | All three full-page modes                                 |
| Dialog shell          | `.modal-backdrop` > `section.export-modal[role=dialog][aria-modal][aria-labelledby]`, then `.eyebrow` + `h2`, `ModalCloseButton`, body, and footer `.export-actions` (secondary left, `.primary` right). Focus, Escape and Tab trap come from `useDialogFocus`. | Saved decks; Recommendation settings                      |
| Confirmation          | `ConfirmDialog` (`src/shared/ConfirmDialog.tsx`).                                                                                                                                                                                                               | Start over; Import and replace                            |
| Tooltip / help        | `.action-help-wrap` > trigger + `.action-help[role=tooltip]`, linked with `aria-describedby`. Shows on wrapper hover and trigger focus. It carries information only.                                                                                            | Later / Ignore help on offers                             |
| Inline confirmation   | A second click on the same button arms it (`.saved-deck-delete.confirm`, `.remove-confirm`), with a short `role=tooltip` hint. Anything heavier uses `ConfirmDialog`.                                                                                           | Saved decks Delete; deck board ×                          |
| Menu                  | A trigger button that toggles a panel of controls and closes on Escape and outside click. There's only one instance so far.                                                                                                                                     | Display menu (`DisplaySettingsMenu`)                      |
| Paging                | `Pagination` (`src/shared/Pagination.tsx`): "Showing a–b of n · Page x", Previous/Next below the grid. In-place growth uses "Show N more (M left)".                                                                                                             | Start grid; card search; Doctor candidates                |
| Loading               | `ArtLoading` for art; skeleton tiles for grids; a named status line ("Finding legal commanders…") in `role=status`.                                                                                                                                             | Start grid skeleton; recommendation loading               |
| Empty / error         | A short status saying what to do next, with the action beside it. Errors use `.form-error` (`--text-danger`) inside `role=alert`.                                                                                                                               | Start "No commanders match these filters" + Clear filters |
| Text colour           | Inherited, or `--text-muted`, `--text-accent`, `--text-danger`, `--text-success`.                                                                                                                                                                               | `src/styles/base.css`                                     |
| Inputs                | `--input-*` tokens. Component rules set size, spacing and radius only.                                                                                                                                                                                          | Every text field                                          |
| Type                  | `--type-page-title`, `--type-section`, `--type-card-name`, `--type-body`, `--type-data`, `--type-caption`. `type-scale.test.ts` rejects raw px.                                                                                                                 | `src/styles/base.css`                                     |

## Known divergences

Each entry gives the place and the owning slice. A slice either fixes it or records why the divergence stays.

**Buttons**

- Step navigation drawn as `.primary`: Doctor "Choose changes" (Diagnose footer and finding rows) and "Confirm changes" (sticky change bar). These move to the next step, so they should be `.nav-forward`. #293.
- Step navigation drawn as `.export`: Doctor "Back to Diagnose" / "Back to Choose changes". #293.
- Several `.primary` buttons in one region: Doctor "Suggested swaps" has one "Apply swap" per pair, and "Add card" per suggested addition; Saved decks has "Load" on every row. #294, #300.
- Destructive shown as red text with no outline: Saved decks "Delete" (`.saved-deck-delete-wrap`), card details "Remove from sideboard". Deck board removal is a bare × (`.deck-remove`). #300, #299, #290.
- Card search "Add to deck" is an outline button, while the builder offer's Add is `.primary` for the same action. #292.
- One-off button styles: "More like this" pill with a heart (`.similar`), "Browse these cards" (accent outline) in Recommendation settings, `.compact-action` ("Use 33", "Fill now"), `.set-affinity-button` ("Prefer this set"), `.change` link ("Change commander") next to an `.export` ("Compare commanders"). #280.
- Within one row, the "Add to" toggle and "Select several" (card search results header) use different font sizes. #292.

**Theme and type**

- 148 `color: #hex` declarations in `src/styles/` (`grep -nE '^\s+color: #[0-9a-fA-F]{3,8}' src/styles/*.css`), most of them in `modals.css`, `builder-responsive.css`, `builder.css` and `base.css`. 273 lines contain `.dark` (`grep -h '\.dark' src/styles/*.css`), 73 of them in `builder-responsive.css`. Surfaces have no background tokens. #280.

**Card tiles and grids**

- There are three tile label patterns. Start grid: name plus cost on one line. Card search: name, cost, type line, a "Rules text" disclosure, and an action. Doctor: a status pill ("In deck · flagged"), name, cost, and a fit pill. The Doctor fit pill ("★★ Possible fit") wraps to two lines at tile width. #281, #285, #292, #295.
- Name-only lists where `ui.md` asks for art: builder deck board groups (`.deck-group` rows) and Doctor flagged-card tiles in Findings (name and cost, no art). #290, #294.
- Doctor candidate grids keep fixed-width tiles and leave empty columns at 1366px. #295.

**Mana and card names**

- Cost shown as text, not symbols: Collection browser tiles ("4 mana · FRA"). #303.
- No cost at all: health-lane suggestion cards. #288.
- Card name outside `CardReference`: Collection browser tiles use a separate "View details" link. #303.

**Responsiveness**

- At 375px the top bar's `.header-actions` scrolls sideways and hides actions. #304.
- The Collection browser dialog overflows horizontally at every width. #303.

**Dialogs**

- Only `DeckCardModal`, `RecommendationSettingsModal` and `SavedDecksModal` use `useDialogFocus`. #282 owns every item below.
  - `ExportDeckModal` and `ImportDeckModal` have no Escape handler, initial focus or Tab trap. Verified in the browser: Export opens with focus on `<body>`, Tab reaches the top bar's "Display" behind the backdrop, and Escape then leaves the dialog open.
  - `ChangeCommanderModal` handles Escape through a document-level capture listener, but doesn't move focus in or trap Tab. Verified in the browser: focus stayed on the opener.
  - These hand-roll their own Escape or Tab handling: the Doctor discard prompt ("Discard your choices?", `.doctor-discard-modal` in `src/app/AppView.tsx`, state `review-exit-prompt`), the Doctor commander comparison (`.doctor-commander` in `DeckDoctorView.tsx`, state `review-compare-commanders`), `BasicLandDialog`, `CollectionBrowserDialog`, `DeckReviewHistoryModal` and `ConfirmDialog`.
- Recommendation settings scroll as a whole, so the footer ("Done") sits below the fold. #298.
- The card details eyebrow reads "Deck card" for the commander and "Card details" for a recommendation. The action row (`.deck-card-modal-actions`) butts "Move to main deck" against "Remove from sideboard" at different font sizes. #299.

**Popovers**

- Tooltips: `.action-help` (offers, request activity) is canonical. `SettingHelp` (`.setting-help-button` / `.setting-help-popover`), `.synergy-popover`, `.score-factor-tooltip` and `.similar-help` reimplement it. #282.
- Inline confirmations: `.remove-confirm` (deck board) and `.saved-delete-confirm` (Saved decks) each style their own hint. #282.
- `.settings-help`, `.import-help`, `.draft-help` and `.collection-picker-help` are inline helper paragraphs, not popovers. `.change-commander-confirm` is an inline panel.
- The offer "Synergy" popover is clipped by the card art box ("…sacrifice outlet w", "…creatures dy"). #287.

**Commander context**

- The Start continue card shows a `SmallCardImage`, the name and the counts. It has no colour identity and no `CommanderSummary`. #283.
- The commander name wraps to two lines in every mode header at 1366px ("Meren of Clan Nel / Toth"), because the summary column is narrow. #286.

**Paging, status and copy**

- The Start grid shows its count only in the footer, with no count header. Card search has one ("28 matching cards"). #285.
- Raw timestamps in UI copy: the top bar's "Saved 05/11/2026, 03:56:23 +0 -0", and the card search 429 error "…after 05/11/2026, 03:55:56). No usable retry time was exposed; this wait is an estimate." #304, #292.
- The Start top bar reads "Saved decks (0)" while an autosaved draft exists. The builder top bar has no count. The Start top bar is its own markup, not `BuilderTopBar`. #304.
- The import parse summary ("This list has 84/100…") uses the same amber warning box as the "Deck URLs are not supported" caveat. #301.

## Per-slice issues

Lens names follow `design-review.md`. Each screenshot is `<variant>/<state>.png` under the baseline folder.

### #280 Tokens, type scale and button roles

- **Theming**: 148 hardcoded `color: #hex` declarations, about 260 `.dark` overrides, and no surface tokens (see **Known divergences › Theme and type**). Code audit.
- **Hierarchy**: no shared destructive class exists, so each screen invents its own (Saved decks, card details, deck board). Create one and record it under **Canonical patterns**. `light/saved-delete-confirm.png`, `light/card-details-sideboard.png`.
- **Hierarchy**: selected theme chips on Start fill solid navy, so they read as `.primary`. `light/start-filtered.png`.
- **Hierarchy**: one-off button styles (see **Known divergences › Buttons**). `light/builder.png`, `light/rec-settings-sets.png`.

### #281 Card primitives

- **Galleries**: `CardTile` carries three label patterns: Start (name + cost), card search (name, cost, type, rules disclosure) and Doctor (status pill, name, cost, fit pill). Settle one name line plus one muted detail line. `light/start-fresh.png`, `light/card-search-results.png`, `light/review-c-choose-selected.png`.
- **Galleries**: Collection browser thumbnails are about 50px wide, too small to judge the art (owned by #303). `dark/collection-browser.png`.

### #282 Dialog shell and popovers

- **Hierarchy**: Export and Import have no focus management. Export opens with focus on `<body>`, Tab reaches the top bar behind the backdrop, and Escape leaves the dialog open (verified in the browser). Change commander handles Escape but doesn't move focus in or trap Tab (verified). Six more dialogs hand-roll Escape or Tab handling (see **Known divergences › Dialogs**). Move every dialog onto `useDialogFocus`.
- **Hierarchy**: four tooltips reimplement `.action-help`, and two inline confirmations style their own hints (see **Known divergences › Popovers**). Move the tooltips onto `.action-help`. Give the confirmations one shared hint style. The Display menu stays a menu.
- **Responsiveness**: at 375px, every core state has `scrollWidth === clientWidth` on the page and on every open dialog except the Collection browser (#303) (`results-narrow.json`). Scroll containment inside dialogs wasn't measured.

### #283 Continue building and saved decks entry

- **Selection at rest**: the continue card shows a small art thumbnail, the name and the counts, with no colour identity. It doesn't reuse `CommanderSummary`. `light/start-continue.png`.
- **Hierarchy**: "Continue building" is an `h2` with no eyebrow, while "Build from scratch" has one. The helper "Choosing a new commander keeps this deck in Autosaved drafts." floats under the buttons. `light/start-continue.png`.

### #284 Commander filters

- **Feedback**: "Clear filters" stays enabled while the status reads "All commanders". `light/start-fresh.png`.
- **Hierarchy**: the empty grid repeats "Clear filters" beside the panel's own. Keep one. `light/start-empty.png`.
- **Copy**: the theme chips are randomised on every load, so screenshots differ between runs. Decide whether that's intended.

### #285 Commander discovery grid

- **Galleries**: no count header. The count only appears in the footer ("Showing 1–12 of 175 loaded commanders · Page 1"). `light/start-fresh.png`.
- **Galleries**: one label line (name + cost) with no muted detail line. `light/start-fresh.png`.
- The empty state works ("No commanders match these filters" + Clear filters), and it is the canonical empty state. `light/start-empty.png`.

### #286 Commander header and setup

- **Hierarchy**: the commander name wraps to two lines at 1366px in every mode. `light/builder.png`, `light/card-search-results.png`, `light/review-c-diagnose.png`.
- **Hierarchy**: the Doctor header pairs a link-styled "Change commander" with an `.export` "Compare commanders". `light/review-c-diagnose.png`.
- **Hierarchy**: during the play-style step, the sidebar shows live deck targets (0/35 lands, "Fill now") for a one-card deck. `light/play-style-step.png`.
- The intro guide tour: see `light/intro-guide.png`, re-captured after the first batch.

### #287 Recommendation batch

- **Responsiveness**: at 375px the four offers stack full-height in one column, so the builder page is about 8,000px tall and Deck overview starts about 5,000px down. `narrow/builder.png`.

- **Clipping**: the "Synergy" popover is clipped by the offer's art box. `light/builder-score-popover.png`.
- **Hierarchy**: the decision buttons sit above the art and name, so the action comes before the content it acts on. Offers vary in height with the oracle text and printing block. `light/builder.png`.
- **Theming**: the programmatically focused "Finding cards…" heading draws a boxed focus ring. `light/intro-guide.png`.
- Not seen: "Suggestions unavailable". With EDHREC blocked the batch was restored from cache. See `builder-rec-unavailable`'s result in `results-light.json`.

### #288 Deck health lane

- How to reach it: the lane renders only with Priority set to Theme first, and only for queued cards that fill a role below target (state `builder-health-lane`). The audit deck's Balanced default never shows it.
- **Galleries**: suggestions stack in one column of narrow cards, leaving the right half of the dashed panel empty, and thumbnails are about 40px wide. `preview/builder-health-lane.dark-themed.png`, `light/builder-health-lane.png`.
- **Mana**: the suggestion cards show role and name but no mana cost. Same screenshots.
- **Hierarchy**: "Add" is a `.compact-action`, while the batch's Add is `.primary` for the same action. Same screenshots.

### #289 Deck analysis sidebar

- **Feedback** (behaviour bug, filed as #306): while "Checking card data…" shows, the sidebar presents zeros as facts ("Lands 0/35", "Fill to land target · 16 lands left"), and the deck board lumps cards into "Other 59". `builder-card-data-loading.light.png` (baseline root).
- **Hierarchy**: the same role metric is drawn as plain bars in the sidebar but as bordered cards with "Target met" badges in the Doctor. `light/builder.png` vs `light/review-c-diagnose.png`.
- **Hierarchy**: in Deck targets, the focused row ("Card draw") is boxed and the others aren't. `light/builder.png`.
- **Feedback**: mana curve bars peak around 20px, which is hard to read. `light/builder.png`.

### #290 Deck board

- **Galleries**: groups are name-and-cost rows with no art (`ui.md` asks for compact grids or rails). `light/builder.png`.
- **Clipping**: the sideboard column breaks "Craterhoof Behemoth" mid-word ("Craterhoo / f"). `light/builder.png`, `dark/builder.png`.
- **Hierarchy**: removal is a bare round × (`.deck-remove`), not the destructive style.

### #291 Deck needs and filter panel

- **Clipping**: in the filter panel, the sticky "Search cards / Reset filters" bar sits over the top of the "Deck needs" fieldset, leaving blank space above it and hiding the first role row. Captured after the name field took focus, so check whether the panel's own scroll causes it. `light/card-search-results.png`.

### #292 Results grid

- **Hierarchy**: "Add to deck" is an outline button, while the builder offer's Add is `.primary`. `light/card-search-results.png`.
- **Hierarchy**: "Select several" is larger than the "Add to Deck/Sideboard" toggle beside it. `light/card-search-results.png`.
- **Copy**: the 429 error prints a raw timestamp and "No usable retry time was exposed; this wait is an estimate.", and "0 matching cards" shows above it. `light/activity-indicator.png`.

### #293 Context header, step navigation and readiness

- **Hierarchy**: "Choose changes" and "Confirm changes" are `.primary` but move between steps. "Back to Diagnose" / "Back to Choose changes" are `.export`. Use `.nav-forward` / `.nav-back`. `light/review-c-diagnose.png`, `light/review-c-choose-selected.png`, `light/review-c-confirm.png`.

### #294 Diagnose step

- **Galleries**: flagged-card tiles in Findings show name and cost only, with no art. `light/review-c-diagnose.png`.
- **Hierarchy**: several `.primary` buttons in one region ("Apply swap" ×3; "Add card" ×6 on the partial deck). `light/review-c-diagnose.png`, `light/review-diagnose.png`.
- **Ergonomics**: role target inputs float outside the role cards and have no steppers. `light/review-c-diagnose.png`.
- **Hierarchy**: the seven overview cards all carry equal weight, and the mana-curve card is mostly empty. `light/review-c-diagnose.png`.

### #295 Choose changes step

- **Galleries**: the fit pill wraps to two lines ("★★ Possible / fit"). `light/review-c-choose-selected.png`.
- **Galleries**: fixed-width tiles leave empty columns at 1366px. `light/review-c-choose-selected.png`.

### #296 Confirm step and commander comparison

- **Feedback**: "Compare commanders" opens a dialog that only says "Select a theme or sub-theme to compare commander options." It offers no control to do that. `light/review-compare-commanders.png`.

### #297 Review card and history modal

- Scope: `DeckReviewCard` is the Doctor's candidate and cut tile (`.doctor-card-tile`). The builder's review entry point is the "Deck review" `.export` in the Deck overview header.
- None found in the history modal beyond **#282**'s shared focus work. Empty history: `light/review-history-empty.png`. With one change: `light/review-c-applied-history.png`.

### #298 Recommendation settings

- **Hierarchy**: each control's helper text sits on its own line below the control, and a "?" popover repeats it. `light/rec-settings.png`.
- **Hierarchy**: the footer ("Done" plus summary) scrolls with the body, below the fold. `light/rec-settings-sets.png`.
- **Clipping**: the Priority help popover covers the helper line beside it. `light/rec-settings-help.png`.
- **Copy**: "Changes apply when you close settings." uses bold amber warning styling for neutral information. `light/rec-settings-sets.png`.

### #299 Card details and comparison

- Scope: `DeckCardModal` has no comparison pair. Paired images exist only in Doctor "Suggested swaps" (#294) and the Confirm plan (#296).
- **Hierarchy**: the eyebrow reads "Deck card" for the commander and "Card details" for a recommendation. `light/card-details.png`, `light/card-details-recommendation.png`.
- **Hierarchy**: "Move to main deck" and "Remove from sideboard" touch, at different font sizes, and the remove action is red text with no outline. `light/card-details-sideboard.png`.

### #300 Saved decks

- **Hierarchy**: "Delete" is red text with no outline. On the draft open in this tab it renders greyed with no reason given. `light/saved-delete-confirm.png`.
- **Hierarchy**: "Load" is `.primary` on every row. `light/saved-delete-confirm.png`.
- **Feedback**: the empty state is text only, with no next action. `light/saved-empty.png`.
- **Identity cues**: rows show commander art but no colour identity. `light/saved-delete-confirm.png`.

### #301 Import and export

- **Hierarchy**: Import and Export have no focus management (see #282). Export opens with focus on `<body>`.
- **Feedback**: the parse summary uses the same amber box as the "Deck URLs are not supported" caveat. "Not found: …" is bold red text outside an alert box. The difference between "Import 2 found cards" and "Import deck" is unclear. `light/import-parsed.png`, `light/import-missing.png`.
- Not verified: copy confirmation. The headless clipboard was denied, and no confirmation showed. `light/export-copied.png`.

### #302 Change commander

- **Feedback**: nothing says which cards would leave colour identity before "Choose". `light/change-commander-search.png`, `light/change-commander-pick.png`.
- **Hierarchy**: Escape works, but the dialog doesn't take focus when it opens or trap Tab (see #282).

### #303 Collection browser

- **Clipping**: the dialog overflows horizontally: `scrollWidth` 1121 against `clientWidth` 1098 at 1366px, and 342 against 341 at 375px (`results-dark.json`, `results-narrow.json`).

- **Galleries**: thumbnails are about 50px wide. "View details" is a separate link, not a `CardReference`.
- **Mana**: cost shows as text ("4 mana · FRA"), not `OracleText` symbols.
- **Galleries**: there is a count header ("96 legal unique cards"), but no paging below the grid.
- Screenshots: `dark/collection-browser.png`, `light/collection-browser.png`.

### #304 App chrome

- **Responsiveness**: at 375px the top bar's `.header-actions` row scrolls sideways (`scrollWidth` 577 against `clientWidth` 330 in the builder, 365 against 330 on Start). That hides "Saved decks" and "Export deck" off-screen. `narrow/builder.png`, `results-narrow.json`.

- **Hierarchy**: the Start top bar is its own markup, not `BuilderTopBar`. It reads "Saved decks (0)" while an autosaved draft exists, and the builder bar shows no count. `light/start-continue.png`.
- **Copy**: the save status prints a raw timestamp ("Saved 05/11/2026, 03:56:23 +0 -0"). `light/saved-delete-confirm.png`.
- **Hierarchy**: the Display menu and the activity panel both render the same API table, in different popover styles. `light/display-menu.png`, `light/activity-indicator.png`.
- The card-data warning banner ("Card data warnings for N cards" + Retry) appears above the commander header during Scryfall cooldown. `light/export-copied.png` (rate-limited run).

### #305 Integration

- Reviewed at baseline: `BasicLandDialog` opened (`light/basics.png`) and with the printing gallery open (`light/basics-gallery.png`). Findings: once card data has loaded, the layout matches the playbook case study. While "Checking card data…" is still showing, though, the dialog reads "Room for 16 more lands toward your 35-land target" and offers 16 basics, even though the deck already has 35 lands (`prev/basics.loading.png`). That's a behaviour bug, filed as #306.
- The integration checks come after the slices merge: diff the cross-screen items above (commander header, card tiles, button roles, dialog shell) against **Canonical patterns**.

## Reaching each state

Run `pnpm dev` and open the app with `preview_open`. Replay a state like this:

1. Set the theme if you need one: `localStorage.setItem('option:darkMode', 'true')` and `localStorage.setItem('option:commanderStyling', 'true')`. The Display menu sets the same keys.
2. Load the route in the state's comment line (for example `#build/review`) with a full reload, so no dialog or prior step is still open.
3. Run the helpers snippet. A reload or HMR clears `window.dr`.
4. Run the state's snippet. It resolves once the target state is on screen and throws if it isn't. A `return` value is a diagnostic.

Notes:

- A T3 `preview_evaluate` call times out after 15 s, and a hidden tab throttles timers. Split long flows across several calls.
- Every load starts in "Checking card data…", with the analysis reading zero (state `builder-card-data-loading`). `dr.builderReady()` waits for card data and the first reveal.
- States in a group share one workspace and mutate it. `saved-manual` saves "Audit deck", `rec-settings-sets` ticks the newest set, `commander-alt-printing` switches the commander's printing, `review-c-applied-history` applies a change, and `builder-health-lane` switches Priority to Theme first. Re-import the deck if a later state depends on the original.
- Theme chips on Start are randomised on each load, and Scryfall and EDHREC data is live, so card names in the screenshots vary between runs.
- Fault states (`block …` in the comment line) need request interception. The T3 preview can't intercept, so use Playwright against the same dev server before loading the route:

```js
await page.route('**/json.edhrec.com/**', (route) => route.abort()) // block edhrec
await page.route('**/api.scryfall.com/cards/search**', (route) => route.abort()) // block scryfall-search
await page.route('**/api.scryfall.com/cards/search**', (route) =>
  route.fulfill({ status: 429, headers: { 'retry-after': '30' }, json: { object: 'error' } }),
) // block scryfall-429
```

The capture runner that took the baselines lives beside them (`capture.mjs`, `states.mjs`). It runs these same snippets through Playwright for every variant.

```js
window.dr = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  async wait(test, ms = 30000) {
    for (const end = Date.now() + ms; ; await dr.sleep(150)) {
      const value = test()
      if (value) return value
      if (Date.now() > end) throw new Error('timeout: ' + test)
    }
  },
  btn: (name, root = document) =>
    [...root.querySelectorAll('button')].find(
      (b) =>
        b.checkVisibility() &&
        (b.textContent.trim() === name ||
          b.getAttribute('aria-label') === name ||
          b.textContent.trim().startsWith(name + ' (')),
    ),
  async click(name, root) {
    const b = await dr.wait(() => {
      const x = dr.btn(name, root)
      return x && !x.disabled && x
    })
    b.click()
    await dr.sleep(100)
    return b
  },
  fill(el, value) {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  },
  text: (s) => dr.wait(() => document.body.innerText.includes(s)),
  sel: (s) => dr.wait(() => document.querySelector(s)),
  dialog: () => dr.wait(() => [...document.querySelectorAll('[aria-modal="true"]')].at(-1)),
  // Builder is ready once card data has loaded and the first batch has revealed.
  builderReady: () =>
    dr.wait(
      () =>
        document.querySelector('.deck-board') &&
        !document.body.innerText.includes('Checking card data') &&
        !document.body.innerText.includes('Revealing'),
      60000,
    ),
}
```

Import the partial deck (from `#start`), then the complete deck when a group needs it. `list` is the text of the matching block below.

```js
await dr.click('Import deck')
const area = await dr.sel('textarea[aria-label="Exported deck list"]')
dr.fill(area, list)
await dr.sleep(300)
const go = await dr.wait(() => {
  const b = document.querySelector('[aria-modal="true"] button.primary')
  return b && !b.disabled && b
})
go.click()
await dr.wait(() => {
  const replace = dr.btn('Import and replace')
  if (replace) replace.click()
  return location.hash.startsWith('#build') && !document.querySelector('[aria-modal="true"]')
}, 90000)
await dr.builderReady()
```

<details><summary>Partial deck: Meren of Clan Nel Toth, 84 main-deck cards + 2 sideboard</summary>

```text
Commander
1 Meren of Clan Nel Toth

Deck
1 Sol Ring
1 Arcane Signet
1 Golgari Signet
1 Cultivate
1 Kodama's Reach
1 Rampant Growth
1 Farseek
1 Nature's Lore
1 Three Visits
1 Birds of Paradise
1 Llanowar Elves
1 Elvish Mystic
1 Sakura-Tribe Elder
1 Wood Elves
1 Eternal Witness
1 Reclamation Sage
1 Beast Within
1 Assassin's Trophy
1 Putrefy
1 Doom Blade
1 Go for the Throat
1 Murder
1 Damnation
1 Toxic Deluge
1 Pernicious Deed
1 Phyrexian Arena
1 Harmonize
1 Skullclamp
1 Grim Haruspex
1 Viscera Seer
1 Carrion Feeder
1 Blood Artist
1 Zulaport Cutthroat
1 Plaguecrafter
1 Fleshbag Marauder
1 Merciless Executioner
1 Gravedigger
1 Ravenous Chupacabra
1 Shriekmaw
1 Spore Frog
1 Satyr Wayfinder
1 Stitcher's Supplier
1 Grisly Salvage
1 Buried Alive
1 Entomb
1 Animate Dead
1 Reanimate
1 Living Death
1 Command Tower
1 Evolving Wilds
1 Terramorphic Expanse
1 Llanowar Wastes
1 Woodland Cemetery
1 Golgari Rot Farm
1 Jungle Hollow
1 Overgrown Tomb
1 Twilight Mire
1 Bojuka Bog
1 Reliquary Tower
12 Swamp
12 Forest

Sideboard
1 Demonic Tutor
1 Craterhoof Behemoth
```

</details>

<details><summary>Complete deck: insert these 16 lines before the Sideboard heading of the partial list (100 main-deck cards)</summary>

```text
1 Mortuary Mire
1 Golgari Charm
1 Abrupt Decay
1 Vraska's Contempt
1 Casualties of War
1 Night's Whisper
1 Sign in Blood
1 Read the Bones
1 Village Rites
1 Deadly Dispute
1 Ashnod's Altar
1 Phyrexian Altar
1 Mind Stone
1 Fellwar Stone
1 Bone Splinters
1 Midnight Reaper
```

</details>

### Fresh workspace (new profile or after **Start over**)

```js
// start-loading · #285 · #start · capture immediately
return Boolean(await dr.sel('.commander-tile-placeholder'))
// start-fresh · #283 · #start
await dr.text('commanders shown')
// start-more-themes · #284 · #start
await dr.text('commanders shown')
await dr.click('Show more themes')
// start-creature-type · #284 · #start
await dr.text('commanders shown')
await dr.click('+ Creature type')
// start-filtered · #284 · #start
await dr.text('commanders shown')
await dr.click('Green')
await dr.sleep(1500)
document.querySelector('[aria-label="Commander filters"] button').click()
await dr.sleep(2500)
// start-empty · #285 · #start
await dr.text('commanders shown')
dr.fill(document.querySelector('input[aria-label="Search commanders"]'), 'zzqxv')
await dr.sleep(3000)
// start-hover-tile · #281 · #start
await dr.text('commanders shown')
const n = document.querySelector('.card-reference-name, [class*=commander] button')
n?.focus()
await dr.sleep(600)
return n?.className
// saved-empty · #300 · #start
await dr.click('Saved decks')
await dr.dialog()
// import-empty · #301 · #start
await dr.click('Import deck')
await dr.dialog()
// import-parsed · #301 · #start
await dr.click('Import deck')
dr.fill(await dr.sel('textarea'), list)
await dr.sleep(400)
// import-no-commander · #301 · #start
await dr.click('Import deck')
dr.fill(await dr.sel('textarea'), '1 Sol Ring\n1 Meren of Clan Nel Toth\n1 Cultivate')
await dr.sleep(400)
// import-missing · #301 · #start
await dr.click('Import deck')
dr.fill(
  await dr.sel('textarea'),
  'Commander\n1 Meren of Clan Nel Toth\nDeck\n1 Sol Ring\n1 Notacard Fakename',
)
await dr.sleep(300)
document.querySelector('[aria-modal="true"] button.primary').click()
await dr.wait(
  () =>
    document.querySelector('[aria-modal="true"] [role=alert], [aria-modal="true"] .form-error') ||
    document.body.innerText.includes('found cards'),
  30000,
)
// play-style-step · #286 · #start
await dr.text('commanders shown')
dr.btn('Choose').click()
await dr.wait(() => location.hash.startsWith('#build'))
await dr.sleep(2500)
return document.querySelector('main h2, main h1')?.textContent
// intro-guide · #286 · #start
await dr.text('commanders shown')
dr.btn('Choose').click()
await dr.wait(() => location.hash.startsWith('#build'))
await dr.sleep(2500)
const pick = [...document.querySelectorAll('main button')].find((b) =>
  /Balanced|Theme first|Continue|Start building/.test(b.textContent),
)
pick?.click()
await dr.wait(
  () =>
    document.querySelector(
      '[aria-labelledby] .modal-close, .react-joyride__tooltip, [data-test-id="button-skip"]',
    ) || /Skip|Next step/.test(document.body.innerText),
  45000,
)
await dr.sleep(800)
return pick?.textContent
```

### Partial deck (import the 84-card list first)

```js
// start-continue · #283 · #start
await dr.text('commanders shown')
// builder-card-data-loading · #289 · #build · capture immediately
await dr.sel('.deck-board')
return document.body.innerText.includes('Checking card data')
// builder · #287 · #build
await dr.builderReady()
await dr.sleep(1500)
// builder-rec-loading · #287 · #build · capture immediately
await dr.builderReady()
document.querySelector('.nav-forward').click()
await dr.sleep(150)
// builder-sideboard-target · #287 · #build
await dr.builderReady()
await dr.click('Sideboard')
// builder-score-popover · #287 · #build
await dr.builderReady()
const b = await dr.wait(() =>
  [...document.querySelectorAll('button')].find((x) => x.textContent.includes('ⓘ')),
)
b.click()
b.focus()
await dr.sleep(400)
// builder-rec-unavailable · #287 · #build · block edhrec
await dr.builderReady()
document.querySelector('.nav-forward').click()
await dr.sleep(1000)
document.querySelector('.nav-forward').click()
await dr.sleep(8000)
return document.body.innerText.includes('unavailable')
// builder-target-focus · #289 · #build
await dr.builderReady()
const b = await dr.sel('.deck-target-focus')
b.click()
await dr.sleep(2500)
// builder-board-preview · #290 · #build
await dr.builderReady()
const n = document.querySelector('.deck-board .deck-card-name')
n.scrollIntoView({ block: 'center' })
n.focus()
await dr.sleep(600)
// commander-alt-printing · #286 · #build
await dr.builderReady()
await dr.click('Show alternate printing of Meren of Clan Nel Toth')
await dr.sleep(1500)
// display-menu · #304 · #build
await dr.builderReady()
await dr.click('Display')
// activity-indicator · #304 · #build · block scryfall-429
await dr.builderReady()
await dr.click('+ Search & add cards')
dr.fill(await dr.sel('input[placeholder="Any name"]'), 'elf')
await dr.click('Search cards')
const b = await dr.sel('button[aria-label^="API requests"]')
b.click()
await dr.sleep(300)
// card-details · #299 · #build
await dr.builderReady()
document.querySelector('.deck-board .deck-card-name').click()
await dr.dialog()
await dr.sleep(1500)
// card-details-sideboard · #299 · #build
await dr.builderReady()
;[...document.querySelectorAll('.deck-board .deck-card-name')].at(-1).click()
await dr.dialog()
await dr.sleep(1500)
// card-details-recommendation · #299 · #build
await dr.builderReady()
const n = await dr.sel('.recommendations .card-reference-name, article .card-reference-name')
n.click()
await dr.dialog()
await dr.sleep(1500)
// rec-settings · #298 · #build
await dr.builderReady()
await dr.click('Recommendation settings')
await dr.dialog()
await dr.sleep(500)
// rec-settings-sets · #298 · #build
await dr.builderReady()
await dr.click('Recommendation settings')
const d = await dr.dialog()
const s = await dr.wait(() => d.querySelector('.set-picker-row input[type=checkbox]'))
if (!s.checked) s.click()
await dr.sleep(2000)
d.querySelector('.collection-pool, .set-picker')?.scrollIntoView({ block: 'center' })
// rec-settings-help · #282 · #build
await dr.builderReady()
await dr.click('Recommendation settings')
const d = await dr.dialog()
const t = await dr.wait(() => d.querySelector('.setting-help-button'))
t.scrollIntoView({ block: 'center' })
t.focus()
await dr.sleep(300)
return t.outerHTML.slice(0, 120)
// collection-browser · #303 · #build
await dr.builderReady()
await dr.click('Recommendation settings')
const d = await dr.dialog()
const s = await dr.wait(() => d.querySelector('.set-picker-row input[type=checkbox]'))
if (!s.checked) s.click()
await dr.sleep(500)
await dr.click('Browse these cards')
await dr.wait(
  () =>
    [...document.querySelectorAll('[aria-modal="true"]')].some(
      (m) => !/Loading/.test(m.innerText) && m.querySelector('img'),
    ),
  45000,
)
await dr.sleep(1500)
// saved-autosave · #300 · #build
await dr.builderReady()
await dr.click('Saved decks')
await dr.dialog()
// saved-manual · #300 · #build
await dr.builderReady()
await dr.click('Saved decks')
const d = await dr.dialog()
dr.fill(d.querySelector('input[aria-label="Deck name"], input'), 'Audit deck')
await dr.sleep(100)
await dr.click('Save deck')
await dr.sleep(600)
// saved-delete-confirm · #300 · #build
await dr.builderReady()
await dr.click('Saved decks')
const d = await dr.dialog()
const del = [...d.querySelectorAll('button')].find((b) => /Delete|Remove/.test(b.textContent))
del?.click()
await dr.sleep(400)
return del?.textContent
// export · #301 · #build
await dr.builderReady()
await dr.click('Export deck')
await dr.dialog()
await dr.sleep(300)
// export-copied · #301 · #build
await dr.builderReady()
await dr.click('Export deck')
const d = await dr.dialog()
const c = [...d.querySelectorAll('button')].find((b) => /Copy/.test(b.textContent))
c?.click()
await dr.sleep(500)
return c?.textContent
// import-over-builder · #301 · #build
await dr.builderReady()
await dr.click('Import deck')
await dr.dialog()
// change-commander · #302 · #build
await dr.builderReady()
await dr.click('Change commander')
await dr.dialog()
await dr.sleep(2500)
// change-commander-search · #302 · #build
await dr.builderReady()
await dr.click('Change commander')
const d = await dr.dialog()
const i = d.querySelector('input')
dr.fill(i, 'Golgari')
await dr.sleep(3500)
// change-commander-pick · #302 · #build
await dr.builderReady()
await dr.click('Change commander')
const d = await dr.dialog()
await dr.sleep(3000)
const c = [...d.querySelectorAll('button')].find(
  (b) => b.textContent.trim() === 'Choose' && !b.disabled,
)
c?.click()
await dr.sleep(800)
return c ? 'picked' : 'no choose button'
// start-over-confirm · #282 · #build
await dr.builderReady()
await dr.click('Start over')
await dr.dialog()
// basics · #305 · #build
await dr.builderReady()
for (let i = 0; i < 3; i++) {
  document.querySelector('button[aria-label="Remove one Swamp"]').click()
  await dr.sleep(400)
}
const b = await dr.wait(() => dr.btn('Fill now') || document.querySelector('.basic-land-button'))
b.click()
await dr.dialog()
await dr.sleep(1500)
// basics-gallery · #305 · #build
await dr.builderReady()
for (let i = 0; i < 3; i++) {
  document.querySelector('button[aria-label="Remove one Swamp"]').click()
  await dr.sleep(400)
}
const b = await dr.wait(() => dr.btn('Fill now') || document.querySelector('.basic-land-button'))
b.click()
const d = await dr.dialog()
const art = await dr.wait(() => d.querySelector('.basic-land-plan button[aria-expanded]'))
art.click()
await dr.wait(() => d.querySelector('.basic-land-art-option'), 30000)
await dr.sleep(1500)
// card-search · #291 · #build
await dr.builderReady()
await dr.click('+ Search & add cards')
await dr.text('Search cards')
await dr.sleep(1500)
// card-search-results · #292 · #build
await dr.builderReady()
await dr.click('+ Search & add cards')
const i = await dr.sel('input[placeholder="Any name"]')
dr.fill(i, 'elf')
await dr.click('Search cards')
await dr.wait(() => document.querySelectorAll('main .card-reference-name').length > 3, 30000)
await dr.sleep(2500)
// card-search-empty · #292 · #build
await dr.builderReady()
await dr.click('+ Search & add cards')
const i = await dr.sel('input[placeholder="Any name"]')
dr.fill(i, 'zzqxvnotacard')
await dr.click('Search cards')
await dr.sleep(5000)
// card-search-error · #292 · #build · block scryfall-search
await dr.builderReady()
await dr.click('+ Search & add cards')
const i = await dr.sel('input[placeholder="Any name"]')
dr.fill(i, 'elf')
await dr.click('Search cards')
await dr.sleep(5000)
// review-diagnose · #294 · #build
await dr.builderReady()
await dr.click('Deck review')
await dr.text('Findings')
await dr.sleep(2500)
// review-filtered · #294 · #build
await dr.builderReady()
await dr.click('Deck review')
await dr.text('Findings')
;(await dr.sel('.deck-review-role-filter')).click()
await dr.sleep(1500)
// review-compare-commanders · #296 · #build
await dr.builderReady()
await dr.click('Deck review')
await dr.text('Findings')
await dr.click('Compare commanders')
await dr.sleep(3000)
// review-history-empty · #297 · #build
await dr.builderReady()
await dr.click('Deck review')
await dr.text('Findings')
await dr.click('Change history')
await dr.dialog()
// review-choose-adds · #295 · #build
await dr.builderReady()
await dr.click('Deck review')
await dr.text('Findings')
await dr.click('2 Choose changes')
const boxes = await dr.wait(() => {
  const b = document.querySelectorAll('main input[type=checkbox][aria-label^="Add "]')
  return b.length > 1 && b
})
boxes[0].click()
await dr.sleep(200)
boxes[1].click()
await dr.sleep(1000)
// review-exit-prompt · #293 · #build
await dr.builderReady()
await dr.click('Deck review')
await dr.text('Findings')
await dr.click('2 Choose changes')
const boxes = await dr.wait(() => {
  const b = document.querySelectorAll('main input[type=checkbox][aria-label^="Add "]')
  return b.length && b
})
boxes[0].click()
await dr.sleep(300)
await dr.click('Back to builder')
await dr.dialog()
// review-confirm-adds · #296 · #build
await dr.builderReady()
await dr.click('Deck review')
await dr.text('Findings')
await dr.click('2 Choose changes')
const boxes = await dr.wait(() => {
  const b = document.querySelectorAll('main input[type=checkbox][aria-label^="Add "]')
  return b.length > 1 && b
})
boxes[0].click()
await dr.sleep(200)
boxes[1].click()
await dr.sleep(300)
await dr.click('Confirm changes')
await dr.text('After these changes')
await dr.sleep(1500)
```

### Complete deck (import the 100-card list first)

```js
// builder-complete · #287 · #build
await dr.builderReady()
await dr.sleep(2000)
// review-c-diagnose · #294 · #build/review
await dr.text('Findings')
await dr.sleep(2500)
// review-c-choose · #295 · #build/review
await dr.text('Findings')
await dr.click('2 Choose changes')
await dr.sleep(3000)
// review-c-choose-selected · #295 · #build/review
await dr.text('Findings')
await dr.click('2 Choose changes')
await dr.sleep(2500)
const cut = document.querySelector(
  'main input[type=checkbox][aria-label^="Cut "], main input[type=checkbox][aria-label^="Remove "]',
)
cut?.click()
await dr.sleep(300)
const add = await dr.wait(() =>
  document.querySelector('main input[type=checkbox][aria-label^="Add "]'),
)
add.click()
await dr.sleep(1000)
return [cut?.getAttribute('aria-label'), add?.getAttribute('aria-label')].join(' | ')
// review-c-confirm · #296 · #build/review
await dr.text('Findings')
await dr.click('2 Choose changes')
await dr.sleep(2500)
const cut = document.querySelector(
  'main input[type=checkbox][aria-label^="Cut "], main input[type=checkbox][aria-label^="Remove "]',
)
cut?.click()
await dr.sleep(300)
const add = await dr.wait(() =>
  document.querySelector('main input[type=checkbox][aria-label^="Add "]'),
)
add.click()
await dr.sleep(300)
await dr.click('Confirm changes')
await dr.text('After these changes')
await dr.sleep(1500)
// review-c-applied-history · #297 · #build/review
await dr.text('Findings')
await dr.click('2 Choose changes')
await dr.sleep(2500)
const cut = document.querySelector(
  'main input[type=checkbox][aria-label^="Cut "], main input[type=checkbox][aria-label^="Remove "]',
)
cut?.click()
await dr.sleep(300)
const add = await dr.wait(() =>
  document.querySelector('main input[type=checkbox][aria-label^="Add "]'),
)
add.click()
await dr.sleep(300)
await dr.click('Confirm changes')
await dr.text('After these changes')
const apply = await dr.sel('.doctor-apply')
apply.click()
await dr.sleep(1500)
await dr.click('Change history')
await dr.dialog()
return location.hash
// builder-health-lane · #288 · #build
await dr.builderReady()
await dr.click('Recommendation settings')
const d = await dr.dialog()
const priority = d.querySelector('select')
Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(priority, 'thematic')
priority.dispatchEvent(new Event('change', { bubbles: true }))
await dr.click('Done')
const lane = await dr.sel('.health-lane')
lane.scrollIntoView({ block: 'center' })
await dr.sleep(1500)
// import-replace-confirm · #301 · #build
await dr.builderReady()
await dr.click('Import deck')
dr.fill(
  await dr.sel('textarea'),
  ['Commander', '1 Meren of Clan Nel Toth', 'Deck', '1 Sol Ring'].join(String.fromCharCode(10)),
)
await dr.sleep(300)
document.querySelector('[aria-modal="true"] button.primary').click()
await dr.text('Replace the current deck?')
```

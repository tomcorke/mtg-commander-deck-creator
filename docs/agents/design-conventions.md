# Design conventions

The shared reference for the whole-app design review (#278). Read it before starting a slice. When your slice settles a convention, update **Canonical patterns** in the same PR. `docs/agents/ui.md` holds the house rules, and this doc names the concrete component or class that meets each one.

Audit snapshot: `main@4e6fc84`, 2026-11-05. Line numbers drift, so search for class names.

Baseline screenshots stay local in `E:/working/agent-sandbox/research/design-review/baseline/` (not committed). Folders are `light/` (every state), `dark/`, `themed/` (light with commander colours, Meren of Clan Nel Toth, black-green), and `narrow/` (375×812, dark with commander colours). `outlines/<state>.txt` lists each light state's headings, controls and classes. `results-<variant>.json` records page and dialog overflow per state. Screenshot names match the state ids in **Reaching each state**. If the folder is missing on your machine, replay those scripts to regenerate it.

## Canonical patterns

Use the form in the second column. **Known divergences** lists every place that differs.

| Pattern               | Canonical form                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Example                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Region heading        | `.eyebrow` paragraph (uppercase accent label) above one `h2`, sized by `--type-section`. Page titles use `--type-page-title`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Builder "Your deck / 84 cards"; Doctor sections                                                  |
| Header actions        | `.export` buttons in the region's header row, beside its heading.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | "Deck review" in Deck overview                                                                   |
| Main action           | `.primary`, one per region. A grid of independent offers has one per offer: the batch, the health lane, Doctor suggestions ("Apply swap" / "Add card"). It confirms or commits the region's task. Its fill is `var(--commander-accent, var(--action-fill))` in every context, like the `.export` and nav borders. Context rules (`.actions .primary`) change size only. `--commander-accent` is set only while commander styling is on, and themed modes still render the indigo default (#312).                                                                                                                                                                                                                                                                                                                                                                                              | Add on an offer; Import deck; Done                                                               |
| Navigation            | `.nav-back` / `.nav-forward`. The CSS adds the arrow segment. This covers step changes inside a mode. A step button stays `.nav-forward` while disabled. A forward exit at the foot of a region sits at its end; the button that commits the step (Doctor "Apply N changes") stays `.primary`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | "Back to builder"; "Next recommendations"; Doctor step buttons                                   |
| Secondary action      | `.export`. Inside a dense row (a stat, a printing, a set list) use `.compact-action`: the same colours, hover, focus and disabled rules at `--type-data` size.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Saved decks; Adjust goals and filters; "Use 33"; "Prefer this set"; "Browse these cards"         |
| Destructive action    | `.danger`: border and text from `--text-danger`, transparent fill, red tint on hover. Confirm before acting: `.danger.confirm` marks the armed second click (tint plus bold), and anything heavier uses `ConfirmDialog`. Never filled. In a list where every row carries one (the deck board ×, `.danger.deck-remove`), the outline rests at 40% and goes full red on hover, focus or arm; on a tinted surface the hover tint mixes over `--surface-panel` to keep AA.                                                                                                                                                                                                                                                                                                                                                                                                                        | Saved decks Delete; card details "Remove from sideboard"; deck board ×                           |
| Toggle / segmented    | Grouped buttons with `aria-pressed`. The selected one takes `--selected-background` and `--selected-border`, never `.primary` or a solid fill. `--selected-border` follows `--commander-accent` in light themed modes and stays `#a69fde` in dark.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Add to Deck/Sideboard; offer Later/Ignore; Start theme chips; "More like this"                   |
| Stepper               | A numeric field between two 30px `.deck-add` buttons (− before the field, + after) inside `.basic-land-stepper` or `.target-stepper`. The field stays free-form; each button disables at the field's `min` or `max`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Basic-land counts; Doctor role targets; Doctor multi-copy cuts                                   |
| Review status         | `ReviewStatus` (`DeckOverview.tsx`), a `.deck-review-status` pill: `good` (✓, `--text-success`) for detected support, `attention` (!, `--text-warning`) for a possible gap, `neutral` (·) for no signal. Heuristic checks are never `--text-danger`; that colour means an error.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Doctor overview checks; finding kind pills                                                       |
| Card name             | `CardReference` (`.card-reference-name`): previews on hover or focus, opens details on activation. In a dense list row, pass `thumbnail` so the row shows art that previews and opens like the name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Deck board rows                                                                                  |
| Mana cost             | `OracleText` / `ManaSymbols` with every symbol, generic included. Colour identity shows as icons only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Deck board rows; tile captions                                                                   |
| Card tile             | `CardTile` (`src/shared/CardTile.tsx`), top to bottom: `selection`, art, `badges` (state pills only: location or review status, which wrap between pills and never inside one), the name + `cost` line, one muted `detail` line (type line, reason, or fit rating plus reason), extras (a disclosure, an error), `actions`. Below a 180px caption the cost drops under the name. Tiles in one grid stretch to the row height. A selected tile takes `--selected-border` with a 1px ring of it and a `--selected-background` tint. A screen's tile class sets its border colour on `.card-tile.<class>`, because the later `.card-tile` rule otherwise draws `currentColor`. A grid with a preview of 6 or pages of 12 caps at six columns, so they fill whole rows (Start grid, Doctor Choose changes and Confirm).                                                                           | Start grid; card search (detail = type line); Doctor tiles (detail = "★★ Possible fit · reason") |
| Recommendation offer  | `.card-offer`, top to bottom: reason label, art, decisions (`.actions`: Add, Later, Ignore, More like this), then the `.card-copy` (name, reason, oracle text, details, score). The offer under hover or focus paints above its neighbours, so its popovers overhang them. At 800px and below the batch is one swipe row (`.card-grid` scrolls on the x axis with snap): art left, decisions beside it, copy below. That rail is the one container meant to scroll sideways; the page still has `scrollWidth === clientWidth`. The rail clips overflow, so offer popovers stay inside the offer at rail widths.                                                                                                                                                                                                                                                                               | Builder batch                                                                                    |
| Focus target          | A heading that takes focus programmatically (`tabIndex={-1}`, for example after a step closes) draws no ring, because it isn't a control. Tab stops keep their ring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Builder "Add to your deck"                                                                       |
| Comparison pair       | Two `CardTile`s with a `→` between them (`minmax(0, 1fr) auto minmax(0, 1fr)`, tiles stretched to one height, arrow centred), each tile's status pill naming its side ("In deck · cut" → "Replacement"). Pairs flow as cards in a grid (`minmax(min(330px, 100%), 1fr)`), so one pair spans about two tile widths. The pair stays side by side at 375px; the tiles shrink. In a dialog, pairs sit in one centred column of at most 460px: Doctor tile art previews are absolute (#297), so a tile at the dialog edge would scroll the dialog sideways.                                                                                                                                                                                                                                                                                                                                        | Diagnose suggestions; Confirm swaps; Compare commanders                                          |
| Small image + preview | `SmallCardImage`, with `placement="reference"` inside any scroll container, a dialog included. In that mode it previews on hover and on keyboard focus of its enclosing button or link, so callers add no preview handlers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Basic-land gallery; saved-deck rows                                                              |
| Commander context     | `CommanderCardArt` + `CommanderSummary` in `.intro.commander-header`, identical on Builder, Card search and Deck review. The Start continue card reuses `CommanderSummary` (`headingLevel="h2"`, `eyebrow="Deck in progress"`, no actions) beside a `SmallCardImage`; its title takes `--type-section` because the page owns the `h1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | All three full-page modes; Start continue card                                                   |
| Dialog shell          | `.modal-backdrop` > `section.export-modal[role=dialog][aria-modal][aria-labelledby]` spread with `{...useDialogFocus(open, close)}`. Inside: `.export-heading` holding one `.eyebrow` + `h2` (the labelled heading) and `ModalCloseButton`; body; footer `.export-actions` (secondary left, `.primary` right). The hook focuses the × on open, traps Tab, closes on Escape, returns focus to the opener, and leaves focus alone while a stacked dialog owns it. Leave `autoFocus` out of dialogs: it hijacks the opener the hook records. A dialog that blocks dismissal while busy passes a guarded `close`. A multi-step dialog (the intro guide) puts the step count in its eyebrow (`Guide · 1 of 5`). Widths: `.export-modal` 760px; `.confirm-modal` 460px for prompts; wide variants for dense content (card details 980px, Recommendation settings 900px, Collection browser 1100px). | Export; Saved decks; Start over                                                                  |
| Confirmation          | `ConfirmDialog` (`src/shared/ConfirmDialog.tsx`): the dialog shell at `.confirm-modal`, no eyebrow, Cancel `.export` + confirming `.primary`. Doctor "Discard your choices?" uses the same shell.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Start over; Import and replace                                                                   |
| Tooltip / help        | A positioned parent > trigger + `.action-help[role=tooltip]`, linked with `aria-describedby`. `.action-help` (`src/styles/base.css`) is the one surface: dark fill, `--border-control` edge, `--type-data`. It shows on parent hover, trigger `:focus-visible`, or a focusable parent's `:focus-visible`. Add `.end` to right-align it above the trigger; a component class may set only position and width. It carries information only.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Later / Ignore; More like this; settings "?"; Synergy; score factors                             |
| Inline confirmation   | A second click on the same button arms it (`.saved-deck-delete.confirm`, `.remove-confirm`). Its hint is `.action-help.end` at one-line width. Anything heavier uses `ConfirmDialog`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Saved decks Delete; deck board ×                                                                 |
| Menu                  | A trigger button that toggles a panel of controls and closes on Escape and outside click. There's only one instance so far.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Display menu (`DisplaySettingsMenu`)                                                             |
| Count header          | The region `h2`, then one muted `--type-data` line: the result count, plus any reason every result shares ("175 loaded commanders · Picked for Elves decks"). While loading it reads the status ("Finding legal commanders…"); with no results the empty state names the zero, so the line stays blank. The live announcement stays in one `role=status` element.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Paging                | `Pagination` (`src/shared/Pagination.tsx`): "Showing a–b of n · Page x", Previous/Next below the grid. In-place growth uses "Show N more (M left)".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Start grid; card search; Doctor candidates                                                       |
| Loading               | `ArtLoading` for art; skeleton tiles for grids; a named status line ("Finding legal commanders…") in `role=status`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Start grid skeleton; recommendation loading                                                      |
| Filter panel          | Each filter group sits under a `.filter-heading` (an `h3`, or a `span` inside the field's `label`) and is a `role="group"` labelled by it. Chips are toggles. The reset is one `.export` "Clear filters": disabled while nothing is set, and replaced by the empty state's own while the grid is empty, so one shows at a time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Start "Find a commander"                                                                         |
| Empty / error         | A short status saying what to do next, with the action beside it. Errors use `.form-error` (`--text-danger`) inside `role=alert`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Start "No commanders match these filters" + Clear filters                                        |
| Text colour           | Inherited, or `--text-body`, `--text-strong` (headings, brand, indigo control labels), `--text-muted`, `--text-accent`, `--text-danger`, `--text-success`, `--text-warning`. `.dark` swaps them all, so a component never needs a `.dark` colour override. `theme-tokens.test.ts` checks each against every surface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `src/styles/base.css`                                                                            |
| Surfaces              | `--surface-page`, `--surface-panel`, `--border-subtle`, `--border-control`, `--action-fill`. Theme a new surface with these before adding a `.dark` override. Inset and tinted surfaces have no token yet (#311).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `src/styles/base.css`                                                                            |
| Inputs                | `--input-*` tokens. Component rules set size, spacing and radius only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Every text field                                                                                 |
| Type                  | `--type-page-title`, `--type-section`, `--type-card-name`, `--type-body`, `--type-data`, `--type-caption`. `type-scale.test.ts` rejects raw px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `src/styles/base.css`                                                                            |

## Known divergences

Each entry gives the place and the owning slice. A slice either fixes it or records why the divergence stays.

**Buttons**

- Several `.primary` buttons in one region: Saved decks has "Load" on every row. #300.
- Card search "Add to deck" is an outline button, while the builder offer's Add is `.primary` for the same action. #292.
- Selected tab filled solid instead of tinted: Export format tabs (`.format-tabs button.selected`). #301.
- Within one row, the "Add to" toggle and "Select several" (card search results header) use different font sizes. #292.

**Theme and type**

- Six `color: #hex` declarations stay, each deliberate: dark text on colour-segment fills (`.colour-segment`, the selected basic-land badge), white text on filled controls, the gold etched-foil name (`.etched-card-name`) and a decorative loader separator. About 210 lines in `src/styles/` still contain `.dark`, nearly all surface or border swaps. #311.

**Card tiles and grids**

- The Doctor tiles keep their own `.doctor-card-status` location pill ("In deck", "In deck · flagged", "Addition"). Its text now takes `--text-muted`. Whether "flagged" becomes a `ReviewStatus` `attention` pill belongs to `DeckReviewCard` (#297).
- Diagnose finding grids keep `minmax(150px, 1fr)` columns, so a row of 6 leaves an empty seventh column at 1366px. #294 is closed.
- Change history pairs (`.doctor-history-pair`) stack under 620px, while every other comparison pair stays side by side. #297.

**Mana and card names**

- Cost shown as text, not symbols: Collection browser tiles ("4 mana · FRA"). #303.
- Card name outside `CardReference`: Collection browser tiles use a separate "View details" link. #303.

**Responsiveness**

- At 375px the top bar's `.header-actions` scrolls sideways and hides actions. #304.
- The Collection browser dialog overflows horizontally at every width. #303.

**Dialogs**

- Every dialog uses `useDialogFocus` (#282).
  - A dialog opened from a dialog that then closes returns focus to `<body>`: the Collection browser opens from Recommendation settings, which closes in a later commit, so its opener ("Browse these cards") is gone by close. Before #282 focus also landed on `<body>`. #316.
- Recommendation settings scroll as a whole, so the footer ("Done") sits below the fold. #298.
- The card details eyebrow reads "Deck card" for the commander and "Card details" for a recommendation. The action row (`.deck-card-modal-actions`) butts "Move to main deck" against "Remove from sideboard" at different font sizes. #299.

**Popovers**

- Every tooltip and inline-confirmation hint uses `.action-help` (#282). The request activity panel is a JS-positioned panel, not a tooltip (#304).
- `.settings-help`, `.import-help`, `.draft-help` and `.collection-picker-help` are inline helper paragraphs, not popovers. `.change-commander-confirm` is an inline panel.

**Paging, status and copy**

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

- Fixed: `CardTile` carried three label patterns. It now has one name + cost line and one muted `detail` line (see **Canonical patterns › Card tile**). The Doctor fit pill moved into the detail line, so it no longer wraps inside a pill, and Doctor grids stretch tiles to the row height.
- Fixed: saved-deck thumbnails previewed inside the dialog and were clipped by it. They now use `placement="reference"`.
- Deferred to #303: Collection browser thumbnails are about 50px wide, too small to judge the art, and its `SmallCardImage` previews sit inside the dialog's scroll container. `dark/collection-browser.png`.

### #282 Dialog shell and popovers

- Fixed: every dialog uses `useDialogFocus`. Export, Import, Change commander, Change history, Compare commanders, Start over and the discard prompt now take focus, trap Tab and close on Escape; the five hand-rolled traps are gone. Probe: 12 dialogs, 40 Tabs and 8 Shift+Tabs each, no focus outside the dialog.
- Fixed: Change history and Compare commanders carried two eyebrows with the `h2` outside the heading row. Each now has one `.export-heading`. The discard prompt and `ConfirmDialog` share `.confirm-modal` and `.export-actions`. The Collection browser joined `.export-modal`.
- Fixed: widths settled on three tiers (see **Canonical patterns › Dialog shell**). Export, Import, Saved decks and Change commander moved to 760px.
- Fixed: `SettingHelp`, `.synergy-popover`, `.score-factor-tooltip`, the More like this hint and both inline-confirmation hints now render `.action-help`.
- Moved to #287: the Synergy popover was clipped by the art box. #287 fixed it.

### #283 Continue building and saved decks entry

- Fixed: the continue card renders `CommanderSummary`, so it shows the builder header's eyebrow, commander-name button and colour identity (`commanderDetails.colours`, as in the builder). It reads: "Deck in progress" eyebrow, commander `h2`, identity, counts, then **Continue building** (`.primary`) and **Choose another draft** (`.export`).
- Fixed: the Autosaved-drafts helper moved into the "Build from scratch" lead, beside the commander choice it describes.
- Fixed: the thumbnail preview was centred on the thumbnail and clipped off the viewport's left edge on hover and focus. It now uses `placement="reference"`.

### #284 Commander filters

- Fixed: "Clear filters" is disabled while no filter is set. Clearing a one-character search still counts, because the field holds text.
- Fixed: while the grid is empty, the panel hides its "Clear filters" and the empty state keeps its own, which stays the canonical empty state. The summary row keeps its height so the panel doesn't shift.
- Fixed: the theme chips had no label while Colour identity had an `h3` and Name a sans label. All three now take `.filter-heading` (see **Canonical patterns › Filter panel**).
- Fixed: a creature-type theme matching a visible curated chip ("Elves") showed twice, as the pressed chip and an "Elves ×" chip. Only the pressed chip shows; pressing it again clears the theme, as × did.
- Fixed: the selected colour and the creature-type field used hardcoded hex and `.dark` overrides. They now take `--selected-*` and `--input-*`. `ColourPicker` is shared, so Change commander changes too.
- Decided: the theme chips stay randomised per load. That's product behaviour, so replays seed `Math.random` instead (see **Reaching each state**).
- Start never takes commander colours (`themed` needs the builder), so the slice has no themed state on Start. The shared picker was checked themed in Change commander.

### #285 Commander discovery grid

- Fixed: the grid has a count header (see **Canonical patterns › Count header**). The shared batch reason joined its line, and "Finding legal commanders…" moved there from below 12 skeleton tiles.
- Fixed: `CommanderChoiceTile` adds the type line as its muted detail line, so Change commander tiles carry it too. Skeleton tiles add a matching detail bar, and the dark skeleton button no longer shows "Choose".
- Fixed: commander tiles drew a `currentColor` border, because the later `.card-tile` rule overrode `.commander-tile`. `.card-tile.commander-tile` now takes `--border-subtle`, and its `.dark` override is gone.
- Fixed: the discovery error uses `.form-error` inside `role=alert`, and its tail no longer repeats the provider's "Try again" ("…Change a filter, or reload the page.").
- Fixed: `CommanderPromotion`'s button was a one-off with hardcoded hex and a light hover in dark mode. It is now `.compact-action`.
- Kept: the empty state ("No commanders match these filters" + Clear filters) stays the canonical empty state.
- The 429 message's raw timestamp comes from the shared Scryfall error, so it stays with #304 and #292.

### #286 Commander header and setup

- Fixed: the commander name wrapped to two lines at 1366px in every mode. The `.commander-header` summary column now sizes to the name (`minmax(260px, auto)`) and the setup column keeps its 480px minimum, so "Meren of Clan Nel Toth" fits on one line at 1366px. Narrower, the title wraps with `text-wrap: balance`.
- Fixed by earlier slices: the Doctor "Change commander" is already `.export`, like "Compare commanders". With the wider column the two now sit on one row.
- Moved to #289, then deferred to #328: during the play-style step, the sidebar shows live deck targets (0/35 lands, "Fill now") for a one-card deck.
- Fixed: the intro guide's footer spread Back, `.primary` Next and Skip across the row, and its step count was screen-reader only. The footer now follows the dialog shell: Skip on the left, Back + Next on the right. A `Guide · 1 of 5` eyebrow sits above the title. The dark guide's hardcoded `.primary` fill is gone, so it takes `--action-fill` like every other dialog.
- Kept: the play-style step keeps its own `h2` ("How do you want to play?") under the header's "Setup / Choose a play style". They sit in different regions, and the header `h2` is the focus target once the step closes.

### #287 Recommendation batch

- Fixed: at 375px the four offers stacked to about 3,550px, and Deck overview started about 5,400px down. The batch is now one swipe row about 730px tall, and the deck board starts about 2,500px down (see **Canonical patterns › Recommendation offer**).
- Fixed: the "Synergy" popover wasn't clipped by its own art. The next offer painted over it, because every offer shared one z-index. The offer under hover or focus now paints on top.
- Fixed: the decision buttons sat above the art and name. They now sit under the art, so the card comes before the action, and every offer's buttons line up across the row however long its text runs.
- Fixed: the "Add to your deck" heading drew a boxed ring when it took focus after the play-style step. Focus targets now draw none (see **Canonical patterns › Focus target**).
- Fixed: "Suggestions unavailable" showed its error as plain text. It is now `.form-error` inside `role=alert`. Seen via `builder-rec-unavailable`.
- Kept: the header still reads "Add to your deck" while suggestions are unavailable. The empty state names the failure, and the heading is a focus target.
- Kept: offers in one row still differ in height. The grid stretches them to the row, so only the copy below the buttons varies.

### #288 Deck health lane

- How to reach it: the lane renders only with Priority set to Theme first, and only for queued cards that fill a role below target (state `builder-health-lane`). The audit deck's Balanced default never shows it. Replay needs the Theme first batch's printing lists in the cache; seed them once with `pnpm dev:record` if they miss.
- Fixed (**Galleries**, **Mana**): suggestions are now small `CardTile`s (`HealthLane.tsx`): art button with `SmallCardImage placement="reference"`, a role badge, `CardReference` name, full cost, Add. The bespoke `.health-card-zoom` preview is gone. The tile grid (`minmax(120px, 1fr)`) fits three across at 900px and up; when the lane is narrower than heading plus three tiles, the heading wraps above the grid. Two columns at 375px.
- Fixed (**Hierarchy**): Add is `.primary`, like the batch's Add for the same action. Each tile is its own offer, so one `.primary` per tile, as in the batch.
- Kept: the lane's tinted background (`#faf9ff`) and dark border hex. Tinted surfaces have no token yet (#311). Tiles take `--border-subtle`, white in light and `--surface-page` in dark.
- Not exercised by gates: the contrast and card-reference fixtures use Balanced, so they never render the lane. #288 measured lane text by hand (all ≥ 6.4:1 in light, dark and Meren-themed).

### #289 Deck analysis sidebar

- Seen, not fixed (#306): while "Checking card data…" shows, the sidebar still reads zeros as facts ("Lands 0/35", "Fill to land target · 16 lands left").
- Fixed (**Feedback**): the mana curve scaled each bar against its column's permanent + non-permanent sum, so the tallest bar peaked at about 36px of 64. The two bars sit side by side, so `ManaCurve` now scales against the tallest single bar, and bars are 10px wide. The Doctor curve shares the component, so it changed too.
- Fixed (**Hierarchy**): Deck targets drew rows below target as boxed `.export` buttons and met rows as plain text, offset by the button padding. Every row now shares one transparent box, outset so labels line up with the rest of the sidebar. A row below target stays the role-focus button: accent label with a dotted underline, `--border-control` on hover, the focus ring, and `--selected-*` while pressed. A met row shows a `--text-success` ✓ before its count, the Doctor's "Target met" in compact form.
- Kept (**Hierarchy**): the sidebar draws roles as compact bar rows; the Doctor draws bordered cards with status pills. The sidebar is a glance, the Doctor the full review. Both share the count, the target input and the met state.
- Kept: sidebar ratio bars use the accent-to-highlight gradient, and Doctor role bars are solid accent.
- Fixed (**Theming**): with commander styling on in dark mode, permanent curve bars took the dark indigo accent, too dark to see on the panel. They now mix the accent 70% with white, as accent text does.
- Fixed (**Responsiveness**): the count column widened from 64px to 86px so "✓ 35 / 35" fits. At 375px, the panel and page both have `scrollWidth === clientWidth`.
- Deferred to #328: during the play-style step, `Use 40`, `Fill now` and role focus stay enabled for a one-card deck. Hiding or disabling them changes enabled states. The setup sidebar now reads quieter because its rows are no longer boxed.
- Not exercised by gates: the contrast gate tabs and hovers the builder sidebar, but never presses a role row.

### #290 Deck board

- Fixed (**Galleries**): rows were name and cost only. Every row (commander, groups, basics, sideboard) now passes `thumbnail` to `CardReference`: a 22px card image inside the name button, so hovering or focusing it previews in the top layer and clicking opens details. The board grows about 230px at 1366px (1,120 → 1,353 for the 84-card deck).
- Kept (**Galleries**): groups stay rows inside the wrapping group columns, not art tiles. A 100-card list is scanned by name, cost and count; tiles would make it several screens tall. A visual (tile) deck view is filed as #330.
- Fixed (**Clipping**): the sideboard broke "Craterhoof Behemoth" mid-word. Sideboard rows now wrap: the name keeps a 9em basis and cost, "Move to deck" and × drop under it when the column is too narrow.
- Fixed (**Hierarchy**): removal is `.danger.deck-remove`, armed with `.danger.confirm` (tint, bold, ✓) instead of a solid red fill. See **Canonical patterns › Destructive action** for the faint rest outline. "Move to deck" is `.compact-action`, replacing the bespoke `.sideboard-move`.
- Changed: a basic-land row's "Remove one" was a ×; it is now the neutral − stepper before +, as in the basic-land dialog, because removing one basic is a count change. Labels and actions are unchanged.
- Not exercised by gates: the contrast gate hovers the board × but never arms it. The sideboard wrap was checked by hand at 375px and 1366px.

### #291 Deck needs and filter panel

- **Clipping**: in the filter panel, the sticky "Search cards / Reset filters" bar sits over the top of the "Deck needs" fieldset, leaving blank space above it and hiding the first role row. Captured after the name field took focus, so check whether the panel's own scroll causes it. `light/card-search-results.png`.

### #292 Results grid

- **Hierarchy**: "Add to deck" is an outline button, while the builder offer's Add is `.primary`. `light/card-search-results.png`.
- **Hierarchy**: "Select several" is larger than the "Add to Deck/Sideboard" toggle beside it. `light/card-search-results.png`.
- **Copy**: the 429 error prints a raw timestamp and "No usable retry time was exposed; this wait is an estimate.", and "0 matching cards" shows above it. `light/activity-indicator.png`.

### #293 Context header, step navigation and readiness

- Fixed (**Hierarchy**): every Doctor step change is now `.nav-forward` / `.nav-back`: "Choose changes" (Diagnose footer), "Choose cuts" (readiness, over 100), "Continue choosing changes" and "Confirm changes" (pending bar), "Choose more changes" (applied bar), "Back to Diagnose" and "Back to Choose changes". "Apply N changes" stays `.primary`; it commits. Labels, enabled states and targets are unchanged. The audit's "finding rows" entry had no step button; finding rows hold "Apply swap" / "Add card" (#294).
- Fixed: the Diagnose footer "Choose changes" sits at the end of the page column, the side it travels to (`.doctor-page > .nav-forward`).
- Fixed: disabled `.nav-back` / `.nav-forward` no longer change fill or arrow padding on hover. The disabled "Confirm changes" relies on this; the builder's busy "Next recommendations" also gains it.
- Kept: each step change focuses the step `h2` (checked after every button above, at 1366px and 375px). The context header reuses `CommanderCardArt` and `CommanderSummary`.
- Kept: on Diagnose with a pending plan, the footer "Choose changes" and the bar's "Continue choosing changes" go to the same step. Merging them changes what renders, so it stays.
- Deferred to #332: at 375px the applied bar stacks status, Undo/Dismiss and "Choose more changes" into about 180px, covering the step list.
- How to reach readiness in trim mode: import the complete deck with `12 Swamp` changed to `14 Swamp` (102 cards). Replay serves it without new recordings. Importing the complete deck into a fresh profile misses `cards/collection`; import the partial deck first, as the recorded flow does.

### #294 Diagnose step

- Fixed (**Galleries**): finding cards were name-and-cost boxes. They are now `ReviewCardTile`s, the tile the suggestions below use: art that previews and opens details, the "In deck" / "In deck · flagged" pill, name and full cost. A mana finding's signal disclosure sits in the tile's extras slot. Each finding shows 12 tiles, then "Show N more (M left)", because a role-gap finding lists every card in that role.
- Kept (**Hierarchy**): one `.primary` per suggestion. Each suggestion is its own offer, like the batch and the health lane (#288); see **Canonical patterns › Main action**.
- Fixed (**Ergonomics**): each role card now holds its target. The card is a frame around the filter button and a "Target" row with a −/field/+ stepper (`.target-stepper`, sharing the basic-land stepper rules). The field stays free-form, and − and + disable at 0 and 99, the field's bounds. Hovering the filter highlights the whole card.
- Fixed (**Hierarchy**): "At a glance" is a full-width strip with its three checks side by side. The six detail cards flow in CSS columns (`columns: 3 260px`), so the short curve card no longer leaves a blank row. Source order and Tab order run down each column. No card folds away; each holds filters into the builder.
- Fixed (**Theming**, **Copy**): `attention` pills were red, but "How review works" says amber marks a possible gap. They now take `--text-warning` on an amber tint.
- Fixed (**Hierarchy**): each finding starts with a `ReviewStatus` pill naming its kind (Role gap, Mana demand, Theme support, No detected link; open slots are neutral). The finding model has no severity, so every finding reads as a possible gap.
- Fixed (**Empty / error**): the Diagnose error was `role=status` text. It is now `.form-error` in `role=alert`.
- Checked: Doctor metrics match the builder sidebar for both audit decks (pips, sources, role counts, types, average mana value). The Doctor lists mana costs only for demanded colours, so the sidebar's "Colourless: 6" sources line has no Doctor row. The curve shares `ManaCurve` and its #289 scaling.
- Seen, not fixed (#306): while "Checking card data…" shows, Diagnose lists most of the deck under "no detected link" and adds role gaps, then settles. The 12-tile cap keeps that transient short.
- How to reach the Diagnose error: on the complete deck, "Apply swap" on a suggestion, go back to the builder, remove the added card, open Deck review › Change history and undo the swap. It reads "The added card changed; this swap cannot be undone safely." A blocked `cards/collection` refresh does not reach it, because undo falls back to the stored card. The flow misses a few replay entries (a printing list, the refresh), which don't affect the state.
- Not reached: the "Find more legal replacements" error. With EDHREC and Scryfall search blocked, the search still resolves from cached and queued cards.

### #295 Choose changes step

- Fixed by #281: the fit label no longer wraps. It sits in the detail line at one line (17px) in every variant.
- Fixed (**Galleries**): cut and addition grids left an empty seventh column at 1366px. They now cap at six columns (the Start grid's rule), so the 6-card preview and each "Show 12 more" fill whole rows. At 620px and below they stay two columns.
- Fixed (**Selection at rest**): every Doctor tile drew a `currentColor` border, because the later `.card-tile` rule beat `.doctor-card-tile`. In dark mode unselected tiles drew a near-white border and selected ones a dim purple, so the pick read weaker than its neighbours. Tiles now take `--doctor-border`; selected tiles take the toggle tokens (see **Canonical patterns › Card tile**). The border fix reaches Diagnose and Confirm tiles too.
- Fixed (**Ergonomics**): a multi-copy cut (Swamp ×12) was a bare number field reading "Cut [2] of 12". It is now the −/field/+ stepper (`.target-stepper`). The field stays free-form and clamps to 0–max; − and + disable at the bounds. "of 12" went, because the pill already says "×12" and + disables at the count. Checkbox rows take the stepper's 30px height, so art lines up across a row.
- Fixed (**Theming**): the card filters and the copies field set their own border, background and text colours. They now take `--input-*`.
- Kept (**Feedback**): the live count is the sticky bar ("Cutting 1 · Adding 2 / Deck: 100 → 101 / 100 · Not applied yet", `aria-live`) plus each section's "N selected" or "N of M selected" in trim mode.
- Kept: Choose changes has no comparison pair. Pairs live in Diagnose suggestions (#294) and the Confirm plan (#296).
- Moved to #297: the `.doctor-card-status` pill (see **Known divergences › Card tiles and grids**).
- How to reach trim mode with cuts: import the partial deck, then the complete deck with `12 Swamp` changed to `14 Swamp`, and open Deck review from the builder. Autosave can be unavailable for that import, so a reload drops the deck; drive in-page.
- Not reached: the "Find more legal replacements" error. With EDHREC and Scryfall search blocked, the local card index still answers (as #294 found).

### #296 Confirm step and commander comparison

- Fixed (**Galleries**): each swap spanned the full plan width, with its two tiles about 470px apart at 1366px. Swaps are now pair cards in a grid, three per row at 1366px with 164px tiles (see **Canonical patterns › Comparison pair**). At 375px the pair stays side by side at 117px tiles, as Diagnose suggestions do; it had stacked into two 200px tiles.
- Fixed (**Galleries**): "Cut without replacement" and "Add without cutting" left an empty seventh column at 1366px. They take the Choose changes six-column cap.
- Fixed (**Copy**): the header read "1 cut · 1 addition" while the bar read "Apply 2 changes". It now leads with the bar's total: "2 changes: 1 cut · 1 addition".
- Fixed (**Feedback**): "After these changes" showed every count in one muted style. A changed count now takes `--doctor-text` at bold, and "(below your target)" takes `--text-warning`. The text is unchanged.
- Fixed (**Empty / error**): with no theme, Compare commanders said "Select a theme or sub-theme…" and offered no control. It now says to choose one in the builder and holds a "Choose a theme" `.export`, the Diagnose overview's action: it closes the dialog and runs the same exit-then-open-the-sub-theme-picker path.
- Fixed (**Responsiveness**): each commander option stacked a 300px tile above another at 375px, about 600px an option. Options now keep the pair side by side (about 330px an option). At 1366px they sit in one centred 460px column.
- Changed: at 620px and below, the Diagnose suggestion arrow was rotated to ↓ though its pair stays side by side. The rotation now applies only to stacked history pairs, so it reads →.
- Kept: each commander option still repeats the current commander's tile, because a comparison shows both images (ui.md). Filed as #337.
- Deferred: #332 (the applied bar at 375px, 219px tall) belongs to the shell's sticky bar, not the Confirm step.
- How to reach Compare commanders with results: in the builder, "+ Choose sub-theme" and pick the first option, then open Deck review › Compare commanders. Replay needs the commander search; seed it once with `pnpm dev:record`.

### #297 Review card and history modal

- Scope: `DeckReviewCard` is the Doctor's candidate and cut tile (`.doctor-card-tile`). The builder's review entry point is the "Deck review" `.export` in the Deck overview header.
- None found in the history modal; #282 moved its heading into the shell. Empty history: `light/review-history-empty.png`. With one change: `light/review-c-applied-history.png`.

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

- **Feedback**: the parse summary uses the same amber box as the "Deck URLs are not supported" caveat. "Not found: …" is bold red text outside an alert box. The difference between "Import 2 found cards" and "Import deck" is unclear. `light/import-parsed.png`, `light/import-missing.png`.
- Not verified: copy confirmation. The headless clipboard was denied, and no confirmation showed. `light/export-copied.png`.

### #302 Change commander

- **Feedback**: nothing says which cards would leave colour identity before "Choose". `light/change-commander-search.png`, `light/change-commander-pick.png`.

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

- Reviewed at baseline: `BasicLandDialog` opened (`light/basics.png`) and with the printing gallery open (`light/basics-gallery.png`). Findings: once card data has loaded, the basic split and printing gallery match the playbook case study. The "Start with nonbasic lands" list added since then uses about 30px thumbnails and a `.compact-action` "Add", and its long reasons push "Add" out of line (`light/basics-gallery.png`). While "Checking card data…" is still showing, though, the dialog reads "Room for 16 more lands toward your 35-land target" and offers 16 basics, even though the deck already has 35 lands (`prev/basics.loading.png`). That's a behaviour bug, filed as #306.
- The integration checks come after the slices merge: diff the cross-screen items above (commander header, card tiles, button roles, dialog shell) against **Canonical patterns**.

## Reaching each state

Run `pnpm dev:replay` and open the app with `preview_open` (see
[local provider replay](design-review.md#local-provider-replay) for seeding and
strict replay checks). Use plain `pnpm dev` when actual artwork is needed.
Replay a state like this:

1. Set the theme if you need one: `localStorage.setItem('option:darkMode', 'true')` and `localStorage.setItem('option:commanderStyling', 'true')`. The Display menu sets the same keys.
2. Load the route in the state's comment line (for example `#build/review`) with a full reload, so no dialog or prior step is still open.
3. Run the helpers snippet. A reload or HMR clears `window.dr`.
4. Run the state's snippet. It resolves once the target state is on screen and throws if it isn't. A `return` value is a diagnostic.

Notes:

- A T3 `preview_evaluate` call times out after 15 s, and a hidden tab throttles timers. Split long flows across several calls.
- Every load starts in "Checking card data…", with the analysis reading zero (state `builder-card-data-loading`). `dr.builderReady()` waits for card data and the first reveal.
- States in a group share one workspace and mutate it. `saved-manual` saves "Audit deck", `rec-settings-sets` ticks the newest set, `commander-alt-printing` switches the commander's printing, `review-c-applied-history` applies a change, and `builder-health-lane` switches Priority to Theme first. Re-import the deck if a later state depends on the original.
- Theme chips on Start are randomised on each load. For repeatable chips, seed `Math.random` in an init script (for example, Playwright `addInitScript`). A new seed requests new theme searches, so record them once with `pnpm dev:record`. Replay fixes provider responses and uses synthetic EDHREC lists; live-mode card names can vary between runs.
- Fault states (`block …` in the comment line) need request interception. The T3 preview can't intercept, so use Playwright against the same dev server before loading the route. Under `pnpm dev:replay` and `pnpm dev:record`, the app sends provider calls to `/__dev-provider?url=<provider URL>`, so match that path and read `url`; a provider-host pattern matches only under plain `pnpm dev`:

```js
const block = (prefix, answer) =>
  page.route('**/__dev-provider?**', (route) => {
    const url = new URL(route.request().url()).searchParams.get('url') ?? ''
    return url.startsWith(prefix) ? answer(route) : route.continue()
  })
await block('https://json.edhrec.com/', (route) => route.abort()) // block edhrec
await block('https://api.scryfall.com/cards/search', (route) =>
  route.fulfill({ status: 500, json: { object: 'error' } }),
) // block scryfall-search
await block('https://api.scryfall.com/cards/search', (route) =>
  route.fulfill({ status: 429, headers: { 'retry-after': '30' }, json: { object: 'error' } }),
) // block scryfall-429
await block('https://api.scryfall.com/cards/named', (route) =>
  route.fulfill({ status: 500, json: { object: 'error' } }),
) // block scryfall-named (an in-memory cache serves a loaded commander, so pick a new one)
await block('https://api.scryfall.com/cards/search', () => {}) // hold scryfall-search (loading)
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
// builder-rec-unavailable · #287 · #start · after the grid loads, block scryfall-named
await dr.text('commanders shown')
dr.btn('Choose').click()
await dr.text('Suggestions unavailable')
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

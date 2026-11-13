# Design conventions

The maintained reference for UI design in this app. `docs/agents/ui.md` holds the house rules; this doc names the component or class that meets each one, lists every place that knowingly differs, and scripts the drive to each screen, mode and dialog for rendered review. When a change settles or changes a convention, update **Canonical patterns** or **Known divergences** in the same PR. Line numbers drift, so search for class names.

## Canonical patterns

Use the form in the second column. **Known divergences** lists every place that differs.

| Pattern               | Canonical form                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Example                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Region heading        | `.eyebrow` paragraph (uppercase accent label) above one `h2`, sized by `--type-section`. Page titles use `--type-page-title`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Builder "Your deck / 84 cards"; Doctor sections                                                  |
| Header actions        | `.export` buttons in the region's header row, beside its heading. The top bar's `.header-actions` wraps at every width, so no action scrolls off-screen at 375px. A header action becomes the region's `.primary` only when it is the next task: Deck overview's "Deck review" turns `.primary` at 90 cards. The brand is plain text in every top bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | "Deck review" in Deck overview; top bar                                                          |
| Main action           | `.primary`, one per region. A grid of independent offers has one per offer: the batch, the health lane, Doctor suggestions ("Apply swap" / "Add card"). It confirms or commits the region's task. Its fill is `var(--commander-accent, var(--action-fill))` in every context, like the `.export` and nav borders. Context rules (`.actions .primary`) change size only. `--commander-accent` is set only while commander styling is on, and themed modes still render the indigo default (#312).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Add on an offer; Import deck; Done                                                               |
| Navigation            | `.nav-back` / `.nav-forward`. The CSS adds the arrow segment, filled like `.primary` on a raised body, so enabled navigation never reads as disabled beside filled actions. This covers step changes inside a mode. A step button stays `.nav-forward` while disabled. A forward exit at the foot of a region sits at its end; the button that commits the step (Doctor "Apply N changes") stays `.primary`. Leaving a full-page mode returns focus to the builder control that opened it ("+ Search & add cards", "Deck review").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | "Back to builder"; "Next recommendations"; Doctor step buttons                                   |
| Secondary action      | `.export`. Inside a dense row (a stat, a printing, a set list) use `.compact-action`: the same colours, hover, focus and disabled rules at `--type-data` size.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Saved decks; Adjust goals and filters; "Use 33"; "Prefer this set"; "Browse these cards"         |
| Destructive action    | `.danger`: border and text from `--text-danger`, transparent fill, red tint on hover. Confirm before acting: `.danger.confirm` marks the armed second click (tint plus bold), and anything heavier uses `ConfirmDialog`. Never filled. In a list where every row carries one (the deck board ×, `.danger.deck-remove`), the outline rests at 40% and goes full red on hover, focus or arm; on a tinted surface the hover tint mixes over `--surface-panel` to keep AA.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Saved decks Delete; card details "Remove from sideboard"; deck board ×                           |
| Toggle / segmented    | Grouped buttons with `aria-pressed`. The selected one takes `--selected-background` and `--selected-border`, never `.primary` or a solid fill. `--selected-border` follows `--commander-accent` in light themed modes and stays `#a69fde` in dark.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Add to Deck/Sideboard; offer Later/Ignore; Start theme chips, colour match; "More like this"     |
| Stepper               | A numeric field between two 30px `.deck-add` buttons (− before the field, + after) inside `.basic-land-stepper` or `.target-stepper`. The field stays free-form; each button disables at the field's `min` or `max`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Basic-land counts; Doctor role targets; Doctor multi-copy cuts                                   |
| Review status         | `ReviewStatus` (`DeckOverview.tsx`), a `.deck-review-status` pill: `good` (✓, `--text-success`) for detected support, `attention` (!, `--text-warning`) for a possible gap, `neutral` (·) for no signal. Heuristic checks are never `--text-danger`; that colour means an error. A Doctor tile's "In deck · flagged" pill is an `attention` pill; location labels ("In deck", "Addition", "Cut") stay `.doctor-card-status`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Doctor overview checks; finding kind pills; flagged Doctor tiles                                 |
| Card name             | `CardReference` (`.card-reference-name`): previews on hover or focus, opens details on activation. In a dense list row, pass `thumbnail` so the row shows art that previews and opens like the name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Deck board rows                                                                                  |
| Mana cost             | `OracleText` / `ManaSymbols` with every symbol, generic included. Colour identity shows as icons only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Deck board rows; tile captions                                                                   |
| Card tile             | `CardTile` (`src/shared/CardTile.tsx`), top to bottom: `selection`, art, `badges` (state pills only: location, review status or a copy count such as "×12", each its own pill; they wrap between pills and never inside one), the name + `cost` line, one muted `detail` line (type line, reason, or fit rating plus reason), extras (a disclosure, an error; Start tiles show up to three `IdentifiedThemes` chips and an EDHREC deck count line that keeps its height while loading), `actions`. Below a 180px caption the cost drops under the name. Tiles in one grid stretch to the row height. A selected tile takes `--selected-border` with a 1px ring of it and a `--selected-background` tint. A screen's tile class sets its border colour on `.card-tile.<class>`, because the later `.card-tile` rule otherwise draws `currentColor`. A grid with a preview of 6 or pages of 12 caps at six columns, so they fill whole rows (Start grid, Doctor Choose changes and Confirm).                                                                                                                                                                | Start grid; card search (detail = type line); Doctor tiles (detail = "★★ Possible fit · reason") |
| Recommendation offer  | `.card-offer`, top to bottom: reason label (with the `OwnedBadge` pill beside it when the player owns the card), art, `.card-copy` (name, one reason sentence, one price line), decisions (`.actions`: Add, Later, Ignore, More like this), then the collapsed `.score-breakdown`. Rules text, printing, source and links live in Card details, opened from the name; the tile keeps rules text only when the card has no art. Above 800px each offer is a 7-row `subgrid` of the batch, so names, reasons and decisions line up across offers. The offer under hover or focus paints above its neighbours, so its popovers overhang them. At 800px and below the batch is one swipe row (`.card-grid` scrolls on the x axis with snap): art left, copy beside it, decisions and breakdown below. That rail is the one container meant to scroll sideways; the page still has `scrollWidth === clientWidth`. The rail clips overflow, so offer popovers stay inside the offer at rail widths.                                                                                                                                                             | Builder batch                                                                                    |
| Focus target          | A heading that takes focus programmatically (`tabIndex={-1}`, for example after a step closes) draws no ring, because it isn't a control. Tab stops keep their ring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Builder "Add to your deck"                                                                       |
| Comparison pair       | Two `CardTile`s with a `→` between them (`minmax(0, 1fr) auto minmax(0, 1fr)`, tiles stretched to one height, arrow centred), each tile's status pill naming its side ("In deck · cut" → "Replacement"). Pairs flow as cards in a grid (`minmax(min(330px, 100%), 1fr)`), so one pair spans about two tile widths. The pair stays side by side at 375px; the tiles shrink. In a dialog, pairs sit in one centred column (Change history 480px); a lone cut or addition there takes one pair column's width. Compare commanders, a one-to-many comparison, shows the "In deck" tile once above a grid of "Alternative" options (`minmax(min(280px, 100%), 1fr)`: two columns at 1366px, one at 375px), each keeping its identity change line.                                                                                                                                                                                                                                                                                                                                                                                                              | Diagnose suggestions; Confirm swaps; Compare commanders; Change history                          |
| Small image + preview | `SmallCardImage`, with `placement="reference"` inside any scroll container, a dialog included. In that mode it previews on hover and on keyboard focus of its enclosing button or link, so callers add no preview handlers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Basic-land gallery; saved-deck rows; Doctor tiles                                                |
| Commander context     | `CommanderCardArt` + `CommanderSummary` in `.intro.commander-header`, identical on Builder, Card search and Deck review. The Start continue card reuses `CommanderSummary` (`headingLevel="h2"`, `eyebrow="Deck in progress"`, no actions) beside a `SmallCardImage`; its title takes `--type-section` because the page owns the `h1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | All three full-page modes; Start continue card                                                   |
| Card preview dialog   | `CardDetailContent` shares the art, face flip, mana cost, full Oracle text and printing/source details between card details and the random commander preview. Pass a `CardReference` as the random preview title so it can open the read-only details dialog; pass `IdentifiedThemes` (`src/shared/IdentifiedThemes.tsx`) as children. Identified themes are labels, not controls: plain dot-separated text, never pills or a selected tint. Its compact form on Start tiles drops the heading and estimate note; the grid header states the note once. Power/toughness follows the rules text on its own line, after the type line.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Card details; Start random commander                                                             |
| Dialog shell          | `.modal-backdrop` > `section.export-modal[role=dialog][aria-modal][aria-labelledby]` spread with `{...useDialogFocus(open, close)}`. Inside: `.export-heading` holding one `.eyebrow` + `h2` (the labelled heading) and `ModalCloseButton`; body; footer `.export-actions` (secondary left, `.primary` right; with two secondaries, the first stays left and the rest join the `.primary` on the right, and a wrapped `.primary` keeps the right edge, as in Import and the intro guide). The hook focuses the × on open, traps Tab, closes on Escape, returns focus to the opener (or, when that opener closed with an outer dialog, to the outer dialog's opener), and leaves focus alone while a stacked dialog owns it. Leave `autoFocus` out of dialogs: it hijacks the opener the hook records. A dialog that blocks dismissal while busy passes a guarded `close`. A multi-step dialog (the intro guide) puts the step count in its eyebrow (`Guide · 1 of 5`). Widths: `.export-modal` 760px; `.confirm-modal` 460px for prompts; wide variants for dense content (card details 980px, Recommendation settings 900px, Collection browser 1100px). | Export; Saved decks; Start over                                                                  |
| Confirmation          | `ConfirmDialog` (`src/shared/ConfirmDialog.tsx`): the dialog shell at `.confirm-modal`, no eyebrow, Cancel `.export` + confirming `.primary`. Doctor "Discard your choices?" uses the same shell.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Start over; Import and replace                                                                   |
| Tooltip / help        | A positioned parent > trigger + `.action-help[role=tooltip]`, linked with `aria-describedby`. `.action-help` (`src/styles/base.css`) is the one surface: dark fill, `--border-control` edge, `--type-data`. It shows on parent hover, trigger `:focus-visible`, or a focusable parent's `:focus-visible`. Add `.end` to right-align it above the trigger; a component class may set only position and width. It carries information only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Later / Ignore; More like this; settings "?"; Synergy; score factors                             |
| Term definition       | `src/domain/glossary.ts`: one entry per term with its definition, claim kind (rule, policy, heuristic or app setting) and, for rules and policy, a citation and knowledge-base source. Role labels, Priority and Power options, setting help, the intro guide and Commander basics read from it. List terms with `GlossaryList` (`src/shared/CommanderPrimer.tsx`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Commander basics; Priority and Power help; Deck targets guide step                               |
| Inline confirmation   | A second click on the same button arms it (`.saved-deck-delete.confirm`, `.remove-confirm`). Its hint is `.action-help.end` at one-line width. Anything heavier uses `ConfirmDialog`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Saved decks Delete; deck board ×                                                                 |
| Menu                  | A trigger button that toggles a panel of controls and closes on Escape and outside click. Menu panels and the request activity panel share one surface: `--surface-panel`, a `--border-control` edge, 7px radius, 16px padding and a `0 8px 24px #0003` shadow, with no `.dark` override.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Display menu (`DisplaySettingsMenu`); request activity panel                                     |
| Count header          | The region `h2`, then one muted `--type-data` line: the result count, plus any reason every result shares ("175 loaded commanders · Picked for Elves decks"). While loading it reads the status ("Finding legal commanders…"); with no results the empty state names the zero, so the line stays blank. The live announcement stays in one `role=status` element.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Paging                | `Pagination` (`src/shared/Pagination.tsx`): "Showing a–b of n · Page x", Previous/Next below the grid. In-place growth is one `.export` below the grid reading "Show N more (M left)".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Start grid; card search; Doctor candidates                                                       |
| Loading               | `ArtLoading` for art; skeleton tiles for grids; a named status line ("Finding legal commanders…") in `role=status`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Start grid skeleton; recommendation loading                                                      |
| Filter panel          | Each filter group sits under a `.filter-heading` (an `h3`, a `legend`, a disclosure `summary`, or a `span` inside the field's `label`) and is a `role="group"` (or `fieldset`) labelled by it. Chips are toggles. The reset is one `.export` "Clear filters": disabled while nothing is set, and clearing moves focus to the first filter field. It is replaced by the empty state's own while the grid is empty, so one shows at a time. A dense form (card search) gives `.filter-heading` to its group headings only; its field labels stay plain form labels. Card search leads with one name-or-rules box, theme fit and deck-need checkboxes; its Any / Must / Not filters sit in a collapsed "Advanced filters" disclosure.                                                                                                                                                                                                                                                                                                                                                                                                                        | Start "Find a commander"                                                                         |
| Empty / error         | A short status saying what to do next, with the action beside it. Errors use `.form-error` (`--text-danger`) inside `role=alert`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Start "No commanders match these filters" + Clear filters                                        |
| Text colour           | Inherited, or `--text-body`, `--text-strong` (headings, brand, indigo control labels), `--text-muted`, `--text-accent`, `--text-danger`, `--text-success`, `--text-warning`. `.dark` swaps them all, so a component never needs a `.dark` colour override. `theme-tokens.test.ts` checks each against every surface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/styles/base.css`                                                                            |
| Surfaces              | `--surface-page`, `--surface-panel`, `--border-subtle`, `--border-control`, `--action-fill`. `--surface-raised` (cards on a panel), `--surface-inset` (deck board, aside), `--surface-well` (sunken galleries), `--surface-tinted` (chips, counts, hover rows, art placeholders), `--surface-muted` (missing thumbnails, help hover), `--surface-track` (meter and ratio tracks), `--surface-wash` (translucent notes), `--surface-success` and `--surface-warning` (status fills); `--border-divider` (section dividers), `--border-tinted` (theme chips), `--border-warning`. Theme a new surface with these before adding a `.dark` override; a remaining `.dark` surface or border override carries a one-line reason.                                                                                                                                                                                                                                                                                                                                                                                                                                | `src/styles/base.css`                                                                            |
| Inputs                | `--input-*` tokens. Component rules set size, spacing and radius only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Every text field                                                                                 |
| Type                  | `--type-page-title`, `--type-section`, `--type-card-name`, `--type-body`, `--type-data`, `--type-caption`. `type-scale.test.ts` rejects raw px.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `src/styles/base.css`                                                                            |

## Known divergences

Each entry names the place and why it stays, or the issue that owns the fix.

**Buttons**

- `Pagination` Previous/Next are `.export`, not `.nav-back` / `.nav-forward`. They move the result window in place; the page, its heading and focus stay put, so they aren't navigation. The arrow style stays reserved for leaving a page or changing a step.

**Theme and type**

- Six `color: #hex` declarations stay, each deliberate: dark text on colour-segment fills (`.colour-segment`, the selected basic-land badge), white text on filled controls, the gold etched-foil name (`.etched-card-name`) and a decorative loader separator. About 210 lines in `src/styles/` still contain `.dark`, nearly all surface or border swaps, and tinted surfaces (health lane, card search panel, basic-land gallery) stay hex. #311.
- Commander colours never reach `.primary`, `.export` or the selection border; themed modes render the indigo default. #312.
- Export's printable checklist (`PrintChecklist`, #547) prints in fixed black on white, not theme tokens: paper stays light whatever the app theme. Its card names are plain text, not `CardReference`, because paper has nothing to preview or open. It renders beside the app root and shows only in print.

**Card tiles and grids**

- Diagnose finding grids keep `minmax(150px, 1fr)` columns, so a row of 6 leaves an empty seventh column at 1366px.
- Card search keeps uncapped `auto-fill` columns. It sizes each page to the column count (`searchPageSize`), so pages already fill whole rows, and a cap would change page sizes.
- Deck board groups default to name rows with a `CardReference` thumbnail: a 100-card list is scanned by name, cost and count. Tiles is opt-in (#330). `DeckBoardLayout` places groups by the board's width (#499): List balances them into columns, none empty; Tiles lets groups share rows of 150px tile tracks.

**Dialogs**

- Card details keeps its `h2` beside the art, with the cost, instead of in `.export-heading`; the heading row holds only the eyebrow and ×. The name reads as the card's title next to its image.

**Popovers**

- The request activity panel stays a JS-positioned `popover`, because it pins open on click and must escape the header; it takes the menu surface (see **Canonical patterns › Menu**).
- `.settings-help`, `.import-help`, `.draft-help` and `.collection-picker-help` are inline helper paragraphs, not popovers. `.change-commander-confirm` is an inline panel.
- At 520px and below, Recommendation settings popovers open above their row and cover the rows above; there is no room beside them.

**Top bar**

- The Start top bar is its own markup in `StartView`, not `BuilderTopBar`: Start has no deck, so it has no deck status, Start over or Export. It keeps the same classes and button order.

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
- Every load starts in "Checking card data…", with role counts, land fill, and Doctor findings waiting for it (state `builder-card-data-loading`). `dr.builderReady()` waits for card data and the first reveal.
- States in a group share one workspace and mutate it. `saved-manual` saves "Audit deck", `rec-settings-sets` ticks the newest set, `commander-alt-printing` switches the commander's printing, `review-c-applied-history` applies a change, and `builder-health-lane` switches Priority to Theme first. Re-import the deck if a later state depends on the original.
- Theme chips on Start are grouped as Strategies, Mechanics and Creature types; each collapsed group shows the same first three chips on every load (#483). Replay fixes provider responses and uses synthetic EDHREC lists; live-mode card names can vary between runs.
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

To run every snippet below in one pass, parse this doc's fenced blocks in a Playwright script: each `// id · #issue · route · note` line starts a state, and its heading sets the group. States in a group share one context, so a long run drifts (see the notes above); re-run a failed state alone.

States the snippets don't reach directly:

- **Health lane** (`builder-health-lane`): renders only with Priority set to Theme first, for queued cards that fill a role below target. Replay needs the Theme first batch's printing lists; seed them with `pnpm dev:record` if they miss.
- **Doctor trim mode with cuts**: import the partial deck, then the complete deck with `12 Swamp` changed to `14 Swamp` (102 cards), and open Deck review. Importing the complete deck into a fresh profile misses `cards/collection`, so import the partial deck first. Autosave can be unavailable for that import, so a reload drops the deck; drive in-page. A multi-copy cut (Swamp ×14) needs "Other main-deck cards" set to Land.
- **Diagnose and history undo errors**: on the complete deck, "Apply swap" on a suggestion, go back to the builder, remove the added card, open Deck review › Change history and undo the swap. It reads "The added card changed; this swap cannot be undone safely."
- **Compare commanders with results**: in the builder, "+ Choose theme" and pick the first option, then open Deck review › Compare commanders. Seed the commander search with `pnpm dev:record` if it misses.
- **Card details "Search result"**: the `card-search-results` drive, then click a result not in the deck.
- **Change commander on a full deck**: import the complete list, then pick. Search "Golgari" is recorded.
- **Saved decks Delete hints**: save two manual decks, then **Start over**; the first draft goes inactive and its Delete enables. A second tab on `#build` shows `WorkspaceNotice`.
- **Shared deck preview and Export downloads** (#504): run `pnpm check:share-link:browser` with `SHARE_LINK_SCREENSHOTS=<dir>`. It saves Export after Copy share link, the preview, and the replace confirmation in light, dark and 390px layouts. The preview's footer is sticky so Copy stays in reach below a 100-card list.
- **Known combos** (#502): run `pnpm check:deck-combos:browser` with `DECK_COMBOS_SCREENSHOTS=<dir>`. It serves a synthetic combo index and saves Deck review's Known combos and Play experience signals in light, dark and 390px layouts, for High and Core power. Under `pnpm dev`, run `pnpm build:combo-index` first or the section says combo data is unavailable.
- **Combo offers** (#502): run `pnpm check:combo-offers:browser` with `COMBO_OFFERS_SCREENSHOTS=<dir>`. It serves a synthetic combo index and saves the first batch with a combo offer note at Core and High, in light, dark and 390px layouts.
- **Printable checklist** (#547): run `pnpm check:print-checklist:browser` with `PRINT_CHECKLIST_SCREENSHOTS=<dir>`. It saves Export with Print checklist for the whole deck and Still needed, the checklist under print media at A4 and Letter widths (light, and dark at A4), and A4 and Letter PDFs. In a live browser, open Export and press Print checklist; the print preview shows the selected list.
- **Import missing cards**: answer `cards/collection` with the fake name in `not_found` (fill `data` from cached card records) and 404 `cards/named`. Hold `cards/collection` (`block(…, () => {})`) for import loading. Grant `clipboard-read` and `clipboard-write` to see Export's Copy confirmation in headless Playwright.
- **Collection browser loading and error**: hold or fail `https://api.scryfall.com/cards/search` after ticking a set, then press "Browse these cards". A held request keeps "Loading cards…" on the button, so reload before the next state. Replay keys the collection search by date (#345); seed today's flow with `pnpm dev:record`.
- **429 chrome**: answer every `https://api.scryfall.com/` request with 429 (`retry-after: 30`) and reload `#build`. The card-data banner, header icon and activity panel appear.
- **Slow network**: delay every `/__dev-provider` response (for example 4 s in a `page.route` handler before `route.fallback()`) and reload.

Never reached so far: a card with no image ("No card art"), the commander promotion row and flip button in card details (the audit decks have neither), "To sideboard" in Change history, a flagged multi-copy cut, the outgoing commander leaving on Change commander, and the "Find more legal replacements" error (the local card index still answers).

Gates that don't exercise a surface: the contrast and card-reference fixtures use Balanced, so they never render the health lane, never open `BasicLandDialog`, never press a deck-target row and never arm the deck board ×. Check those by hand.

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
// start-more-themes · #483 · #start
await dr.text('commanders shown')
await dr.click('Show all 11 strategies')
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
// builder-add-all · #492 · #build
await dr.builderReady()
;[...document.querySelectorAll('.bulk-actions button')]
  .find((b) => b.textContent.startsWith('Add all'))
  .click()
await dr.text('with Add all')
// builder-decision-undo · #493 · #build
await dr.builderReady()
const offer = document.querySelector('.card-offer')
dr.btn('Ignore', offer).click()
await dr.wait(() => dr.btn('Undo', document.querySelector('.bulk-actions-status')))
// builder-set-aside · #493 · #build · Ignore and Later, then Next recommendations
await dr.builderReady()
const offers = document.querySelectorAll('.card-offer')
dr.btn('Ignore', offers[0]).click()
dr.btn('Later', offers[1]).click()
await dr.click('Next recommendations')
await dr.builderReady()
await dr.click('Later & ignored (2)')
await dr.dialog()
// review-starting-deck · #492 · #build · fetches basics (seed with `pnpm dev:record` on a miss); re-import afterwards
await dr.builderReady()
await dr.click('Build a starting deck')
await dr.sel('#starting-deck-draft')
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
dr.fill(await dr.sel('input[placeholder="Card name or rules text"]'), 'elf')
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
// owned-cards-import · #505 · #build · a saved list shows "View or import owned cards" instead
await dr.builderReady()
await dr.click('Recommendation settings')
await dr.click('Import owned cards')
const d = await dr.wait(() => document.querySelector('.owned-cards-modal'))
dr.fill(
  d.querySelector('textarea'),
  ['1 Sol Ring', '2 Swamp', '0 Forest'].join(String.fromCharCode(10)),
)
await dr.text('Skipped 1 line')
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
// saved-delete-confirm · #300 · #build · after saved-manual
await dr.builderReady()
await dr.click('Saved decks')
const d = await dr.dialog()
const del = d.querySelector('.saved-deck-list:not(.autosaved-draft-list) button.danger')
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
const i = await dr.sel('input[placeholder="Card name or rules text"]')
dr.fill(i, 'elf')
await dr.click('Search cards')
await dr.wait(() => document.querySelectorAll('main .card-reference-name').length > 3, 30000)
await dr.sleep(2500)
// card-search-empty · #292 · #build
await dr.builderReady()
await dr.click('+ Search & add cards')
const i = await dr.sel('input[placeholder="Card name or rules text"]')
dr.fill(i, 'zzqxvnotacard')
await dr.click('Search cards')
await dr.sleep(5000)
// card-search-error · #292 · #build · block scryfall-search
await dr.builderReady()
await dr.click('+ Search & add cards')
const i = await dr.sel('input[placeholder="Card name or rules text"]')
dr.fill(i, 'elf')
await dr.click('Search cards')
await dr.sleep(5000)
// card-search-in-deck · #292 · #build
await dr.builderReady()
await dr.click('+ Search & add cards')
dr.fill(await dr.sel('input[placeholder="Card name or rules text"]'), 'elves')
await dr.click('Search cards')
await dr.wait(() => document.querySelectorAll('main .search-card').length > 3, 30000)
;[...document.querySelectorAll('input[type=checkbox]')]
  .find((x) => x.parentElement.textContent.includes('Show cards already'))
  .click()
await dr.text('In deck (1)')
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

### Commander basics

From Start or any builder screen, choose **Commander basics** in the header; on Start, the **New to Commander?** card's **Read Commander basics** opens the same dialog. Check each term's kind label and rule or policy citation, Escape, backdrop dismissal and focus return. Dismissing the Start card moves focus to the Start heading and stays dismissed after reload (`option:primerDismissed`). `pnpm check:primer:browser` covers this journey; set `PRIMER_SCREENSHOTS` to an output directory to retain light/dark desktop and narrow captures.

### Random commander preview

From Start, choose **Random commander**. Verify its art, complete Oracle text and estimated themes, then re-roll and check that the commander changes. By default the draw ignores discovery filters; with any filter set, **Draw from: My filters** draws from the loaded Start results instead, without a provider request, and shows an empty state with **Draw from all commanders** when none match. Cancel preserves the filters. Select and continue enters the normal play-style step. Check Escape, backdrop dismissal, loading cancellation, failure recovery and focus return. `pnpm check:random-commander:browser` covers this journey with synthetic providers, including double-faced and unclassified cards. Set `RANDOM_COMMANDER_SCREENSHOTS` to an output directory to retain light/dark desktop and narrow captures.

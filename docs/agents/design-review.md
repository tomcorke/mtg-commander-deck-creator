# Design review playbook

How to run a visual design pass or a rendered UI review. The steps don't depend on this app; the case study at the end grounds each one in a real pass (the basic-land picker, commit `ad34347`).

In this repo, `docs/agents/ui.md` holds the house rules and the review gate. This playbook covers the process around them.

## Steps

### Local provider replay

Use `pnpm dev:replay` for rendered reviews. It serves recorded Scryfall responses,
synthetic EDHREC lists and generated SVG card placeholders. Plain `pnpm dev` stays
live for art-sensitive reviews; placeholders cannot verify actual art, crop,
palette or foil appearance. Live EDHREC recording is deferred to #309.

Before the first review, run `pnpm check:dev-replay record`. It records the
start-screen discovery and both Meren imports from
[Reaching each state](design-conventions.md#reaching-each-state), including a
card-details drive. Then run `pnpm check:dev-replay` to repeat the drives in a
fresh browser and assert zero upstream requests, zero misses and decoded images.
The command also captures light, dark and narrow evidence locally.

The shared cache defaults to `commander-creator/dev-replay-v1` under
`LOCALAPPDATA`, `XDG_CACHE_HOME` or `~/.cache`. `DEV_REPLAY_CACHE_DIR` overrides it;
use `.dev-replay/` for an ignored checkout-local cache. Only one recorder may own
a cache; parallel agents use replay. If `recorder.lock` survives a crashed run,
verify its recorded PID has stopped before removing that file.

A `DEV_REPLAY_MISS` stops that request without live fallback. Seed the missing
flow once with `pnpm dev:record`, then return to replay. Entries never refresh
automatically. Use a new cache directory when intentionally updating the corpus;
retain Scryfall downloads for at least 24 hours. The local card index is pinned
on first recording from an existing public/machine-cached artifact, or pinned as
unavailable. To include it, run `pnpm build:card-index` before recording into a new
directory. No replay command builds or downloads an index.

`/__dev-replay/status` reports hits, misses, upstream calls, placeholders, fixtures
and failures. A completed replay drive must show `upstream: 0`, `misses: 0` and
`failures: 0`. Independent Node scripts and external-link navigations are outside
this browser replay. Provider URLs stay original in saved decks and exports;
recordings and screenshots stay outside commits, and no card scans are acquired.

### 1. Load the house rules

Read the project's `AGENTS.md`, `CLAUDE.md` and UI guide before looking at pixels. They name the shared components, theme tokens, required states and gates.

Done when you can list: the shared components for this job, the colour and type tokens, the required themes and viewports, and the check commands.

### 2. Inventory before inventing

For each element you expect to need, search for an existing component, class or data map:

- the same visual element on another screen (the sidebar's colour-balance bar, `.colour-bar` + `.colour-segment colour-x`);
- small round buttons that can become steppers (`.deck-add`);
- spinners (`ArtLoading`), icon renderers (`ManaSymbols`), thumbnails with hover preview (`SmallCardImage`);
- maps you can invert instead of retyping (`basicLandNames` colour→name, inverted to name→symbol).

Reuse keeps the screen visually consistent with the rest of the app. It also means less new CSS to theme and less code to review.

Done when every planned element is mapped to "reuse X" or "new, because nothing fits".

### 3. Baseline the current render

Drive the real app to the surface and screenshot every sub-state, including expanded ones (the gallery open). Write down concrete problems, each tied to a lens from the reference below.

Script the navigation in one `evaluate` call: click through, then poll for the target selector. You'll replay it after every reload or HMR reset.

Done when you have a screenshot per sub-state and a list of problems, each tied to a lens.

### 4. Design against the brief's priorities

Rank problems by the goals the brief names, and fix those first. Name unrequested ideas in the handoff instead of building them.

Keep the behaviour contract: what gets submitted, when the main action is enabled, and the data shape. Change presentation and input ergonomics. If an ergonomic control constrains input (the `+` stepper disables once the total is reached), keep the free-form input working and say so in the handoff.

### 5. Implement in small, renderable slices

Edit the markup, then the styles, then re-render. Theme through tokens. Add dark overrides only for new surfaces that have no token.

When lint rejects a long function, extract the leaf sub-component with the clearest prop boundary (the gallery became `BasicLandGallery`).

### 6. Rendered review of every required state

Re-render after each meaningful change and compare it against the baseline. Cover:

- light and dark: switch through the app's own preference and reload, because the framework overwrites a hand-toggled root class;
- a narrow viewport (~375–390px): assert `scrollWidth === clientWidth` on the dialog and its scroll containers;
- interaction states: hover previews, selected, disabled, loading, error, and under- or over-filled totals;
- the sub-state that grows (gallery open, long lists).

Done when every state above has been seen rendered or is named as unchecked in the handoff.

### 7. Run the gates

Run every check the project names. Read test failures for design-system rules: a type-scale test rejected raw `18px` and `13px` font sizes, and mapping them to scale tokens fixed it. Note which gates actually exercise your surface. A contrast gate that never opens your dialog says nothing about it.

### 8. Hand off with evidence

State what changed, which behaviour is preserved, any deliberate behaviour nuance, and exactly which states and themes went unseen. Close preview tabs you opened.

## Review lenses

Use these as the checklist in steps 3 and 6.

- **Hierarchy**: one clear heading per region. Secondary actions sit in the header of the region they act on. Helper text is attached to its control or folded into a tooltip.
- **Primary-task ergonomics**: the main edit works without typing precision. For counts and splits, put steppers (~30px targets) around a numeric field.
- **Feedback**: edits show their consequence live. Proportions get a segmented bar. Totals get a status line that says what to do next ("add 1 more", "remove 2"), coloured with success or danger tokens, inside an `aria-live` region.
- **Identity cues**: give each item a colour or icon (a mana symbol, a segment colour) so rows scan without reading.
- **Selection at rest**: the collapsed row shows the current choice (thumbnail + label) and names the default explicitly ("Default printing").
- **Galleries**: thumbnails large enough to judge the art. Two label lines: name, then a muted code/number. Selection shows as an accent border plus a badge. The paging button sits below the grid with a remaining count, there's a count header, and the scroll area is contained so sibling rows stay reachable.
- **Clipping and overflow**: an absolutely positioned hover preview inside an `overflow: auto` container gets clipped and adds a phantom horizontal scrollbar. Use the top-layer preview (`SmallCardImage placement="reference"`) and give it focus handlers as well as hover.
- **Responsiveness**: grid rows collapse by moving the least important control onto its own line. Gallery columns shrink via `repeat(auto-fill, minmax())`.
- **Theming**: text uses tokens. New surfaces get explicit dark backgrounds. Selection badges keep a ring that contrasts with the panel in both themes.
- **Copy**: short, imperative and verified. Cut any claim you haven't confirmed ("newest first" went because the API's ordering was unconfirmed).

## Browser automation gotchas

- HMR or a reload resets component state. Re-run the drive-to-state script.
- Two scripted clicks inside one `evaluate` tick read the same React render, so both compute from stale state. Real clicks re-render between events, so test steppers with separate actions.
- Screenshot calls can hang after a viewport emulation change. Recover with a fresh tab: resize first, then navigate.
- Confirm layout with `evaluate` (`scrollWidth`, `getComputedStyle`). An inherited `text-transform: uppercase` on `<b>` showed in the screenshot and was confirmed with `getComputedStyle`.

## Case study: basic-land picker

| Found                                                       | Lens                 | Fix                                                                                                              |
| ----------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Bare number inputs floating mid-row, no colour cue          | Ergonomics, identity | Grid row: art/symbol tile, name + printing label, −/input/+ stepper (reused `.deck-add`), art button             |
| No view of the overall split                                | Feedback             | Live segmented bar reusing the sidebar's `.colour-bar`; grey segment for unassigned slots                        |
| "35 of 35 basics assigned" as plain text below the list     | Feedback             | Status under the bar, success/danger token, actionable wording                                                   |
| "Match commander's set" button with floating helper text    | Hierarchy            | Moved into the section header; helper text became a `title`                                                      |
| Selected printing visible only as tiny text                 | Selection at rest    | Row shows the chosen card thumbnail and "Set #number", or "Default printing"                                     |
| Gallery inline, 64px thumbnails, "Show more" as a grid cell | Galleries            | Tinted panel, count header, ~118px tiles, name + code lines, ✓ badge, paging button below with a remaining count |
| Hover previews clipped; horizontal scrollbar in the gallery | Clipping             | Optional `placement="reference"` on the shared `SmallCardImage` (top-layer popover); focus handlers on the tiles |
| Set names rendered uppercase                                | Theming              | Reset `text-transform` and `letter-spacing` on the label                                                         |
| Lint: function over 100 lines                               | Step 5               | Extracted `BasicLandGallery`                                                                                     |
| Type-scale test: raw px font sizes                          | Step 7               | Mapped to `--type-card-name` and `--type-data`                                                                   |

Not seen at handoff: dark theme at narrow width, and commander colour themes. The contrast gate doesn't open this dialog.

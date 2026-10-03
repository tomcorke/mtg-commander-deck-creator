# Design and UX review

Reviewed 2026-10-03 against `main@e7d6a1e` (app v0.1.123), running locally in Chrome at desktop width in dark mode. I built a Meren of Clan Nel Toth deck from the Death triggers theme, changed recommendation settings, picked a set, filled basics, and worked through Deck review. Light mode, narrow viewports, and keyboard-only use were not checked: the test browser ignored window resizing. Check them before acting on layout changes.

The four focus areas follow, each with observed issues and proposed changes. Cross-cutting issues and a suggested order come at the end.

**Update:** Large recommendation cards and four-card batches are deliberate design choices, so this review no longer proposes shrinking cards or enlarging batches. Prioritised work is tracked in [TODO.md](../TODO.md).

## Summary

The app has a solid engine. The interface often exposes that engine directly instead of guiding the player. The biggest problems:

1. **Tuning recommendations destroys progress.** Changing any setting restarts the recommendation cycle. Cards marked Later come straight back, unprocessed choices in the current batch are lost, and the batch counter resets. This discourages the tuning the app depends on.
2. **Recommendation reasons don't explain themselves.** The large cards and small batches work as intended, but the text around them is scorer vocabulary ("RAMP", "Evidence 12/20") rather than a reason a player can weigh.
3. **The start flow asks for one dimension at a time.** Theme and colours cancel each other out, each theme has six hard-coded commanders, and play intent (power, goal, sets) only appears later in a modal.
4. **Deck review is a long reference page, not a workflow.** It lists every basic land as its own tile, pages replacements three at a time (page 1 of 144), and requires equal cuts and additions even for a 38-card deck.
5. **Set selection is a flat text search.** It mixes digital, promo, and Commander products, reflows under the cursor, and is hidden under the label "Collection affinity".

## 1. Initial user flow

### Issues

- **Theme and colours exclude each other.** Choosing a colour clears the theme, and choosing a theme clears the colours (`src/app/useAppActions.ts:167-182`). "Tokens in green and white" is a natural request the UI can't express, and nothing warns the player that their previous choice was dropped.
- **Commander choice is thin and text-only.** Each theme maps to six hard-coded commanders (`src/domain/commander-catalog.ts`) and the list shows three at a time. "Show different commanders" re-rolls those six, so the player gets a slot machine instead of a choice. Rows show the name and mana cost only. The card image appears only on hover, off to the right, and was clipped at the viewport edge during testing.
- **The numbered steps suggest a sequence that doesn't exist.** "01 Start with a theme" and "02 Choose a commander" look sequential, but step 2 works independently and is what most experienced players want. The "Choose" button submits whatever text is in the search box.
- **Play intent comes too late.** Power level, deck goal, sets, and exclusions sit in Recommendation settings with defaults (Balanced, Core/Bracket 2, health prioritised, four exclusions) that the player never sees before the first batch. A2 in `TODO.md` already covers this.
- **No way back to the deck in progress.** With a 38-card deck in progress, the start page shows only "Build from scratch" and "Saved decks (0)". It offers no "Continue Meren of Clan Nel Toth".
- **The header mixes display preferences with actions.** "Commander art and colours" and "Motion and finishes" checkboxes sit beside Import and Saved decks. They are set-once preferences competing for attention on the first screen.

### Proposals

- **Make the start screen a filter-and-browse page.** Let themes and colours combine as filters on one commander gallery. Show commanders as a card-art grid (8–12 visible) using the existing `FinishedCardImage`, with a one-line reason under each ("Sacrifice outlet and recursion engine"). Back the gallery with a Scryfall query (`is:commander id<=… otag:…` or the EDHREC theme pages already used) instead of six fixed names.
- **Add a short "How do you want to play it?" step after the commander is chosen and before the first batch.** Show three large choices mapped to existing settings, for example:
  - _Casual / precon-level_: Core, Thematic, exclusions on
  - _Upgraded_: Upgraded, Balanced
  - _High power_: High, Competitive, exclusions off

  Add an optional "Build mostly from sets I own or like" link that opens the set picker (section 3). Put a "Skip, use defaults" link here too. This delivers A2's intent mapping without a questionnaire.

- **Add a "Continue building" card** at the top of the start page when a deck is in progress, showing commander art, card count, and last-edited time.
- **Move display preferences** (art theming, motion, dark mode) into one settings menu in the header.
- **Drop the 01/02 numbering**, or make it true: number 1 Commander, 2 Play style, 3 Build.

## 2. Tuning recommendations while building

### Issues

- **Changing settings resets the recommendation cycle.** When settings have changed, "Next recommendations" calls `start(commander, true)` instead of advancing the queue (`src/features/builder/interactions.ts:94`). `resetRecommendationState` then clears deferred cards and sets the batch number back to 1 (`src/app/recommendation-actions.ts:327-331`), and the current batch's Later and like choices are never recorded. Observed: Deadly Dispute was marked Later, I changed one setting, and the card appeared in the very next batch; the header still read "Batch 1". Learned preference scores and Ignored cards do survive.
- **Settings changes are deferred and invisible.** "Changes apply with next recommendations" means the player changes something and sees no effect. To see one, they must spend the current batch.
- **The modal has three overlapping goal controls.** "Deck goal", "Power target", and "Prioritize deck health" overlap. Choosing a goal silently resets the deck-health checkbox, and the help text has to explain that. The modal opens with an 80-word disclaimer in small type.
- **Feedback controls are vague.** Add / Later / Ignore / ♡ are the only in-flow tuning. The heart means "Prioritise similar cards", which you only learn from its tooltip. Ignore records no reason, so the app can't learn "too expensive" from "off-theme". There is no budget control, although every tile shows a price.
- **Reasons are category labels, not explanations.** "RAMP", "DEATH TRIGGERS THEME", "SELECTED COLLECTION CARD", and "Evidence 12/20" describe the scorer's internals. They don't tell the player why the card is good here.
- **"Fill to land target" is premature.** It is the most prominent sidebar action from the first card. At three cards it offered 35 basics (9 Swamp, 26 Forest, derived from four pips). Accepting it makes the deck 38% "complete" before any nonbasic lands or spells, and skews later colour analysis.

### Proposals

- **Re-rank without restarting.** Re-run ranking on the existing pool, keep deferrals, batch number, and current decisions, and only re-fetch when a setting changes the candidate pool (collection Only mode, set changes). Process the current batch's decisions before any refresh. This is the highest-value fix in this review and is mostly a wiring change.
- **Apply settings immediately to the next batch preview.** When the modal closes, briefly mark which visible cards would change ("2 cards replaced by your new settings"), or show an "Apply now" button beside the summary. Remove the pending-changes banner.
- **Collapse the goal controls into two settings:** _Power_ (Core / Upgraded / High) and _Priority_ (Theme first / Balanced / Deck needs first / Surprise me). Fold "Prioritize deck health" into Priority. Move the long caveat to one "How recommendations work" link.
- **Turn Ignore into a quick reason picker:** Not my style · Too expensive · Off-theme · Already own something similar. Each reason feeds an existing mechanism: preference score, a price cap, theme weighting. Add a _Max price per card_ setting, since price data is already loaded. Relabel the heart "More like this" with visible text.
- **Keep the large cards and small batches; they are intentional.** Place the one-sentence reason directly under the card name so it reads alongside the image.
- **Write reasons as sentences from the same data:** "In 41% of Meren decks on EDHREC", "Sacrifices creatures, which returns them with Meren", "Fills ramp: you have 2 of 10". The score breakdown stays for players who want it.
- **Add role shortcuts in the Deck targets sidebar.** Clicking a row below target (Ramp 2/10) shows a normal-size batch filtered to that role. This uses the existing role detection and ranking.
- **Move "Fill to land target" later in the build.** Show it once the deck has around 55+ non-land cards, and offer recommended nonbasic lands for the colour pair before basics.

## 3. Card set selection

### Issues

- **The set picker is hidden behind jargon.** It sits under "Collection affinity" inside Recommendation settings. Players don't think of a set list as a "collection"; they think "cards I own" or "the new set I want to play".
- **Search results are an unfiltered flat list.** "dusk" returned Alchemy: Duskmourn (digital only), Duskmourn: House of Horror, its Commander product, and its Promos, all as truncated text buttons. The list had no set symbol, release year, or card count.
- **The list reflows under the cursor.** A chosen set disappears from the results and the remaining buttons shift, so a second click lands on a different set.
- **You can only find a set by already knowing its name.** There are no recent releases or chronological groupings to browse.
- **"Only" mode gives no warning about pool size.** The legal pool count appears only after a check, and nothing warns when "Only selected collection" leaves too few candidates to finish a deck.
- **"Use set" / "Remove set" is ambiguous.** The button in each card's printing details sits next to the printing name, so it reads like "use this printing", not "add this set to my preferred sets".
- **A set list is a stand-in for a real collection.** Most players with a collection track it in Moxfield, Archidekt, ManaBox, or Deckbox, all of which export CSV or text lists.

### Proposals

- **Rename the section** "Sets to build from" and give it its own entry point: a chip in the builder header ("Sets: Duskmourn ✕") plus the optional link in the start flow.
- **Hide non-paper and supplemental sets by default.** Filter out digital (Alchemy), token, memorabilia, and promo sets with Scryfall's `digital` and `set_type` fields, behind a "Show promos and digital sets" toggle. Show each main set's Commander product as a single "+ Commander decks" checkbox on the same row.
- **Show results as stable rows** with set icon (Scryfall `icon_svg_uri`), name, year, and a checkbox. Selected rows stay in place, checked. With an empty search, list the last 12 main releases.
- **Show the legal-card count next to each mode:** "Prefer (612 legal cards)" / "Only (612)". Warn when Only leaves fewer than about 150 candidates.
- **Relabel the printing button** "Prefer this set" / "Stop preferring this set".
- **Investigate collection import** as a follow-on: paste or upload a CSV/text export, match names through the existing Scryfall collection lookup, and reuse Prefer/Only. Go/no-go: whether the major export formats can be parsed without a server.

## 4. Deck review and Deck Doctor

### Issues

- **One feature goes by four names.** The builder has a "Deck review" button above the tiles and a second one in the "Deck analysis" sidebar. The page is titled "Deck review", and the code and modals call it Deck Doctor (`DeckDoctorView`, `doctor-history`).
- **No readiness check.** A 38-card deck (3 spells and 35 basics) gets a full diagnosis: "Needs attention: 1 of 5 role targets met", a single theme finding, and a cut-and-replace workflow. Almost all of that is noise before the deck nears 100.
- **Disclaimers come before content.** The page opens with three caveat paragraphs before any result, in small type.
- **The tabs are scroll anchors.** Overview / Findings / Swap cards / History look like tabs but scroll one long page. The page mixes analysis, a two-column workspace, a commander comparison, and history.
- **The workspace layout wastes space.** The left Diagnosis column held one finding and then stayed empty for several screens while the right column grew very long.
- **Every copy of a card gets its own tile.** "Select cuts" showed every main-deck card, each basic separately: 9 Swamp tiles and 26 Forest tiles.
- **Replacements come three at a time.** Showing three per page gave "Page 1 of 144", which makes browsing impractical.
- **Swaps must be one-for-one.** "Choose equal numbers of cuts and additions before applying" blocks the obvious action for an incomplete deck (add without cutting) and for an overfull one (cut without adding). Findings don't propose specific swaps; the player picks cuts and additions separately and has to pair them mentally.
- **The mana curve doesn't look like a curve.** Only populated mana values are drawn, as large tiles ("Mana value 1", "Mana value 4"). The builder sidebar already shows a proper 0–7+ histogram.
- **Off-colour rows add noise.** For a black-green commander, White, Blue, and Red each get a row ("No pip demand", 1 source card) because Birds of Paradise taps for any colour.
- **Several labels are jargon:** "Sources reported", "Tag matches found", "Static signals from card data and rules text".
- **"Try another commander" is out of place.** It sits as a checkbox at the bottom of the review page, unrelated to the swap workflow.

### Proposals

- **Pick one name.** "Deck review" is clearer than "Deck Doctor". Keep one entry point: the sidebar header button, styled as `.primary` once the deck reaches about 90 cards.
- **Adapt the page to completeness.**
  - _Below about 90 cards_: show "Fill the gaps", meaning the role shortfalls with add-only suggestions and no cut step.
  - _About 90–100_: show the full review.
  - _Over 100_: lead with "Choose N cuts".
- **Make it a three-step flow with real views:** 1 Diagnose → 2 Choose changes → 3 Confirm. Steps 2 and 3 share a sticky tray showing "Cutting 2 · Adding 2", with Apply enabled when the deck lands at 100 or the player accepts a different count. Put History in a modal, which already exists as `doctor-history`.
- **Make findings actionable.** Each finding offers concrete swaps ("Cut Swamp → Add Deadly Dispute: ramp 2→3, draw 0→1") using the two-image comparison that `docs/agents/ui.md` already requires. Choosing cuts and additions by hand stays available as the advanced path.
- **Group duplicate cards** into one tile with a quantity stepper (Forest ×26, cut 0–26). Show flagged cards first and put "Other cards in deck" behind a type/role filter.
- **Show 12–24 replacements per page,** filtered by the selected finding or role, sortable by fit, price, and mana value.
- **Reuse the sidebar's fixed 0–7+ curve.** Hide colours outside the commander's identity, and replace the caveat paragraphs with one "How review works" disclosure.
- **Move "Try another commander"** to the commander header, next to "Change commander", as "Compare commanders".

## Cross-cutting

- **Type scale.** Content that drives decisions (settings help, review findings, score rows, sidebar targets) is set around 11–12 px. Headings are very large serif type. Raise body text to at least 14 px and reduce heading sizes on working screens.
- **Duplicate controls.** Two "Deck review" buttons and two "+ Search & add cards" buttons appear on the builder screen. Keep one of each in a consistent place.
- **The builder deck list** is a name-only column list far below the recommendations, which goes against `docs/agents/ui.md` ("compact wrapping grids or rails instead of vertical name-only lists"). Consider a collapsible deck rail on the right, shared with the sidebar's analysis.
- **Header actions.** "Start over" (destructive) sits between the dark-mode toggle and "Import", styled like the others. It does ask for confirmation, but it should look different from routine actions.
- **Rendering cost.** With four full-size foil-effect cards plus a blurred commander backdrop, the browser stalled once while taking a screenshot. Profile with "Motion and finishes" on before assuming it's fine.

## Suggested order

| Order | Change                                                                  | Complexity | Value  | Why now                                                  |
| ----- | ----------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------- |
| 1     | Settings changes re-rank instead of resetting the cycle (§2)            | Low        | High   | Behaves like a bug; makes all other tuning trustworthy.  |
| 2     | Plain-language recommendation reasons (§2)                              | Low        | Medium | Most-used screen; players learn why each card fits.      |
| 3     | Start flow: combined filters, art gallery, play-style step, resume (§1) | Medium     | High   | Subsumes A2; shapes every deck from the first click.     |
| 4     | Review: readiness modes, grouped duplicates, larger pages (§4)          | Medium     | High   | Removes the worst friction without redesigning findings. |
| 5     | Set picker cleanup and relabelling (§3)                                 | Low        | Medium | Small, self-contained.                                   |
| 6     | Finding-driven swap suggestions (§4)                                    | High       | High   | Needs pairing logic; build on 4.                         |
| 7     | Role shortcuts, Ignore reasons, price cap (§2)                          | Medium     | Medium | Builds on 1 and the existing preference scoring.         |
| 8     | Collection import (§3)                                                  | Medium     | Medium | Investigation first.                                     |

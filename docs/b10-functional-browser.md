# B10 functional browser gate

Run from `E:\working\worktrees\mtg-b10`:

```sh
pnpm install
B10_PORT=5250 pnpm check:b10:browser
```

The command above starts Vite on `127.0.0.1:5250`; the default without an override is `5240`. Port `5240` belongs to the integration gate. The script launches disposable installed headless Chrome with `chromiumSandbox: true`, and closes both on completion or failure. Windows child processes are hidden. It asserts that Chrome has no `--no-sandbox` argument. No screenshots, native-dialog answers, browser downloads, or live provider requests are used.

Overrides: `B10_PORT` selects another unused port; `B10_URL` uses an existing server without stopping it; `CHROME_PATH` selects another installed Chrome executable.

## Acceptance coverage

The script prints one compact result per scenario. Synthetic Scryfall fixtures pass `isScryfallCard`; starting decks pass the persisted-state schema. Provider routes return deterministic card lists, EDHREC pages, symbols, images, and sets. Unmodelled cards return explicit provider misses rather than invented real-card data.

- Ramp findings offer three distinct role-filling pairs. Commanders, existing ramp, lands at or below target, and the last scarce draw card are not cuts.
- Role counts and same/different curve-bucket impacts appear before applying.
- Applying updates the saved deck, finding evidence, candidates, and one history record. Undo restores the original deck and clears stale success messages. Surviving findings retain focus; resolved findings disappear with a focus fallback. History Escape returns to its connected opener, including after undo and from Confirm.
- Both images and card names preview on keyboard focus or hover. Image buttons open details; Escape returns to Diagnose. Recommendation batches remain four cards with unchanged large image widths.
- Two staged swaps remain paired through Choose changes, Confirm, history, and browser Back. They do not change the deck until Apply. Enter adds a pair; Space removes that exact pair from the same enabled button without losing focus. Overlapping or manually re-paired choices cannot remove another pair. Each disabled direct-Apply button explains the pending-plan restriction inline. Step transitions clear staging announcements.
- B14 exit protection covers explicit exits, browser Back, Keep choices, Escape, the close control, and deliberate discard. Cancelling returns focus to the review title without losing picks.
- At 89 cards, suggestions add without cuts and can be undone. At 90, suggestions swap without changing size.
- Goal changes re-rank pairs. Price, Core power, all four exclusions, Prefer/Only sets, and ignored-card updates affect replacements and suggestions. A price refresh removes an ineligible staged addition, names it, retains the cut, and leaves the deck unchanged.
- Empty, loading, provider-error, recovery, and construction-rejection paths are exercised. Wrong identity, banned cards, unknown mana value, and an existing Oracle identity never become swaps.
- The land impact label uses “Mana value: land → 2”. Arrow and keyboard art-focus contrast meet 3:1 in light, dark, and commander-themed states at 1440px and 390px. Suggestion actions fit both widths.
- All 13 original scenarios remain, plus the land-label and contrast scenario. Every scenario checks for page errors and unexpected native dialogs.

## Remaining gate: Opus appearance review

No functional failure remains. The script checks the changed arrow and art-focus colors and suggestion action bounds, but does not approve appearance. Full theme contrast, typography, narrow reflow, visible focus, preview appearance, and real card-art presentation still require Opus review. Live-provider availability and recommendation quality are not assertions in the mocked gate.

For appearance review, use a new test origin. The following optional helper reuses the real cards from `scripts/check-deck-review.ts`, fetching current Scryfall records and image URLs. It writes temporary JSON, not downloaded art:

```sh
node --experimental-strip-types --input-type=module -e "import {writeFile} from 'node:fs/promises'; import {prepareAppearanceState} from './scripts/fixtures/b10-browser.ts'; await writeFile('public/b10-appearance.json', JSON.stringify(await prepareAppearanceState()));"
pnpm dev --host 127.0.0.1 --port 5241 --strictPort
```

Open `http://127.0.0.1:5241/` in the review browser. Run this in that tab's JavaScript context; it replaces only that origin's active draft:

```js
const state = await (await fetch('/b10-appearance.json')).json()
localStorage.setItem('commander-deck-state', JSON.stringify({ version: 1, state }))
for (const key of ['darkMode', 'commanderStyling', 'cardEffects'])
  localStorage.setItem(`option:${key}`, 'false')
location.replace('/#build/review')
```

This fixture has a complete deck with surplus basics and two ramp candidates. Review Suggested swaps in light, dark, commander-themed, and 390px-wide views. Check both images, the “In deck” label, mana icons, impact text, action styles, preview placement, and focus visibility. Stage both suggestions and inspect the pending tray and Confirm comparison. The synthetic gate's placeholder images are not appearance evidence.

After review, remove `public/b10-appearance.json` and stop the appearance server. Do not commit the temporary fixture.

# Foil effects: interactive feedback loop

This is how B33's foil effects are being developed. The user reviews effects in the browser and leaves notes, and an agent watches for notes marked ready, changes the effect, and replies. The feedback pages and notes store are dev-only. Their shader and facet presets are shared with the app and lazy-loaded on foil hover.

## State on 2026-10-12

Foil development is on `feat/b33-foil-types` in `E:\working\worktrees\mtg-b33`. App integration is on its child branch `feat/b33-webgl` in `E:\working\worktrees\mtg-b33-webgl`. Neither is merged.

- **Shipped app code (branch):** foil types from Scryfall `promo_types`, finish labels ("Surge foil" and so on), finish import from text (`*F*`/`*E*`) and CSV, merged printing options, and CSS effects for surge, ripple, halo, galaxy, silverscreen, rainbow and double rainbow. Covered by tests; lint, typecheck and build pass.
- **Shared WebGL renderer (branch):** `src/shared/foil/foil-shader.ts` has a fragment shader for nonfoil, traditional, etched, surge, ripple, halo, galaxy, silverscreen, rainbow/double rainbow, step-and-compleat, fracture, raised, neon ink and dragonscale. The user prefers WebGL for most types. Etched should stay close to the CSS approach.
- **App integration (child branch):** `FinishedCardImage` uses `src/shared/foil/hover-foil.ts` to share one canvas across hovered foil and etched cards. CSS stays visible until the first WebGL frame; leave, preference changes and failures return to CSS. CORS images are cached by URL, decoded asynchronously and uploaded outside pointer handlers. Face flips and printing changes update the texture. The CSS examples on the dev pages opt out with `cssOnly`.
- **Not done:** Chrome review and user acceptance of the integration. B33 still needs moving to `COMPLETED.md`, a merge and a release once the user is happy.

## Pages

Start the dev server from the worktree with `pnpm exec vite --port 5199`. The examples below use port 5199.

- `http://localhost:5199/?foil-preview` is the feedback page. It has a grid of samples, one per finish and foil type. Clicking a card opens a comparison of CSS and WebGL with auto tilt, a notes box under each side, and a panel describing how the foil should look and how each version imitates it. Settings (dark mode, card image, auto tilt, last compared card) are remembered in `localStorage`.
- `http://localhost:5199/?foil-sheet&foil=<types>&card=<set>/<number>` is a contact sheet. It renders each listed foil (comma-separated) on one card at three fixed tilts. It loads quickly, so use it for agent checks and screenshots. Each WebGL frame has its CSS version beside it; add `css=0` to show WebGL only.

## Notes store

The dev-only `dev-feedback` plugin in `vite.config.ts` stores notes in `dev-feedback/foil-feedback.json`, which is git-ignored. Each note has an `id` of `<foil>:<css|webgl>`, the user's `text`, a `status` of `draft`, `ready`, `working` or `done`, and the agent's `reply`. The page polls the store every 3 seconds.

## Agent loop

1. Run the watcher in the background. It exits and prints the notes when any note is `ready`:
   `node --experimental-strip-types scripts/foil-feedback-watch.ts`
2. For each ready note, mark it working:
   `node --experimental-strip-types scripts/foil-feedback-note.ts <id> working`
3. Re-run the watcher straight away, so new notes aren't missed while you work.
4. Change the effect. Shaders are in `src/shared/foil/foil-shader.ts`, with facet presets in `src/shared/foil/facet-shards.ts`, CSS effects in `src/styles/cards.css`, preview samples and overrides in `src/dev/FoilPreview.tsx`.
5. Update `src/dev/foil-descriptions.ts` in the same change, so the side panel always matches the effect.
6. Check the result on a contact sheet in Chrome, at two or three tilts, with one zoomed screenshot.
7. Reply and mark it done:
   `node --experimental-strip-types scripts/foil-feedback-note.ts <id> done "<what changed, with a contact-sheet link>"`
8. Run `pnpm lint` and `pnpm typecheck`, then commit.

## Lessons from the user's feedback

- Almost every foil should fade out off-axis. The shader's `onAxis` factor gives about 15% strength away from the light and full strength near it.
- Effects should vary with angle: colour shifts, and parts appear and disappear. Avoid patterns that are visible everywhere all the time, or that look like even stripes.
- Effects should be readable: dark ink and text keep their contrast.
- Use a hard-light blend built as offsets from mid-grey (0.5), so foil tints light and dark ink alike. Use screen only for bright sparkle on dark areas.
- Choose sample scans without foil photographed or printed in. Halo uses Multiverse Legends; step-and-compleat, fracture and raised use the overrides in `FoilPreview.tsx`.
- Look at real reference photos first. mtg.wiki "Foil" has a gallery, and the image API is `https://mtg.wiki/api.php?action=query&prop=imageinfo&iiprop=url&titles=File:<name>`.
- `half` is a reserved word in GLSL ES; don't use it as a variable name.
- Use more than one source for each foil's description (mtg.wiki, Wizards announcements, collector photos and videos). Cite them in `expected`, and say where they disagree.
- Preview each foil type on a real printing with that foil, even when its scan shows the foil printed in. A clean stand-in is usually a printing that never had the foil. Photos of real foil cards are reference only; never tune an effect to look right on a stand-in.

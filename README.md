# Commander deck creator

Interactive browser app for building a 100-card MTG Commander deck. Pick a theme, colour identity, or commander, then review cards in small batches and export the result for Moxfield.

## Run locally

Requires Node.js 22.

```bash
pnpm install
pnpm dev
```

Vite prints the local URL and reloads the page after source changes.

## Checks

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## Recommendation audit

Run all three headless policies against four reference precons:

```bash
pnpm audit:recommendations -- --output recommendation-audit.md
```

The script fetches current Archidekt, EDHREC, and Scryfall data, then imports the same recommendation builder and queue transition functions used by the app. It does not automate or duplicate the UI implementation.

## Design decisions

- React, TypeScript, and Vite provide a client-only single-page app with fast local HMR.
- Production output is static. The `publish` branch contains the built app at its root for GitHub Pages.
- No backend is required. Recommendations use public EDHREC commander data, with Scryfall supplying card details and fallback popularity ordering; see [`docs/recommendation-design.md`](docs/recommendation-design.md).
- Deck creation starts empty. Users can choose a theme, combine colour identity filters, or search all commanders. Commander suggestions show aligned mana costs, including generic mana.
- Recommendations arrive in manual batches of four where possible, without dropping leftover candidates.
- Power targets map to Commander brackets and tune safety filters; precon mode also excludes common fast mana.
- Batches include a creature when possible. Users can disable this once their creature count is high enough.
- Game Changers, tutors, and extra-turn cards are excluded by default. Users can disable each bracket-safety filter.
- Add, later, ignore, and more-like-this choices stay visible until the user requests the next batch. Deferred cards can return. Accepted and ignored cards do not.
- Alternate art uses Scryfall printings and appears only when more than one image exists. Selected set and collector number carry into exports.
- Export opens an in-app modal with Moxfield, plain-text, and CSV formats plus clipboard copy. Moxfield has no documented public URL for a prefilled import, so the app links to its deck importer.
- Commander previews use native CSS Anchor Positioning so the full card stays attached to its thumbnail and flips when space is limited.
- Dark mode is the default, with a user-controlled light mode. Headings use Spectral and body copy uses DM Sans.
- Deck state and recommendation history persist in `localStorage`; `Start over` clears them after confirmation.

## Publishing

Run `pnpm build` from `feature/initial-app`, then replace the root contents of `publish` with `dist/` and push that branch. Configure GitHub Pages to deploy from the `publish` branch root.

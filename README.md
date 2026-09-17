# Commander deck creator

Interactive browser app for building a 100-card MTG Commander deck. Pick a theme, colour identity, or commander, then review cards in small batches and export the result for Moxfield.

## Run locally

Requires Node.js 22.

```bash
npm install
npm run dev
```

Vite prints the local URL and reloads the page after source changes.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Design decisions

- React, TypeScript, and Vite provide a client-only single-page app with fast local HMR.
- Production output is static. The `publish` branch contains the built app at its root for GitHub Pages.
- No backend is required. The browser reads card data, images, colour symbols, printings, and popularity ordering from Scryfall.
- Deck creation starts empty. Users can choose a theme, combine colour identity filters, or search all commanders.
- Recommendations arrive in manual batches of four: three non-land cards and one land or mana card.
- Batches include a creature when possible. Users can disable this once their creature count is high enough.
- Game Changers, tutors, and extra-turn cards are excluded by default. Users can disable each bracket-safety filter.
- Add, later, and ignore decisions remain visible until the user requests the next batch. Deferred cards can return. Accepted and ignored cards do not.
- Alternate art uses Scryfall printings and appears only when more than one image exists.
- Commander previews use native CSS Anchor Positioning so the full card stays attached to its thumbnail and flips when space is limited.
- Current state is in memory. Refreshing the page resets the deck. Persistence can wait until users need it.

## Publishing

Build source from `feature/initial-app`, then replace the root contents of `publish` with `dist/` and push that branch. Configure GitHub Pages to deploy from the `publish` branch root.

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
- Recommendations arrive in manual batches of four where possible, without dropping leftover candidates. Each card gets a 0-100 deck-fit score; only the strongest card gets a `Recommended` badge, and only at 50 or above.
- Power targets map to Commander brackets and tune safety filters; precon mode also excludes common fast mana.
- Batches include a creature when possible. Users can disable this once their creature count is high enough.
- Game Changers, tutors, and extra-turn cards are excluded by default. Users can disable each bracket-safety filter.
- Add, later, ignore, and more-like-this choices stay visible until the user requests the next batch. Deferred cards can return. Accepted and ignored cards do not.
- Alternate art uses Scryfall printings and appears only when more than one image exists. Selected set and collector number carry into exports.
- Export opens an in-app modal with Moxfield, plain-text, and CSV formats plus clipboard copy. Moxfield has no documented public URL for a prefilled import, so the app links to its deck importer.
- Commander previews use native CSS Anchor Positioning so the full card stays attached to its thumbnail and flips when space is limited.
- Dark mode is the default, with a user-controlled light mode. Headings use Spectral and body copy uses DM Sans.
- Deck state and recommendation history persist in `localStorage`; `Start over` clears them after confirmation.

## Planned work

See [TODO.md](TODO.md) for planned tasks, supporting context, ratings, and suggested order.

## Publishing

The `publish` branch is the GitHub Pages artifact branch. Publish only from a checked-out `main` branch, and never publish staged, unstaged, or untracked changes. Do not edit the published files by hand. The Vite build reads the fetched `origin/publish` ref to derive the app version, so fetch that branch before building. The `CNAME` and `.nojekyll` files must remain at the publish root.

Run the whole release in the same shell. These checks deliberately stop the release unless `main` is checked out and the source worktree is clean:

```bash
git switch main
git pull --ff-only origin main
git fetch origin publish
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain)"
main_commit=$(git rev-parse HEAD)
main_short=$(git rev-parse --short HEAD)

pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build

# Recheck after installing and building so no source change can enter the release.
test "$(git branch --show-current)" = main
test "$(git rev-parse HEAD)" = "$main_commit"
test -z "$(git status --porcelain)"

publish_worktree=../mtg-commander-deck-creator-publish
git worktree add --detach "$publish_worktree" origin/publish
git -C "$publish_worktree" rm -r --ignore-unmatch .
git -C "$publish_worktree" clean -fdx
cp -R dist/. "$publish_worktree"/
git -C "$publish_worktree" checkout HEAD -- CNAME .nojekyll
git -C "$publish_worktree" add -A
git -C "$publish_worktree" commit -m "Publish main@$main_short" -m "Source-main-commit: $main_commit"
git -C "$publish_worktree" push origin HEAD:publish
git worktree remove "$publish_worktree"
```

The cleanup commands are safe only in this dedicated temporary worktree. The publish commit subject and body identify the exact `main` commit used to produce the artifact. If the push fails, leave the worktree in place while investigating and remove it only after the publish succeeds. Configure GitHub Pages once to deploy from the `publish` branch root; the preserved `CNAME` points the site at `commander-creator.corke.dev`.

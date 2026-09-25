# Agent instructions

## Development

- Keep the app client-only until remote APIs require server-side secrets or proxying.
- Use Scryfall image URLs for card art; do not commit downloaded card images.
- Use pnpm. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` before handoff.
- For UI changes, read `docs/agents/ui.md`, reuse its shared components and classes, and pass its review gate.

## Releases

1. Release only from an updated, checked-out `main` branch.
2. Require `git status --porcelain` to be empty before and after the build, including staged, unstaged, and untracked files.
3. Fetch `origin/publish`, then run `pnpm lint && pnpm typecheck && pnpm build`. Vite derives app version `0.1.x` from the publish branch's commit count; never update it manually.
4. Copy `dist/` to `publish`, preserving `CNAME` and `.nojekyll`.
5. Commit `publish` as `Publish main@<short-sha>` with `Source-main-commit: <full-sha>` in the message body, using the exact `main` commit that was built.
6. Push `publish` and verify `https://commander-creator.corke.dev/` serves the new asset hash.

Batch only tightly related edits. Skip publishing docs-only changes.

## References

- Issues and specs live in GitHub Issues; use `gh`. See `docs/agents/issue-tracker.md`.
- Read `TODO.md` when a task matches planned work; it records scope, context, ratings, and suggested order.
- This is a single-context repo. See `docs/agents/domain.md`.

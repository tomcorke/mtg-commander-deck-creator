# Working agreement

For each release:

1. Check out and update `main`. Never publish from another branch.
2. Require `git status --porcelain` to be empty before and after the build. Never publish staged, unstaged, or untracked changes.
3. Fetch `origin/publish`, then run `pnpm lint && pnpm typecheck && pnpm build`. The build derives `0.1.x` from the publish commit count; never edit the version manually.
4. Copy `dist/` to `publish`, preserving `CNAME` and `.nojekyll`.
5. Commit `publish` as `Publish main@<short-sha>` with a `Source-main-commit: <full-sha>` message body, using the exact `main` commit that was built.
6. Push `publish` and verify `https://commander-creator.corke.dev/` serves the new asset hash.

Batch only tightly related edits. Skip publish for docs-only changes.

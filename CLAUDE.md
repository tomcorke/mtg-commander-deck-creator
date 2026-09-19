# Working agreement

After each verified user-visible change:

1. Commit and push `feature/initial-app`.
2. Run `pnpm lint && pnpm typecheck && pnpm build`. Build derives `0.1.x` from `origin/publish` commit count, so fetch before building and never edit version manually.
3. Copy `dist/` to `publish`, preserving `CNAME` and `.nojekyll`.
4. Commit and push `publish`.
5. Verify `https://commander-creator.corke.dev/` serves new asset hash.

Batch only tightly related edits. Skip publish for docs-only changes.

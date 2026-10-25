# Agent instructions

## Development

- Keep the app client-only until remote APIs require server-side secrets or proxying.
- Use Scryfall image URLs for card art; do not commit downloaded card images.
- Use pnpm. Open a PR or request review only once `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass on the branch.
- For UI changes, read `docs/agents/ui.md` first. It defines component reuse across screens, visual consistency, mana presentation, card previews, themed controls, full-page workflows, and rendered review.

## Releases

1. Release only from an updated, checked-out `main` branch.
2. Require `git status --porcelain` to be empty before and after the build, including staged, unstaged, and untracked files.
3. Fetch `origin/publish`, then run `pnpm lint && pnpm typecheck && pnpm build`. Vite derives app version `0.1.x` from the publish branch's commit count; never update it manually.
4. Copy `dist/` to `publish`, preserving `CNAME` and `.nojekyll`.
5. Commit `publish` as `Publish main@<short-sha>` with `Source-main-commit: <full-sha>` in the message body, using the exact `main` commit that was built.
6. Push `publish` and verify `https://commander-creator.corke.dev/` serves the new asset hash.

Batch only tightly related edits. Skip publishing docs-only changes.

## Project planning

- GitHub issues are the source of truth for planned work. Run `gh issue list` before planning; open, update, or close issues when scope or priority changes.
- Read an issue with `gh issue view <n> --comments`. Comments carry scope changes and links from merged groundwork that the issue should build on.
- Label each issue with `complexity:`, `value:`, and `risk:` (`low`/`medium`/`high`). The issue number is the only work-item ID; give new issues no other ID. `COMPLETED.md` is a frozen record of goals closed before the move, under their old A/B IDs.
- This is a single-context repo. See `docs/agents/domain.md`.

## MTG domain knowledge

- Read `CONTEXT.md` before code, docs, or UI copy that depends on an MTG or Commander fact. Shared rules, policy, eligibility, and provider knowledge live in `E:/working/mtg-knowledge-base`; read its `AGENTS.md` and matching topic before relying on or updating a claim. Keep that checkout beside this repository. App terminology, heuristic limits, and audits stay here. Sourced references outrank remembered MTG knowledge.

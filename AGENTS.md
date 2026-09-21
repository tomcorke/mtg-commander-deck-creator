# Agent instructions

- Keep app client-only until remote APIs require server-side secrets or proxying.
- Use Scryfall image URLs for card art. Do not commit downloaded card images.
- Use pnpm. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` before handoff.
- Fetch `origin/publish` before release builds. Vite derives app version `0.1.x` from that branch's commit count. Never update version manually.
- Publish only from a checked-out `main` branch whose worktree is completely clean, including staged, unstaged, and untracked files.
- Include the exact source commit from `main` in every publish commit message, using `Publish main@<short-sha>` and a `Source-main-commit: <full-sha>` message body.
- For UI changes, read `docs/agents/ui.md` and follow its shared component, button, and modal rules.

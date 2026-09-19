# Agent instructions

- Keep app client-only until remote APIs require server-side secrets or proxying.
- Use Scryfall image URLs for card art. Do not commit downloaded card images.
- Use pnpm. Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` before handoff.
- Fetch `origin/publish` before release builds. Vite derives app version `0.1.x` from that branch's commit count. Never update version manually.

# Completed-feature acceptance — 2026-10-04

## Scope

[Release PR #11](https://github.com/tomcorke/mtg-commander-deck-creator/pull/11) integrates A14, A2/A9, B10, B11, B4 and B12, plus the completed A15 policy/provider fixes and A6 technical validation packet. Feature PRs are #3–#10; all their heads are ancestors of the release branch.

A16–A19 and B15–B17 were not implemented for this release. A6's representative-player relevance gate and A15's native Moxfield import check remain open.

## Frozen reviews

Final code snapshot: `6cb205d11263ffebb75e7a4d1b0b127d6dffabda`. Planning-only changes and the main merge must not change that code tree. The published build's exact main SHA is recorded by `Source-main-commit` in the publish commit.

- Opus first-use/B12 appearance review passed on frozen `3e24810`; final delta passed on `6cb205d` using plugin-controlled Chrome at port 5266.
- Opus A14/B10/B11/A15/B4 composed UI review passed on frozen `3e24810`; final details/history/B10 delta passed on `6cb205d` at port 5267.
- Read-only engineering review found printing-loss races in detail hydration and promotion. Held-response checks reproduced both. Fixes passed re-review on frozen `1ed35c8`; subsequent code changes only addressed guide Escape.
- Guide Escape after a step change reproduced a failure in dark mode. A document capture listener fixed it; the expanded first-use gate passes light, dark and 390px.

Old review checkouts stayed immutable. Functional assertions and appearance acceptance were separate gates. Browser storage and provider fixtures were disposable; production storage and unrelated tabs were not used.

## Checks

- All 297 unit tests pass.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` and diff checks pass. Existing nonblocking React diagnostics and the bundle-size warning remain.
- A14: six Chrome scenarios, including real quota exhaustion, active/manual retention safety, unchanged inherited tabs, migration, deletion/focus and previews.
- A2/A9: light/dark/390px discovery, preset/sets, display, guide keyboard/Escape, resume, Skip and prepared-draft reload.
- B10: fourteen Chrome scenarios for finding pairs, filters, pending plans, readiness, apply/findings/history/undo, focus, contrast and narrow actions.
- B11: native disclosures, highlight after metadata refresh, deck/sideboard previews, DFC details and foil/etched effects. The post-load mocked-provider profile recorded zero tasks of at least 50ms.
- B12: light/dark/390px/offline current-data refresh, persistent warnings, invalid 100-card state, printing/choices and details.
- A15: all ten help triggers keyboard/geometry checked at 1440/1024/768/390px in light/dark, with preference/export copy and dialog focus.

Not every visual path was tested in every theme/width. Opus's first-use preset/guide inspection was light desktop; narrower resume/warning paths and dark states were inspected separately. Final delta review reused earlier evidence for unchanged CSS/markup. Opus could not reliably advance commander art in a background tab; functional printing checks remain the evidence for that path.

## Remaining gates and nonblocking follow-ups

- A6: technical transport/queue evidence does not establish representative-player relevance. No verified waiver is claimed.
- Moxfield: help was reachable, but the app did not load and headless access returned 403/Cloudflare. Native commander-import behavior is unverified; export copy describes this app's format rather than asserting a Moxfield limitation.
- Resume and Clear highlight can leave focus on the page body; retain these for the keyboard/focus follow-up.
- DFC Flip can overlap the discovery tile's name line; the Choose label remains readable.
- Current-data warnings can list a card twice for separate changed/invalid facts.
- On the play-style screen, Skip is visually stronger than the preset buttons.
- Review role heuristics, fill-the-gap findings and narrow progress layout remain in B15–B17/A18, not accepted new work.

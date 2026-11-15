# Functional staples (#591)

Decision: offer bounded off-theme functional staples after a role target is met, while keeping Theme first unchanged. See [heuristic](domain/heuristics.md#functional-staple-offers-591).

Used #379's pinned recordings and #592's prepared pools unchanged for both scoring versions, with the accept-all reducer simulation (recommend runs once at pool load; subsequent batches use only nextBatch) and failed signature enrichment described in [functional-support-379.md](functional-support-379.md). No network requests or live EDHREC recordings. Baseline: scoring version 9 at d2eea7b; after: version 10. Local inputs: `E:/working/agent-sandbox/research/issue-592/pool-before-{rabbit,krenko,tatyova}.json`; outputs: `E:/working/agent-sandbox/research/issue-591/{before,after}-{rabbit,krenko,tatyova}.json`. Simulator: `issue-591/simulate.ts` in that research root, with WORKTREE pointing to this worktree and policy accept-all. Each build ends at 100 cards.

| Balanced / Upgraded | Sol Ring first batch, before to after | Theme cards, before to after |
| ------------------- | ------------------------------------- | ---------------------------- |
| Rabbit              | 9 to 9                                | 54 to 53                     |
| Krenko              | 15 to 12                              | 71 to 70                     |
| Tatyova             | never to 8                            | 61 to 60                     |

Arcane Signet and Cultivate remain unoffered in Krenko/Tatyova. The heuristic does not guarantee every commonly played card: Cultivate is on-theme for Tatyova and competes through ordinary ranking. Theme loss is one card in each comparison, accepted as a small cost for bounded functional exposure. Counts and batches are measured simulation outputs, not play results. Provider inclusion is the dated #379 evidence, not a fresh popularity claim.

Regression coverage compares Theme first and the target + 2 ceiling to ordinary ranking, and checks ignore, price cap, set restriction, ownership and deck budget. No land planning, bulk-add or UI changes.

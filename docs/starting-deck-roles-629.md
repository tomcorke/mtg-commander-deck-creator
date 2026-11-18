# Starting-deck completed roles (#629)

Offline same-pool reconstruction using `E:/working/agent-sandbox/research/629-measure.mjs`, derived from #619; commander-only starts, original targets, Core Kotis and Upgraded pinned #379 cases, both priorities, no budgets or decisions. Baseline main `9cb6849` after #643, scoring 15; after 16. Same recorded pools and 2026-11-18 local index, no live EDHREC. This does not replay the original audit player decisions. Artifacts: `E:/working/agent-sandbox/research/629-rebased-before.json` and `E:/working/agent-sandbox/research/629-rebased-after.json`.

| Case             | Ramp before -> after | Draw          | Removal     | Wipes      | Theme    |
| ---------------- | -------------------- | ------------- | ----------- | ---------- | -------- |
| rabbit-thematic  | 10 -> 10 / 10        | 11 -> 11 / 10 | 8 -> 8 / 8  | 3 -> 3 / 3 | 44 -> 44 |
| rabbit-balanced  | 28 -> 10 / 10        | 15 -> 11 / 10 | 11 -> 8 / 8 | 3 -> 3 / 3 | 23 -> 44 |
| krenko-thematic  | 10 -> 10 / 10        | 11 -> 10 / 10 | 8 -> 8 / 8  | 3 -> 3 / 3 | 53 -> 53 |
| krenko-balanced  | 17 -> 10 / 10        | 10 -> 10 / 10 | 25 -> 8 / 8 | 4 -> 3 / 3 | 45 -> 56 |
| tatyova-thematic | 11 -> 10 / 10        | 11 -> 11 / 10 | 8 -> 8 / 8  | 3 -> 3 / 3 | 49 -> 48 |
| tatyova-balanced | 42 -> 10 / 10        | 23 -> 11 / 10 | 8 -> 8 / 8  | 3 -> 3 / 3 | 22 -> 49 |
| kotis-thematic   | 10 -> 10 / 10        | 12 -> 10 / 10 | 8 -> 8 / 8  | 3 -> 3 / 3 | 37 -> 37 |
| kotis-balanced   | 17 -> 10 / 10        | 24 -> 10 / 10 | 8 -> 8 / 8  | 3 -> 3 / 3 | 18 -> 38 |

Completed-role cards now wait behind eligible filler without completed roles. Queue order remains within each pass. Exhaustion permits fallback; favourites and overlapping roles can exceed targets. This is a preference, not a hard cap. #591's every-fourth-batch staple reservation remains unchanged in interactive composition; a reserved staple no longer forces a draft pick merely through its old queue position. Favourite reservation (#618), speculative cap (#619), and role counting (#592/#626) remain intact. Land planning is unchanged, though different spells can change its demand inputs. Theme totals and role reductions above describe composition, not gameplay quality.

All majority-inclusion theme favourites remain drafted, initial top-twelve queues are unchanged, and speculative local theme spells stay within three in every case. `tatyova-thematic` loses one theme card (49 to 48); every other theme total stays level or rises. All measured nonland roles finish within target +1. These are preference limits rather than hard caps: favourites are retained and overlapping roles remain eligible when alternatives for an unmet role run out.

Peer review: Claude Opus 5.5 at high effort identified completed-role overlap in the quota pass. Both quota and filler passes now prefer cards without completed roles before falling back. A regression places an overlapping ramp/draw card before a draw-only alternative after ramp is full. The table reflects the corrected implementation.

# Dev-3 pool exhaustion diagnosis

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98), 2026-10-29. This note diagnoses the dev-3 stop recorded in [supervised build evidence v5](supervised-build-evidence-v5.md). Earlier evidence is unchanged. The data fault is tracked in [#264](https://github.com/tomcorke/mtg-commander-deck-creator/issues/264).

## Finding

**Pool exhaustion is the proximate cause of the stopped recommendation.** The dev-3 recipe holds 47 candidates. The builder decided every one of them, and then deliberately called `nextBatch` with nothing left to rank. The earliest observed limitation is narrow retrieval coverage; the evidence does not establish that this prevented completion through lookups or repeated basics. Ranking, filtering, misclassification and batching did not cause the empty queue.

| Stage                   | Result                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Retrieval               | Query `id<=g legal:commander (t:bear or t:basic)`, name order. The provider returned 49 cards (`hasMore: false`). This is the earliest coverage limitation: the query restricts retrieval to Bears and basics.                       |
| Filtering               | 49 became 47. The only two removed were the commander (Ayula) and basic Forest. That is expected, not a wrong filter.                                                                                                                |
| Ranking and batching    | Not implicated. The log shows 56 `decide` commands and 14 `nextBatch` commands. The stopped state has 44 of 47 initial-pool cards in the deck, 3 initial-pool cards ignored (Wastes, Snow-Covered Wastes, Spectral Bears), 0 queued. |
| Stop                    | `recommend` returns `Too few recommendation cards` when fewer than four legal candidates remain (`src/domain/recommender.ts:312`). The supervisor recorded `invalid`.                                                                |
| Suitability of the pool | The 47 candidates alone do not supply 99 distinct choices; support cards or repeated basics are needed. The builder used `lookup` (command indexes 6 and 12) and `addRetrieved` (18?50) before the final `nextBatch` probe (105).    |

Correction to v5: it describes the exhausted pool as 49 cards. The provider returned 49, but the prepared and builder pool was 47 candidates, matching [common-input evidence v2](common-input-evidence-v2.md).

The builder's last command was a deliberate `nextBatch` probe (`append-14.jsonl`). Treating an exhausted pool as an `invalid` stop is a supervisor and stop-rule choice. This diagnosis does not establish it as a defect, so it has no issue.

The in-build pool refresh added in slice 13 (PR #221) needs provider requests. It is not part of the dev-3 recipe, which used a single Scryfall type search. This diagnosis did not test whether the app's own multi-source pool would suffice; that is the hypothesis in #264.

## Substitute development spec

If dev-3 cannot be rebuilt without new preparation, the baseline's third bracket can use **development-6** (Kozilek, the Great Distortion, bracket 1, colourless-ramp). It keeps bracket 1, which dev-3 would have covered, alongside dev-1 (bracket 2) and dev-2 (bracket 3). Its prepared pool has 2,233 candidates and replayed exactly offline.

Exact development inputs, under `E:/working/agent-sandbox/research/deckbuild/issue-98-remaining-development-preparations/`:

- `development-6-recipe.json`
- `development-6-preparation.json`
- `development-6-provider-recipe.json`
- `development-6-replay.json`

Details are in [remaining development preparations v1](remaining-development-preparations-v1.md). The fallback with a different bracket is development-4 (Zada, bracket 4, 1,407 candidates, [v2](common-input-evidence-v2.md)). Neither substitute has been built or checked for a Bear-style sufficiency count beyond the pool sizes above.

## Reproducibility

Recorded inputs (read-only, no copies modified):

| Path under `E:/working/agent-sandbox/research/deckbuild/`       | SHA-256 (prefix) |
| --------------------------------------------------------------- | ---------------- |
| `issue-98-common-input-evidence-batch-2/dev-3-recipe.json`      | `c4c1497c…8ba1`  |
| `issue-98-common-input-evidence-batch-2/dev-3-preparation.json` | `47358a14…b32f`  |
| `issue-98-reviews-noise-dev3-v5/build-dev3/extend-14.json`      | `40931efe…c2`    |
| `issue-98-reviews-noise-dev3-v5/build-dev3/stop.json`           | `038cafac…bcc`   |
| `issue-98-reviews-noise-dev3-v5/build-dev3/inputs.json`         | `78547f32…b5`    |

Method: read the JSON with Node, then count the 47-card `initialState.queue` against `extend-14.json` `state.deck` and `state.ignoredCards`, and compare the preparation's 49 provider cards with the 47 recipe pool names. Replay equality for the record and extensions 1–13 is already recorded in v5; this note did not repeat it.

Bounds, written before any inspection to `E:/working/agent-sandbox/research/deckbuild/issue-98-dev3-pool-exhaustion/bounds.md`: 15-minute timebox, zero provider fetches, zero builder, `explain` or `replay` commands (no builder command was needed), exact development paths only. No holdout path was opened or listed, and the dev-3 evidence was not modified.

## Limits

- The 47 versus 99 count is arithmetic from recorded files. The claim that `appPool` or a broader query would suffice is untested.
- Only the `nextBatch` failure was traced. This note does not assess deck quality. V5 reports 83 cards at the last verified run; the stopped `extend-14.json` instead contains 85 deck entries and 8 ignored entries. These are different checkpoints; this note does not certify a final deck count.
- No knowledge-base claim is made or changed. The deck facts above come from the recorded files and Scryfall results, not from MTG rules.
- No application change, label, PR #256 use, publishing or rank-bench work occurred.

Parent verification: one bounded direct `explainCard` attempt stopped before execution because `pnpm exec tsx` was unavailable (exit 1); no retry or network provider call. Thus the requested executable explain evidence is unavailable in this slice. The recorded manifest/state and source establish the pool count; replay equality remains inherited from v5. Follow-up bounds: `issue-98-dev3-pool-exhaustion/explain-bounds.md`.

Single review (Sonnet 5.5, medium): R1?R3 corrected the timing and causal overclaims; R4 distinguishes stopped and verified checkpoints; R5 clarifies initial-pool counts; R6 clarifies network wording. The review returned CHANGES. No second round was requested under the one-round limit; explicit approval remains outstanding.

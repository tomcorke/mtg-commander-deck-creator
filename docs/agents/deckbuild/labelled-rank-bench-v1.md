# Labelled ranking baseline: dev-1 and dev-2

Part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98). Two real frozen 71-card states now have agent-authored labels and a user spot-check. This is a partial baseline: the real-suite acceptance box remains unchecked because development-6 (bracket 1), selected as the substitute by merged PR #266 (`36313a0`), has no retained build to freeze. Dev-3 follow-up remains in #264; no dev-6 build is attempted here. No recommender quality improvement is claimed.

Raw evidence stays outside the checkout at `E:/working/agent-sandbox/research/deckbuild/issue-98-labelled-suite-v1/`. `provenance.json` records 42 source/artifact hashes; `states/` contains extraction metadata and frozen states, `labels/` the original label sources, and `tools/` the extraction/assembly scripts. `suite-agent-original.json` preserves the original suite, `suite.json` adds human review metadata, and `human-review.json` retains the user's grades and exact supplied comments. `record-human.py` records that update. Original inventoried artifacts are retained; their original hashes describe the pre-review artifacts.

## Frozen states and labels

| Case     | Spec           | Deck size including commander | Pool | Labels | Earlier offered names |
| -------- | -------------- | ----------------------------- | ---- | ------ | --------------------- |
| dev1-b71 | dev-1, Krenko  | 71                            | 348  | 348    | 56                    |
| dev2-b71 | dev-2, Tatyova | 71                            | 107  | 109    | 8                     |

Both cases are tuning cases. Sources are `issue-98-dev1-review-repeats/build-repeat-1/replay-14.json` and `issue-98-independent-dev2-v4/replay-3.json`, under the same research parent. Each retained replay report is byte-identical to its extend report. Extraction uses the CLI candidate merge and strict rank-bench schema; current-main visible batches match the retained reports. This is extraction from existing offline replay output, not a new current-version CLI replay: recorder-version pinning prevents that replay at the evaluation SHA. Historical recorder SHAs are `2a7ecddc0c5bcd00a1271a4cffd1f32021e7e30b` and `4a4ae137e9b735b90aca5a3815ab0fa8b1c3fc7d`.

Claude Sonnet 5.5, high effort, graded all pool members alphabetically from Oracle text, the partial deck and fixed brief, without production scores as labels. The single-version baseline pool is its own union; a retrieval challenger needs additional union labels before comparison. Dev-2 also labels absent plain Forest and Island from retained builder lookup evidence. Agent grade counts (0/1/2/3) are 115/141/67/25 for dev-1 and 11/35/47/16 for dev-2. All unsampled labels remain `humanReview: pending`.

The labeller consulted Commander rules and format-policy topics at KB commit `5d2a986c597a71a81fe8aaccc8a639082db35eb7`. Labels are heuristic fit judgements, not legality certification. Empty `forbiddenCards` lists assert no known spec violations; exclusion settings are already reflected in the frozen pools and are not independently enforced by this benchmark. Sticker-related legality remains unresolved. The user's Name Sticker Goblin judgement concerns play value only.

## Human spot-check

The user checked 15 selected labels: 10 agreements and five disagreements (66.7% agreement in this selected sample, not an estimate for the whole pool).

| Card                      | Agent grade | Human grade |
| ------------------------- | ----------- | ----------- |
| Molten Duplication        | 1           | 2           |
| Kiki-Jiki, Mirror Breaker | 2           | 3           |
| Hatchet Bully             | 0           | 1           |
| "Name Sticker" Goblin     | 0           | 1           |
| Tato Farmer               | 1           | 2           |

Agreements: Shock Brigade 2; Muxus 3; Goblin Chieftain 3; Gut 3; Dryad of the Ilysian Grove 2; Tam 3; Tireless Tracker 3; Snow-Covered Wastes 0; Werewolf Lightning Mage 0; Forest 2. Full card names, exact comments and original grades are in `human-review.json`; the human grade is also recorded in each sampled label's `humanNote`, with `humanReview` set to agreed or disagreed.

All five disagreements raised the grade by one. The user identified systematic undervaluation of value/synergy cards: copy effects, sacrifice uses and situational ramp. Treat this as a labelling finding to check in future samples. The contract permits recording disagreement without replacing the agent grade. No deliberate relabelling was performed, so there is no revised-grade baseline or implied human endorsement of the other 442 labels. A future relabelling must rerun every compared version. `spot-check.md` retains the original pending questionnaire; `human-review.json` is the completed response record.

## Baseline results

`rank-bench.ts evaluate` first ran at fetched main `10cfca2a139d1643c0bf1c6ea076c38fac49a969` (scoring version 3), before the human check. Its original report is `report-main-10cfca2a139d1643c0bf1c6ea076c38fac49a969.json`. The final metadata report is `report-human-main-36313a0.json`, evaluated at updated main `36313a0c2f61032352d212853af255b0c163aa2c`. Grades and metrics remain unchanged; input hashes include the human record.

| Case     | Retrieval recall | nDCG@4 | Precision@4 | Good-option coverage | Redundant offers | Constraint violations |
| -------- | ---------------- | ------ | ----------- | -------------------- | ---------------- | --------------------- |
| dev1-b71 | 1.000            | 0.254  | 0.25        | 1                    | 0                | 0                     |
| dev2-b71 | 0.968            | 0.317  | 0.75        | 1                    | 0                | 0                     |

Neither case returned an error. Dev-1 offered Shock Brigade, Molten Duplication, Goblin Kaboomist and Goblin Fireleaper. Dev-2 offered Tato Farmer, Dryad of the Ilysian Grove, Explore and Snow-Covered Forest. Dev-1 recall is trivially one because no known absent relevant cards were labelled; dev-2 recall counts the two absent basic-land names. These are name-based prepared-pool metrics, not evidence that the deck cannot obtain functionally similar lands.

Independent review found an encoding defect in the first metadata update: Python read UTF-8 using the Windows default encoding. The update now explicitly reads UTF-8 from the preserved original suite. Structural equality after clearing only `humanReview` and `humanNote` proves every other field is identical. The final report was regenerated with the full executing SHA. The earlier `report-human-main-10cfca2.json` is superseded and invalid because its inputs had corrupted text; do not use it. `human-review-hashes.json` hashes the final artifacts. Original and final reports have identical metrics and batches.

Remaining #98 work includes development-6 frozen states and labels, broader frozen-state coverage (early/late, missing roles and misleading matches), independent repeated builds, reviewer-noise evidence and triage. This slice uses one state per spec under the user's bounded scope. No challenger, ablations, holdout use, provider fetches, app changes or publishing occurred. No new sourced shared KB findings arose.

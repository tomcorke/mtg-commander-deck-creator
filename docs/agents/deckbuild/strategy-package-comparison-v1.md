# Strategy-package ranking comparison

Part of [#105](https://github.com/tomcorke/mtg-commander-deck-creator/issues/105). Strategy packages merged in [#256](https://github.com/tomcorke/mtg-commander-deck-creator/pull/256) as `72d6187a47483d257370b877f66f4c910449343e`. This first fixed-pool comparison does **not** establish reviewer-preferred decks or swaps. Leave #105 open.

## Inputs and execution

Raw evidence is retained at `E:/working/agent-sandbox/research/deckbuild/issue-105-package-comparison-v1/`: predeclared `plan.json`, exact evaluation commands, baseline/challenger reports, comparison, classifier diagnostics, the reminder correction's plan/reports, and `inventory.sha256`.

The unchanged three-spec tuning suite comes from [development-6 ranking evidence](dev6-completed-ranking-v1.md), at `issue-98-dev6-23d3529/ranking/suite.json` under the research parent. Its file SHA-256 is `57093948c141d785c16d82cc4886bcbdca77b3978a0d3a89ad50d10a09a2f01c`, verified before execution. Labels, pools, state, history and constraints are identical across versions; the benchmark's comparison validates matching evaluation and label hashes. Every state contains 71 cards including its commander.

Each evaluation ran from a clean checkout at its attributed full SHA, using the documented native Node `rank-bench.ts evaluate` command; `compare` produced paired deltas. Baseline was the merge's first parent `dc6557e9d2ac3417e3d53b15eaa74522bbf57383` (scoring version 3); the merged package version was `72d6187a47483d257370b877f66f4c910449343e` (version 4). The reminder-only payoff correction ran at `5ff7fcc6aed1cd5f6f745f4aacd286391faa7ae3` (version 5), a committed clean implementation before this documentation was added. These revisions differ only in the package implementation and its subsequent narrow correction for the comparisons concerned.

The primary metric was per-case and mean tuning nDCG@4, with no new errors or constraint violations permitted. Results were predeclared descriptive, without tuning or issue closure from these three cases. Every command was bounded to 120 seconds, with zero retries. No provider calls, new labels, holdout access, builds, reviewer sessions, card-image downloads or publishing occurred. No new shared knowledge-base claim arose.

## Ranking results

Higher nDCG@4 means better agreement with the retained agent grades; it does not measure gameplay quality.

| Frozen case       | Before packages | Merged packages | Reminder correction | Corrected minus baseline |
| ----------------- | --------------: | --------------: | ------------------: | -----------------------: |
| dev1-b71, Krenko  |        0.254394 |        0.254394 |            0.254394 |                 0.000000 |
| dev2-b71, Tatyova |        0.317034 |        0.428571 |            0.317034 |                 0.000000 |
| dev6-b71, Kozilek |        0.189211 |        0.105558 |            0.129576 |                -0.059635 |
| Unweighted mean   |        0.253547 |        0.262841 |            0.233668 |                -0.019878 |

No case errored in any version. Retrieval recall, good-option coverage, repetition and explicit constraint-violation counts were unchanged. All cases retained at least one good-labelled option and zero explicit constraint violations; dev6 retained one repeated offer. Precision@4 was 0.25/0.75/0.25 before packages, 0.25/1.00/0.25 after merge, and returned to baseline after the correction.

Krenko's visible batch stays Shock Brigade, Molten Duplication, Goblin Kaboomist and Goblin Fireleaper. Tatyova originally offered Tato Farmer, Dryad of the Ilysian Grove, Explore and Snow-Covered Forest; merged packages replaced Tato Farmer with Avatar of Burgeoning Echoes, and the correction restores the baseline batch.

Kozilek originally offered Volatile Rig, Snow-Covered Wastes, Golden Argosy and Wirefly Hive. Merged packages offered Keeper of the Quiet Hour, Snow-Covered Wastes, Tangle Tumbler and Dutiful Replicator. The corrected batch is Dutiful Replicator, Snow-Covered Wastes, Tangle Tumbler and Volatile Rig.

## Diagnosis and bounded correction

The classifier activates Tokens from 13/10/5 detected enablers in dev1/dev2/dev6, respectively; all three states have zero detected token payoffs before considering candidates. The eight-point cap is therefore reachable for a candidate classified as a payoff, even without a declared Tokens theme.

Keeper of the Quiet Hour and Avatar of Burgeoning Echoes match `token you control` inside retained empower reminder text referring to their own Jace token. Both receive eight package points. That reference does not establish a reward for the deck's creature-token producers. This explains the apparent Tatyova gain as well as part of the Kozilek loss; it is not evidence of improved package completion.

[#408](https://github.com/tomcorke/mtg-commander-deck-creator/issues/408) records the correction hypothesis before editing. Payoff detection now removes parenthesized reminder text, following the existing signature-detection convention. Enabler/protection detection is unchanged. A regression test first failed with eight points instead of zero, then passed after the change; its adjacent positive case retains an explicit token payoff outside the reminder. The scoring version advances to 5.

The correction removes these false rewards but does not improve the whole frozen benchmark over the pre-package baseline. Dutiful Replicator and Tangle Tumbler still receive eight points for explicit token references, displacing plausible-labelled alternatives in dev6. Their retained grades are both zero. That observation is a reason to inspect package compatibility and labels; it does not prove either card is intrinsically unsuitable. No further weights or classifiers were tuned here.

## Limits and next evidence

These are three development states at the same deck size, with no dedicated sacrifice deck, early/late states, deliberate missing-piece cases or swaps. The [original label record](labelled-rank-bench-v1.md) includes five human disagreements out of 15 spot-checks, all raising agent grades, including Tato Farmer. Dev6 grades are entirely pending human review; its original labeller saw some introductory context. Optimizing to those grades without investigating disagreement risks learning their mistakes.

The next bounded experiment should add independently labelled sacrifice/token states with excess payoffs, excess enablers and misleading matches, and compare actual resulting builds and Doctor swaps under the unchanged #98 prompts/rubric. Package compatibility, resource-token uses, copy effects and conditional support need explicit review. Preserve existing grades and rerun every compared version if a deliberate relabelling occurs. No preference-improvement acceptance item in #105 is met by this experiment, and no #98 acceptance box is advanced.

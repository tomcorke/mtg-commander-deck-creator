# Reminder-only payoff correction at scoring version 12

Evidence for #408, superseding the stale implementation in #409. This is a heuristic classifier correction, not a claim of improved deck quality.

## Reproduction and scope

On current main `1d9344f`, the new strategy-package regression failed with 8 instead of 0 for the empower Jace reminder. After the correction it passes: reminder-only references score zero and count as zero payoffs, while an explicit creature-token reward following the reminder still scores 8. Only payoff detection strips parenthesized text, following the signature-detection convention; enablers and protection retain their existing handling. The heuristic does not parse nested parentheses. Scoring metadata advances from 11 to 12.

## Unchanged paired experiment

Baseline: main `1d9344f` (version 11). Challenger: `94c703c462765d2ed9024ceff602c7b747acfa45` (version 12). Both ran in this T3 worktree, with the regression test present for the baseline and no other production edits. The challenger was committed before evaluation. No weights, labels, strategy families, pools, states or prior-offer history were tuned.

Retained raw evidence: `E:/working/agent-sandbox/research/deckbuild/issue-408-current-main/` contains `baseline.json`, `challenger.json`, `comparison.json`, and `before-test.txt`. The input is the original `issue-98-dev6-23d3529/ranking/suite.json` under the same research parent; SHA-256 `57093948c141d785c16d82cc4886bcbdca77b3978a0d3a89ad50d10a09a2f01c`, unchanged from #409. The comparison validates matching evaluation hashes and labels. No provider calls or holdouts were used.

Reproduce from each revision with `node --experimental-strip-types scripts/deckbuild/rank-bench.ts evaluate <suite.json> <revision>`, retain its JSON, then run `node --experimental-strip-types scripts/deckbuild/rank-bench.ts compare <baseline.json> <challenger.json>`.

| Frozen tuning case | Version 11 nDCG@4 | Version 12 nDCG@4 |     Delta |
| ------------------ | ----------------: | ----------------: | --------: |
| dev1-b71, Krenko   |          0.692811 |          0.692811 |  0.000000 |
| dev2-b71, Tatyova  |          0.428571 |          0.317034 | -0.111537 |
| dev6-b71, Kozilek  |          0.105558 |          0.129576 | +0.024018 |
| Unweighted mean    |          0.408980 |          0.379807 | -0.029173 |

Krenko's batch is unchanged. Tatyova replaces Avatar of Burgeoning Echoes with Tato Farmer; Kozilek replaces Keeper of the Quiet Hour with Volatile Rig and moves Dutiful Replicator to first. Both reminder-based false rewards disappear. Precision@4 changes from 1 to 0.75 for Tatyova and is unchanged at 0.75/0.25 for Krenko/Kozilek. All three cases succeed with zero explicit constraint violations in both runs. Retrieval recall, good-option coverage and repetition are unchanged (one repeated offer in dev6).

## Interpretation and limitations

The primary correctness hypothesis passes, while the ranking result is mixed and the mean regresses. These three 71-card tuning states measure agreement with retained agent grades, not gameplay or preferred completed builds/swaps. The original label record (`labelled-rank-bench-v1.md`) reports five human disagreements in 15 spot checks, all raising agent grades, including Tato Farmer. Dev6 grades remain pending human review. No labels were changed to improve this result. This narrow correction does not establish #105's historical preference criterion or advance #98's evaluation acceptance.

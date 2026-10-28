# Identical-deck reviewer variation: Tatyova

Two fresh Codex `gpt-6.1-sol` sessions with explicit `reasoningEffort: low` re-reviewed the unchanged [Tatyova candidate](builder-evaluation-tatyova-v1.md). Together with its original review, these give three desk reviews of a second identical completed deck, broadening the earlier [Ayula sample](reviewer-variation-ayula-v1.md). All six scores and confidence levels agree within this Tatyova sample; weakest-card selections and prose vary. This is descriptive evidence, not a population noise estimate or a completed repeated baseline for [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Inputs and collection

The existing `review-session.ts` runner staged two neutral directories from the retained private input. All seven staged text hashes match the original: bundle, reviewer prompt, rubric, session instructions, JSON contract, rules and format-policy copies. No deck, spec, Oracle data, prompt or reference changed. Bundle identity is `2531942d22bdfd63dab93c95f6903b6f88d93f1d6c8de8e1e8585083893dfef1`; evaluation checkout is `20e90ae74b0139ad46cce316a579c342a84b2241`.

Both fresh tasks received only the runner-generated launch object, without parent conversation or earlier reviews. Actual receipts verify Codex, model and low effort. Both passed `finishReview`, including staged membership/hashes, private input binding and review validation. They reported no observed contamination, but generic host/tool instructions, skill catalog, workspace/branch metadata and repository instructions were ambient context. Restrictions were instructions, not enforced isolation. Receipts and self-reports cannot prove absence of contamination or statistical independence.

Raw evidence remains outside Git at `E:/working/agent-sandbox/research/deckbuild/issue-98-slice-20/`: bounds, staged launch objects, private operator inputs, actual receipts, validated results, approved-file archives, `measure.mjs`, `measurement.json` and inventory. The original result remains under `issue-98-slice-17/operator/review-session/`. Measurement retains all three task IDs, result-file byte SHA-256 hashes, seven runner text hashes, confidence and card selections. Runner text hashes digest JSON-encoded strings rather than raw bytes.

The two-task/no-retry collection began at `2026-10-28T00:04:11.0631215Z`, with execution cutoff `00:16:11.0631215Z` and finalization deadline `00:20:11.0631215Z`. Both results were validated and measured by `00:07:10.136Z`, before both bounds. These are operator-checked collection bounds, not process enforcement of whole-agent activity. Delivery review and PR finalization are outside the collection window. Two initial staging calls failed before task launch because this new worktree lacked dependencies (`ERR_MODULE_NOT_FOUND: zod`); frozen-lockfile installation corrected setup within unchanged bounds. The failure record remains retained; no review task failed or was retried.

## Individual scores and spread

Review 1 is the retained original; reviews 2 and 3 are fresh, numbered by launch. Scores are out of five. Range is maximum minus minimum. Pairwise absolute differences compare (1,2), (1,3), (2,3); their arithmetic mean is descriptive and does not establish interval-scale validity for the ordinal rubric.

| Criterion     | Review 1 | Review 2 | Review 3 | Range | Pairwise absolute differences | Mean absolute difference |
| ------------- | -------- | -------- | -------- | ----- | ----------------------------- | ------------------------ |
| Bracket fit   | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |
| Effectiveness | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |
| Theme fit     | 5        | 5        | 5        | 0     | 0, 0, 0                       | 0                        |
| Idea fit      | 5        | 5        | 5        | 0     | 0, 0, 0                       | 0                        |
| Fun           | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |
| Synergy       | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |

All three bracket-fit estimates are `appropriate` with medium confidence. Effectiveness and fun confidence are medium; theme, idea and synergy confidence are high throughout. These remain reviewer estimates, not bracket certification, current-policy verification or gameplay measurements.

All three select Tatyova, Avenger of Zendikar and Ramunap Excavator as strongest. All select Sporemound and Whelming Wave as weakest; reviews 1 and 2 additionally select Weather Maker, while review 3 selects Embodiment of Insight. Reviews 1 and 3 order Sporemound before Whelming Wave; review 2 reverses them. All propose no external swaps and flag practical pace and missing replacement evidence; review 3 separately records policy freshness. These are attributed judgements, not new Oracle findings or independent candidate-ranking labels. Full justifications and limitations remain in each result.

## Interpretation and remaining acceptance

Tatyova and Ayula each have three identical-deck reviews with zero observed spread in all six scores. Keep these as two per-deck observations: the candidates were selected during workflow development, not sampled representatively. The five-point scale and ceiling scores can conceal prose differences. Agreement does not demonstrate correctness, sensitivity, population noise, or that any positive challenger delta is significant. Original reviews predate repeats; ambient context and unpinned model backend behavior can vary. No bootstrap interval is warranted.

No build was repeated and no recommender change was tested. Independent build repeats and real ranking labels with nearby negative cases are the next acceptance priorities; Goblin reviewer repeats remain available. Fixed suites/holdouts, paired ranking experiments, full constraints, provider/supervision work, human spot-checks/playtests and remaining acceptance stay in open #98. Best-effort restrictions remain accepted. No live-app changes, policy refresh, enforced-runtime investigation or publishing occurred.

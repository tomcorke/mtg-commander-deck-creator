# Identical-deck reviewer variation: Ayula

Two fresh Codex `gpt-6.1-sol` sessions with explicit `reasoningEffort: low` re-reviewed the unchanged [Ayula candidate](builder-evaluation-ayula-v1.md). Together with its original review, these give three desk reviews of one identical completed deck. All six criterion scores agree in this sample; confidence and card selections vary. This measures observed reviewer variation without introducing new builder choices. It does not establish zero reviewer noise or complete the repeated baseline in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Inputs and collection

The existing `review-session.ts` runner staged two new neutral directories from the exact retained private input. All seven staged text hashes match the original: bundle, reviewer prompt, rubric, session instructions, JSON contract, rules and format-policy copies. No prompt, reference, deck, spec, Oracle data or recommender mechanism changed. Bundle identity remains `dd7c7c5090ed3fda7e0266252a11f5e499e782eb52b64238c42f7622a73fd6c1`; evaluation checkout is `d7912bbd5602baf074c6ddbc9143010a05cd69aa`.

Both fresh tasks received only the runner's generated launch object, with no parent conversation or earlier reviews. Returned task receipts verify Codex, model and low effort. Both completed envelopes passed `finishReview`, including staged membership/hashes, private input binding and review validation. Each reported no observed contamination and generic ambient host metadata. Restrictions were instructions, not enforced isolation; neither the receipts nor self-reports prove absence of contamination. Fresh sessions are operationally separate, but statistical independence of model outputs is not established.

Raw evidence is outside Git at `E:/working/agent-sandbox/research/deckbuild/issue-98-slice-19/`: `bounds.json`, `staged-{2,3}.json`, `review-{2,3}/` inputs/operator records/actual receipts/validated results, `measure.mjs`, `measurement.json`, approved-file archives and an inventory. The original result remains under `issue-98-slice-18-attempt-5/operator/review-session/`. Measurement records all three exact task IDs, result-file SHA-256 hashes, seven runner text hashes and individual card selections. Runner text hashes digest the JSON-encoded string, not raw bytes. The inventory uses ordinary file-byte SHA-256.

The two-task/no-retry assignment began at `2026-10-27T23:58:08.506Z`, with execution cutoff `2026-10-28T00:10:08.508Z` and finalization deadline `00:14:08.511Z`. Both results were collected, validated and measured by `00:00:19.678Z`. These are operator-checked collection bounds, not process enforcement of whole-agent activity; no timed-out, failed or contaminated review was discarded. Delivery review and PR finalization are outside this collection window. An ancillary shell inspection used unsupported PowerShell `Get-Date -AsUTC` and searched an absent `.github` directory; those diagnostics did not execute review commands or alter evidence.

## Individual scores and spread

Review 1 is the retained original; reviews 2 and 3 are fresh sessions, numbered by launch rather than completion order. All scores are out of five. Range is maximum minus minimum. Pairwise absolute differences compare (1,2), (1,3), (2,3); their arithmetic mean is reported without assuming interval-scale validity for the ordinal rubric.

| Criterion     | Review 1 | Review 2 | Review 3 | Range | Pairwise absolute differences | Mean absolute difference |
| ------------- | -------- | -------- | -------- | ----- | ----------------------------- | ------------------------ |
| Bracket fit   | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |
| Effectiveness | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |
| Theme fit     | 5        | 5        | 5        | 0     | 0, 0, 0                       | 0                        |
| Idea fit      | 5        | 5        | 5        | 0     | 0, 0, 0                       | 0                        |
| Fun           | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |
| Synergy       | 4        | 4        | 4        | 0     | 0, 0, 0                       | 0                        |

All three bracket-fit estimates are `appropriate` with medium confidence. Effectiveness and fun confidence are medium throughout; theme and idea confidence are high throughout. Synergy confidence is medium/high/medium. These are reviewer estimates, not bracket certification, current-policy verification or gameplay measurements.

Qualitative outputs differ despite identical scores:

- All three select Ayula and Ruxa among the strongest. Reviews 1 and 2 additionally choose Caller of the Claw; review 3 chooses Inspiring Call.
- All three select Gladewalker Ritualist and Spectral Bears among the weakest. Reviews 1 and 3 also select Fade from History; review 2 supplies only two weakest cards, which the contract permits.
- All three propose no swaps and flag policy currency and observed pace/table experience. Review 3 additionally records replacement-card evidence as a knowledge gap.

These are attributed card judgements from the retained reviews, not new Oracle/rules findings or independent candidate-ranking labels. The previously observed future selected printings remain unresolved: agreement on scores does not validate every review claim about preference compliance. Full justifications, source citations, confidence and limitations remain in each result rather than being replaced by this score table.

## Interpretation and remaining acceptance

The observed score spread is zero for this one deck under this frozen rubric. It cannot provide a population noise estimate, establish score sensitivity, show reviewer correctness, justify treating any positive challenger delta as significant, or support commander-level bootstrap intervals. The ordinal five-point scale and two ceiling scores can conceal differences visible in prose. The original session predates the two fresh sessions; generic ambient metadata and unpinned model backend behavior may vary even with the same requested model/options.

No build was repeated, so builder noise and cross-deck variance remain unmeasured. No recommender change is accepted or rejected from these results. Next work within open #98 should broaden identical-deck repeats across the other retained candidates, perform independent builds, and author independent real ranking labels with nearby negative cases. Suites/holdouts, paired experiments, full constraints, provider/supervision work, human spot-checks/playtests and remaining acceptance stay in #98. Best-effort restrictions remain accepted; no enforced-runtime investigation, app edits or publishing occurred.

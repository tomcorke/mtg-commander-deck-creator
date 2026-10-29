# Bounded Codex baseline round

Part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98). This round does not complete acceptance; leave the issue open.

Evaluation checkout and origin/main: `ebb3a016a74cb83b46c4e034cd02d6ada19c7070`. Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-baseline-round-corrected-ebb3a01/`. `queue/round.json` pins specs, seed, genuine retained preparation manifests, prompt/reference hashes and KB commit `5d2a986c597a71a81fe8aaccc8a639082db35eb7`. `final-inventory.sha256` hashes 418 retained artifacts (before later PR/check bookkeeping). Fresh builder sessions used identical prepared inputs per spec. Every builder and reviewer used Codex `gpt-6.1-sol`, reasoning effort `low`. Earlier Sonnet builds and Opus noise data are not directly comparable.

## Bounds and setup

Each job received 260 commands, 60 batches, 25 extensions, 10 provider attempts per extension, 120000 ms per subprocess, 64 MiB stdout and 1 MiB stderr. Session bounds were declared before execution: 45 minutes execution and 5 minutes finalization, within the absolute queue deadline. Zero retries; failures stayed stopped. Supervisor uses exact offline whole-report replay. Session deadlines are operator-enforced, not an OS sandbox.

The first preparation attempt at sibling `issue-98-baseline-round-ebb3a01/` failed importing zod. Its artifacts remain untouched. The user explicitly authorized corrected preparation as setup tooling friction before any run. Corrected preparation ran repository modules from the checkout with genuine retained manifest identities; provenance.json records the correction. Other setup friction included an unsupported PowerShell encoding name while staging references, corrected before review launch. Ranking helper initially invoked unavailable tsx, then used the documented native Node invocation; no build was retried.

## Build outcomes

| Job             | Cards | Commands | Extensions | Outcome                                                    |
| --------------- | ----: | -------: | ---------: | ---------------------------------------------------------- |
| development-1-1 |   100 |       11 |          5 | Complete; gate ready; exact replay                         |
| development-1-2 |   100 |       43 |          3 | Complete; gate ready; exact replay                         |
| development-2-1 |   100 |       16 |          5 | Complete; gate ready; exact replay                         |
| development-2-2 |   100 |       39 |          6 | Complete; gate ready; exact replay                         |
| development-6-1 |     1 |        2 |          1 | Stopped: addBasics schema rejection; executed prefix exact |
| development-6-2 |    32 |       13 |          4 | Stopped: EEXIST run.lock; successful prefix exact          |

Authoritative reports, manifests, logs, bounds, feedback and gates live under each `queue/<job>/`. Dev-6 has neither a completed deck nor a ~71-card state. No retry or substitute run was made. The second failure is an overlapping-launch diagnostic, not evidence of stale locking; timing is builder-reported. The first copied a recommendation-only reason field into a strict deck-card payload.

## Blind reviews and summary

run-round.ts created stripped read-only bundles a through d, mapping to dev1 repeat1, dev1 repeat2, dev2 repeat2 and dev2 repeat1. Each review was a fresh session instructed to read only its bundle. Bundle-level isolation is the accepted standard (#265); no runtime sandbox claim is made. Review sessions declared 15-minute bounds and zero retries.

| Review | Bracket | Effectiveness | Theme | Idea | Fun | Synergy |
| ------ | ------: | ------------: | ----: | ---: | --: | ------: |
| a1     |       3 |             3 |     5 |    4 |   4 |       4 |
| a2     |       3 |             3 |     5 |    5 |   4 |       4 |
| a3     |       3 |             3 |     5 |    5 |   4 |       4 |
| c1     |       4 |             4 |     5 |    5 |   4 |       5 |
| d1     |       4 |             4 |     5 |    5 |   4 |       5 |

Identical-deck noise on a1-a3: spread one point for idea fit, zero for other criteria. All five reviews passed run-round.ts validate. Four originals contained a UTF-8 BOM; separate normalized copies remove only the BOM for ingestion, originals preserved. Review b1 stopped on a PowerShell artifact-writing quoting failure; it has bounds but no review files. Its provisional scores are excluded and it was not retried.

summarise.ts generated `summary.json` from retained `summary-input.json`, including every valid review, builder feedback and available rank metrics. Empty holdout results mean no holdouts evaluated. Intervals are not estimated: too few independent commanders and no paired challenger. Scores are desk estimates, not gameplay evidence. Dev1 bracket fit is unresolved with low confidence; dev2 appears appropriate with medium confidence. Pace remains unverified.

## Ranking

Full available suite from #268 was evaluated at the executing SHA above: `ranking/report-main-ebb3a01.json`. No relabelling or challenger. Dev1/dev2 nDCG@4: 0.2543943 / 0.3170343; precision@4: 0.25 / 0.75; recall: 1 / 0.968254. Both have good-option coverage 1, redundancy 0, constraint violations 0 and no errors. Existing 457 agent labels and recorded human disagreements remain unchanged. These are prepared-pool/name-based metrics, not gameplay quality. Dev6's missing state prevents the requested full three-spec suite. The schema permits pending human review; no new human check was required or requested.

## Triage and acceptance

- [#269](https://github.com/tomcorke/mtg-commander-deck-creator/issues/269): schema-valid addBasics examples and retained preflight diagnostics.
- [#270](https://github.com/tomcorke/mtg-commander-deck-creator/issues/270): supervisor completion and actionable overlapping-call diagnostics. Exclusive locking itself worked.
- Data/artifact tooling: PowerShell quoting/encoding caused one stopped review and BOM ingestion friction; preserve this limitation, do not treat provisional output as a review.
- Recommender observations: builders saw colourless basics in red offers and low resource-role counts, and used recorded retrieval to bypass queues. No explain investigation establishes a causal ranking/filtering defect; no recommender change or defect issue is justified by this round alone. Role targets remain heuristics.
- KB: dev2 reviews report missing earthbend reference evidence. This is an evidence gap, not a proved rules error. Fire-and-forget handoff: [Earthbend reference gap](t3-thread://v1/mcp:8ecd1db5-0d0c-40a6-877f-38954b35ce11), Codex gpt-6-luna low, full-send in the knowledge-base repository; completion is not required for this app evidence slice.

Specs acceptance cannot be ticked from the docs/comments reviewed. #249/#250 describe holdout preparation milestones, not complete Specs acceptance. No holdout contents or directories were opened or listed. PR #256 was not used. No app changes, card-image downloads or publishing occurred.

After this evidence merges, reviewer-noise measurement can be ticked with its merged link. Real labelled suite, three-bracket baseline and independent repeats across all three specs remain unchecked because dev6 stopped. Rank-bench sub-box remains qualified by absent dev6 coverage. Specs/components acceptance remains unchecked. Triage can be ticked only after linked follow-ups and the KB handoff are recorded. Remaining work is full Specs evidence, dev6 independent completed repeats and labels, and the missing dev1 repeat2 review. No closing keyword is appropriate.

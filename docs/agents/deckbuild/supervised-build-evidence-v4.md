# Supervised development build evidence v4

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98), 2026-10-29. This slice retained one fresh dev-2 build and a dev-3 session that failed at the Claude usage limit before building. It does not complete the requested repeats, three-bracket baseline, or reviewer-noise measurement. Previous evidence is unchanged. GitHub currently marks #98 closed despite its latest comments describing remaining work; this report does not claim acceptance is complete.

## Dev-2 outcome

One fresh T3 builder session used `claude-sonnet-5-5`, effort `high`, at clean main `4a4ae137e9b735b90aca5a3815ab0fa8b1c3fc7d`. No other builder's decisions or reviews were supplied. This is one independent session, not independent repeats of a spec. Both assigned sessions used the same model and configuration.

Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-independent-dev2-v4/`. Exact development inputs were `issue-98-common-input-evidence/dev-2-recipe.json` and `dev-2-preparation.json`. Offline preparation derived current-version pins; original inputs were copied under `original-inputs/`. Builder prompt v1 was unchanged (`69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b`). The builder recorded KB commit `5d2a986c597a71a81fe8aaccc8a639082db35eb7` and consulted dated rules and policy references; this is not a policy refresh.

The Tatyova development spec targets bracket 3. The resulting 100-card candidate passed `completed-review.ts prepare`: `final/prepared.json` is `ready`, without errors or unresolved items. Bundle hash: `ca7b94ffc77f16bd47e52deedf79c3674a5ba0b9eb9ba35054556e10c4f87e23`. Construction readiness does not establish bracket, pace, constraints, or quality. No blind review ran.

All six supervised calls (initial record and five extensions) have exact offline replays. Final manifest: `fd5bb09b09c2a66a7586044af523e2c201dd4909f11578dceb4f3d27c695258f`. `extend-5.json` and `replay-5.json` are byte-identical. Twelve provider occurrences returned HTTP 200. The supervisor's replay fetch cap was zero; it is a throwing preload, not an OS network sandbox.

## Bounds and limitations

`assignment.json` preceded builder commands. Limits were 260 commands, 60 batches, 25 extensions, 10 provider attempts per extension, 120000 ms per subprocess, 67108864 stdout bytes and 1048576 stderr bytes, zero retries. Setup was `09:39:44Z`; execution deadline `11:09:44Z`; finalization deadline `11:29:44Z`, all 2026-10-29 UTC. First breach, nonzero exit, noncomplete report, settled provider failure or replay mismatch permanently ends the run.

Actual use: 40 commands, four batches, five extensions; provider attempts by extension 3/0/4/5/0. Longest subprocess was 7.455 seconds; largest stdout 4522551 bytes, stderr zero. Last replay ended `09:47:12.996Z`; inventory was written at approximately `09:50:20Z`. There is no supervisor stop file. Bounds cover subprocesses, not unrestricted agent activity or aggregate storage.

The last four decisions remain uncommitted because the builder stopped at 100 cards without another `nextBatch`. The recorded state is the state validated and exported; no extra action was run to improve the result. The builder disclosed one listing of the top-level research/deckbuild directory, exposing holdout-named directory names. It reported opening none and reading no prior builds or reviews. This disclosure weakens procedure compliance; it is not evidence of holdout-content access or tuning.

The builder reports 79 noncommander cards came from recorded lookups outside the narrow prepared pool. Thus this is chiefly supervised retrieval/addition evidence, with limited coverage of ranking decisions. Feedback on tied scores, colourless basics, lookup name misses and exclusion handling is untested triage, not established recommender defects. `final/builder-feedback.md` and five structured gaps in `final/knowledge-gaps.json` are retained verbatim. In particular, the builder's Dryad/library land-type assumption is unverified and must not be adopted as a rule. A separate KB research handoff covers that assumption and earthbend.

## Dev-3 quota failure and deferred work

A second fresh Sonnet 5.5/high session was assigned only dev-3 (Ayula, bracket 1), using exact `issue-98-common-input-evidence-batch-2/dev-3-recipe.json` and `dev-3-preparation.json`. It began `09:50:56Z` and failed `09:51:10Z` with `Claude API rate limit reached`. It failed during reading, before creating its assigned raw directory or assignment and before any builder command. The finite bounds were supplied in its launch brief, matching dev-2, but no executed run or construction/replay result exists. The task was cancelled after failure to prevent host resume; no retry or replacement was launched.

Claude allowance fell from 23% to 2% during this slice. Scope was reduced at the settled quota failure. No Opus reviews were launched: reviewer variation, blind isolation improvements and score spreads remain unmeasured. No new same-spec repeat pair exists. Dev-3 still needs a separately assigned new run; the requested two additional completed specs in different brackets were not achieved. These items remain tracked by #98, whose closed state is disclosed above. No baseline or quality claim is made.

Raw dev-2 exports include `final/deck.txt`, `final/actions.jsonl`, `final/commands.jsonl`, construction input and evidence-source mapping. `final/inventory.sha256` lists 81 hashed files. Separate operator verification and task receipts are retained under `E:/working/agent-sandbox/research/deckbuild/issue-98-v4-audit/`. No application changes, labels, holdout-content use, live provider requests outside supervised calls, PR #256 use, publishing or release occurred in this slice.

Operator verification checked all 81 inventory entries and all six byte-identical report pairs. The inventory file SHA-256 is `eca003bc8923ba372a0b6254e4a5d5d5445a7de72a3234474c17d1799d63d0ee`; assignment `e50941ad44892755137b6ad6dfe0322b39c9c5e7cf59c741ba4d83457ff31aaa`; final deck `b0d536b522987ec6a1592fbdf6ef27a193c911408c325a48a1f6b1ecb7122bf8`; final report/replay `371c89fc11e86148033b6f38419dabd07e577fa46670822251b932867c7933b0`. `verification.json` retains the other pair hashes. Archived task activity is truncated per item where marked; it is not a complete untruncated transcript. Dev-2 session identifier ends `0b88cf63-8150-4f3e-965d-d8783d706d0d`; dev-3 ends `deece2df-51bd-4a23-be34-55eef9688abc` (full IDs in the audit receipts).

Delivery checks: `pnpm test` passed all 953 tests, and `pnpm lint`, `pnpm typecheck` and `pnpm build` passed. Logs are retained in the audit root. Existing build chunk/dynamic-import warnings remain. These checks validate the repository, not desk-review quality or acceptance completion.

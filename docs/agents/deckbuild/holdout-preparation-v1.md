# Issue 98 holdout preparation v1

The bounded preparation ran at HEAD `7a925dbc6a013e625579e5e9f405c291ea5b4222`. Finite limits were recorded before execution: three cases, 20 pages and 21 requests per case, 63 requests total, 120 seconds per case, 720 seconds overall, and zero retries. It finished within the recorded deadline.

Holdouts 1 and 2 are ready, with pools of 276 and 2,187 cards. Holdout 3 reached the 20-page limit. Fetch-forbidden replay exactly matched the recorded result for all three cases, including the limited third case. Readiness is incomplete.

Eight development cases were actually derived offline. Each comparison differed from its original prepared state only in `recommenderVersion`; original evidence remains unchanged. Holdouts stayed segregated: no tuning or builder runs were performed on them.

This preparation does not establish policy freshness, a common corpus, or recommendation quality. Retrieval is incomplete, so the ready pools are not evidence of complete retrieval or a quality result.

Checkpoint: the previous PR 245 issue milestone comment is still missing. This document records the checkpoint; it is not a claim that the comment was posted.

Raw evidence is retained separately at `E:/working/agent-sandbox/research/deckbuild/issue-98-holdout-preparation-v1/`. Its inventory SHA-256 is `a9939fb92353ff5c3309da7ee9386abcb842f9f7b13397bfca9b321f1ff3a279`. `bounds.json` retains the exact queries and resource rationale; `outcomes.json` retains retrieval and separate zero-occurrence prepared-state manifest identities. `comparisons.json` retains the eight new derivations and their original manifest identities. The prior development inventory was verified before execution.

The aggregate offline audit reports ten compatible cases and four not prepared (HOLDOUT3–6); common readiness remains incomplete. No existing suite declarations were changed. The actual execution finished at 2026-10-28T16:31:44.194Z, before the 16:42:59.852Z deadline. Overall and derivation bounds were operator checked, not whole-agent runtime enforcement; preparation uses the existing runtime guard. Strict HEAD and compatibility guards remain unchanged. Re-execution requires the pinned execution checkout, rather than relabelling evidence at a later docs commit.

The prior checkpoint is PR [#245](https://github.com/tomcorke/mtg-commander-deck-creator/pull/245), merged at the execution HEAD above: its retained DEVELOPMENT8 collection and eight-case offline reconciliation are described in [development8-collection-v1.md](development8-collection-v1.md). This bounded task does not close issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

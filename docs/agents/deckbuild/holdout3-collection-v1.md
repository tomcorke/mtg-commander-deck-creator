# Issue 98 HOLDOUT3 38-page collection

A separately identified unchanged-query HOLDOUT3 preparation executed at shipped38 HEAD `010252480ea125b270312ee7c98740fac5066c10`. The bounds were recorded before execution: one attempt, 38 pages, 39 requests including commander lookup, 120 seconds preparation, 180 seconds overall, zero retries and no expansion. The query remained `id<=bg legal:commander (t:creature or t:basic)`.

The result is ready with 6,540 candidates. Fetch-forbidden replay matched exactly. Collection finished at 2026-10-28T16:50:45.306Z within its recorded deadline. The old 20-page capped attempt and all original manifests and identities remain unchanged.

Ten actual offline prepareBuild derivations executed at the same HEAD under separately recorded ten-case, 120-second-per-case, ten-minute overall bounds, with fetch forbidden and zero retries. Each new prepared state differs from its retained original only in recommenderVersion. These are new zero-occurrence prepared-state manifests, distinct from retrieval evidence. The aggregate audit reports eleven compatible cases and three unprepared; commonReadiness remains incomplete. Offline work finished at 16:50:49.876Z within its deadline.

Raw evidence: `E:/working/agent-sandbox/research/deckbuild/issue-98-holdout3-38page/`. Inventory SHA-256: `808429cb7cf7d70cbbdaa9e2c2a14409c0e21032b20de5f4d692d3dda7c9e881`. The collector, bounds, original inventory verification, recipes, outcomes, exact replay, comparisons, manifests and aggregate audit are retained there. Retrieval manifest: `cdb690d62823928d0bc8129d2cc57bdcfcbc18324e6a34a7799dd72a12eaa661`; new HOLDOUT3 prepared manifest: `f1ec541f523458acf849190c3bb3b53812bfe514cfc185b6931ff81298bd4440`.

Bounds beyond preparation's runtime guard are operator checked, not whole-agent enforcement. Strict guards remain unchanged. Re-execution requires the executing checkout. Holdouts remain segregated; no labels, scoring analysis, tuning, builders, HOLDOUT4–6 collection, app changes or publishing occurred. This establishes neither policy freshness, a complete corpus, baseline acceptance nor recommendation quality. Issue #98 remains open.

The inherited collector diagnosis note incorrectly says the intervening changes were docs only. Its recorded diff includes the shipped search-ceiling tooling and tests. A separate diagnosis-correction.txt preserves this correction without rewriting the inventoried evidence. Offline compatibility is justified by actual deep equality checks on every pin except recommenderVersion, not by that inherited note.

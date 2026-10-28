# HOLDOUT4 bounded collection

Evidence root: `E:/working/agent-sandbox/research/deckbuild/issue-98-holdout4-23page`. Execution HEAD: `48c640aa16c43cae199c5c98d7ca0850fba9b075`.

Twenty retained responses independently reported 3913 total cards and 175 rows each: ceil(3913/175)=23 pages. Unchanged query: `id<=wubg legal:commander (o:proliferate or o:counter or t:basic)`, name order. Recipe equality asserted except authorized maxPages.

One attempt, zero retries; 23 pages, 24 requests including lookup; 120s preparation, 180s overall. Finished within deadline. Ready with 3858 candidates. Exact fetch-forbidden replay matched. Thirteen separate actual offline derivations asserted all pins equal except recommenderVersion; original/new identities are in comparisons.json. Offline bounds: 13 cases, 120s each, ten minutes overall, zero requests. The binding audit reports 14 compatible cases and commonReadiness ready for these supplied preparation inputs. This establishes shared preparation compatibility only; it does not establish complete retrieval coverage or satisfy the remaining evaluation acceptance.

Setup initially failed with missing zod before provider requests. Failure and interrupted artifacts retained; frozen-lockfile install succeeded. No second provider attempt. Old bytes preserved. The retained diagnosis incorrectly calls the diff from 3562f78 docs-only; that diff also includes the already reviewed page-ceiling/tooling tests. It is not evidence of a docs-only diff. The immediate prior execution was 621588fb; authoritative prior root is final-holdout-collection-v1. No guards were changed in this task.

Audit limitations: preparation only; no labels, scoring, tuning, builders, policy freshness, baseline, quality or complete-corpus claim. Initial inventory captured execution.log and test.log while processes were still writing; their hashes are therefore stale. All other inventory entries and prior inventory verify. Final hashes below supersede those log hashes, without modifying the original inventory.

- `bounds.json`: `c619fcd40d0722bb17e4454823834d80ba6926875cdadc35873616c9de4aa7a3`
- `diagnosis.json`: `a5aef4a72892def3aae5dc9651c87787f0e20a48645e4658c03295c321a007f8`
- `retained-totals.json`: `cdefdad1284556406da4fe7f7d5def160ed47b03f4b61a062e6feabd11538448`
- `holdout-4-provider-recipe.json`: `fadd62988f2683eccd922dfae7f737189107550acf68fd28354edf578b761cfe`
- `holdout-4.json`: `bab1c072f5538ef463406b352e6889ff8645f18e99377c2312cc26d361eb888b`
- `outcomes.json`: `ec520a1d8fbb3684405ab326cc680f346b42e549d97d30c3cce8a76d4139f6c4`
- `comparisons.json`: `814ac9669963e06052e6f8938dff418993ed78caa8f081ccd957e204227f212a`
- `audit.json`: `cd4fdf8666973b195b07cd10272c26c790ef1be754bbb3b7cc60143c66b21aab`
- `inventory.json`: `db1d21925acd8b39087438033159f4d35a77122acff61484e34c007785a9e90e`
- `execution.log`: `bf3b985ae2b70df451e72e16260bff49d74f888fff6797dc09f8f60e658312d7`

Validation: pnpm test passed all 944 tests; pnpm lint, pnpm typecheck and pnpm build passed. Final log hashes are separately retained in supplemental-hashes.json and test-final-hash.json. The original 91-entry inventory verifies unchanged; the new 112-entry inventory has only the two documented active-log mismatches.

# Common-input evidence, v2

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) remains open. This is a settled documentation update to the research record, not a readiness or baseline result. The earlier [v1 record](common-input-evidence-v1.md) and its identities, hashes, and outcomes remain unchanged. The raw evidence roots are outside this repository:

- `E:/working/agent-sandbox/research/deckbuild/issue-98-common-input-evidence-batch-2/`
- `E:/working/agent-sandbox/research/deckbuild/issue-98-development-4-attempt-2/`
- `E:/working/agent-sandbox/research/deckbuild/issue-98-preparation-partial-final/`

## Prior v1 record retained

The v1 record reports two fresh, independent preparations using the original dev-1 and dev-2 briefs, with unchanged settings, shared date, seed, snapshot, and dated KB reference bytes. They were preparation evidence, not independent deck builds. Their exact results remain:

- dev-1: 386 frozen candidates; preparation manifest `2c758e35ca9676fbac69bda30ba9c4b9572f58e4213b3ef945be7e58ba7b1c10`; prepared-state manifest `ee8eba10ffcaa64d0c031bf10d9dc0e33004a0bc3607a4a97cdebcc301a7d10d`.
- dev-2: 112 frozen candidates; preparation manifest `f6b71cebf4598067cae4d93687c9e854fe82a1900f2d8e663e87a8632975218a`; prepared-state manifest `950f743b17c6f1504c5cf9b51898490154a1a1126917dfa291235a995c51f0bc`.

Each preparation replay replaced global `fetch` with a throwing function and matched the complete JSON result exactly. Preparation manifests retain actual provider request occurrences. Their prepared-state manifests contain zero occurrences and bind emitted pins for the fixed-suite auditor; they are not retrieval or build recordings. The v1 inventory records 54 files with inventory SHA-256 `dc728617c4b8d9c876c2ca54632eecf444a94d99376528f5844bf4f8bf20fa29`. Its compatibility check accepted both bindings, while the standalone fixed-suite audit reported two compatible and twelve not prepared, with common readiness incomplete. The recorded test, typecheck, and build outcomes, references, and caveats remain in v1.

## Batch 2: dev-3 and original development-4 attempt

The immutable batch-2 `inventory.json` lists 35 files; its SHA-256 is `a77a5b74ff0553dd0469201414232d1101e4822834e490b4140d9169ec784a06`. Its separate `prior-verification.json` records the prior 54-file inventory hash `dc728617c4b8d9c876c2ca54632eecf444a94d99376528f5844bf4f8bf20fa29`. Batch-2 bounds are start `2026-10-28T14:50:16.642Z`, deadline `2026-10-28T15:02:16.642Z`, scope dev-3 and development-4 through development-6, and zero retries. Collection finished at `2026-10-28T14:50:23.293Z`; only dev-3 and development-4 were executed. Development-5 and development-6 were not run.

Both executed preparations retained the shared date `2026-10-28`, seed `issue-98-common-input-evidence-v1`, snapshot `issue-98-common-input-evidence-2026-10-28`, source hash `4f0b792b484f5c4880983b7a140b49280f93acc2ad4b41629aae95b4d91f407b`, and policy hash `9a3bf1c574b246b4c38449411ab482bf655604b3da851eeec5a2bd82079085cd`. Runtime was 120000 ms and retries were zero.

- **dev-3, Ayula, Queen Among Bears:** query `id<=g legal:commander (t:bear or t:basic)`, name order, four-page cap. Result: ready with 47 candidates. Preparation manifest `da54083f536b3c9a9358baa7957374a4612824a9e771940f53e084568c8ceac3` has two request occurrences and exact offline replay equality. Prepared-state manifest `8259caea5893ce8598dae2b32a829ff80292142ca9992cbc9806f3abb2d66c38` has zero occurrences. The latter is a prepared-state pin manifest, not provider retrieval evidence.
- **development-4, Zada, Hedron Grinder, original attempt:** query `id<=r legal:commander (t:instant or t:sorcery or t:basic)`, name order, four-page cap. The preparation manifest `51a721240f51334cc24b8a76545a510c7763f7a03eb9b7ec030600c7a9ffc1fd` has five request occurrences; exact offline replay matched. The result is `limit`, not ready. Four pages held 700 records while each retained page reported 1425 total cards, 175 returned cards, and `has_more: true`. The collector correctly did not treat this alphabetic prefix as complete. The attempted pool extraction returned `Collection not ready: limit`.

## Separately authorized development-4 cap resolution

The original batch scope stopped at the four-page limit. A separately identified, user-authorized attempt then changed only the finite page ceiling to nine; it was not a silent retry or an alteration of the original evidence. Its diagnosis was written before provider execution. It retained the same query, order, spec, settings, date, seed, snapshot, dated source and policy hashes, and 120000 ms preparation runtime. The diagnosis records the observed `ceil(1425/175) = 9` rationale, the schema maximum of 20, and the rule to stop with another limit if the result grows beyond nine pages.

The attempt bounds are start `2026-10-28T14:56:57.190Z`, deadline `2026-10-28T14:59:57.190Z`, max search pages 9, runtime 120000 ms, and zero retries. The 180-second overall window allowed at most nine search pages plus one commander lookup. The recipe kept query `id<=r legal:commander (t:instant or t:sorcery or t:basic)` in name order. Result: ready with 1407 candidates at `2026-10-28T14:57:07.900Z`, with exact record-plus-network-disabled replay equality. Preparation manifest: `99deca5e4f604b04eb2bfabfe0c45bd6351848c840d7b6a230506612a9bdf3dd` (10 request occurrences). Prepared-state manifest: `2cef3506643544c1c688c22d0faf062e5d855746f2c8f7da9e104377fe1b087c` (zero occurrences). These are distinct artifacts: only the preparation manifest records retrieval; the prepared-state manifest binds the emitted state for audit use.

The nine-page cap is a bound supported by the observed count, not a claim of comprehensive strategy coverage or a guarantee against growth. The broad type query omits nonbasic lands and many supporting creatures and artifacts; narrowing it to selected text or mana values had no fixed spec predicate and would add a new retrieval heuristic. This pool is not bracket certification, ranking evidence, or evidence that a completed deck satisfies constraints.

## Aggregate audit and remaining limits

The aggregate audit in `issue-98-preparation-partial-final/` failed. `audit-failure-diagnosis.json` compares the pins with deep equality and identifies the only differences for dev-1 and dev-2: their pinned `recommenderVersion` is `1718c0fdfa05f5441b25c4edda0afa7552fa3db2`, while the current value is `8cf8071b6e6fe31afc18ad7cd6a2b0be568afdfe`. Dev-3 and development-4 have no pin differences. There is no combined compatibility success. The original pins and recorded execution results remain intact; any future version-aware audit must use the original pinned execution and must not rewrite those pins.

This batch does not establish common readiness, a baseline, current policy currency, gameplay quality, full constraint satisfaction, ranking quality, or completed construction-ready decks. No dev-5/dev-6 or holdout execution occurred. There were no app changes, tuning runs, repeated builds, publishing, or release activity in this evidence update. Issue #98 remains open for the remaining research and audit work.

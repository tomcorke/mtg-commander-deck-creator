# Preparation compatibility reconciliation

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) remains open. This is a documentation-only follow-up to [common-input evidence v1](common-input-evidence-v1.md) and [v2](common-input-evidence-v2.md); neither record nor any earlier failure is rewritten. Raw evidence is in `E:/working/agent-sandbox/research/deckbuild/issue-98-preparation-compatibility/`.

## What changed

The earlier aggregate audit failed because retained pins named two recommender versions: dev-1/dev-2 used `1718c0fdfa05f5441b25c4edda0afa7552fa3db2`; dev-3/development-4 used `8cf8071b6e6fe31afc18ad7cd6a2b0be568afdfe`. Git diffs from those pins to this run's source commit, `ccc559a25b108d541caa1e0143c5fb90c13c1a92`, contain documentation only: from the first pin, `docs/agents/deckbuild/README.md` and `common-input-evidence-v1.md` / `v2.md` add 73 lines; from the second, the README and v2 add 41 lines. All four new pins use `ccc559a25b108d541caa1e0143c5fb90c13c1a92`. The strict HEAD and deep-equality guards remain unchanged.

At the pinned execution commit, `prepareBuild` derived four new prepared states from the original byte-hashed normalized recipes. Deep comparison found exactly one changed pin in each case: `recommenderVersion`. All other pins matched. These are new, zero-occurrence prepared-state manifests, not new provider retrievals. The original provider retrieval manifests and their occurrences remain the original evidence:

| Case (pool; derivation)       | Recipe SHA-256                                                     | Original retrieval manifest                                        | Old prepared-state manifest â†’ new zero-occurrence manifest                                                                              |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| dev-1 (386; 143 ms)           | `44a321a498b93548440ffd51c0ad4b4bccd5558ef9e65432df841d6037b58296` | `2c758e35ca9676fbac69bda30ba9c4b9572f58e4213b3ef945be7e58ba7b1c10` | `ee8eba10ffcaa64d0c031bf10d9dc0e33004a0bc3607a4a97cdebcc301a7d10d` â†’ `fc588c71d397443f125382706f41af68595f6fba806b271343376c2e913f62de` |
| dev-2 (112; 49 ms)            | `d50f680c13fb9a6da9fb5f5d5bcb0fbdd235bc0e97aa96a303d28424b0a67f9a` | `f6b71cebf4598067cae4d93687c9e854fe82a1900f2d8e663e87a8632975218a` | `950f743b17c6f1504c5cf9b51898490154a1a1126917dfa291235a995c51f0bc` â†’ `c2e8a3c1468d8402b92a9584e436dcd3cd6b311b90cb5426a2b4e83a5b8c597a` |
| dev-3 (47; 34 ms)             | `c4c1497cfb43ee4cf46e263bccadc724eb4011198df21d1ae2680478bfec8ba1` | `da54083f536b3c9a9358baa7957374a4612824a9e771940f53e084568c8ceac3` | `8259caea5893ce8598dae2b32a829ff80292142ca9992cbc9806f3abb2d66c38` â†’ `e40640b8ec85b72c8e3dc02fa4894009b43c29586488920c7e6d6ef6c94647a4` |
| development-4 (1,407; 292 ms) | `38edb352a3d09e1279c99b093076ae151741cc7b928abe916aad54773382fc84` | `99deca5e4f604b04eb2bfabfe0c45bd6351848c840d7b6a230506612a9bdf3dd` | `2cef3506643544c1c688c22d0faf062e5d855746f2c8f7da9e104377fe1b087c` â†’ `58bd9998486fbe624effc795b384e237882779edb2722b6703c7d0f62e31e04e` |

The four recipe hashes, pool counts and timings above come from `comparisons.json`. The historical four-page development-4 `limit` attempt and the separately bounded nine-page retrieval remain separately recorded in v2; the original retrieval ID shown here is the successful nine-page retrieval.

## Bounds, inventory, and audit

The run started `2026-10-28T15:09:18.593Z`, with deadline `2026-10-28T15:19:18.593Z`, and finished `2026-10-28T15:09:20.113Z`. Bounds were four cases, 120,000 ms maximum per derivation, one aggregate audit, zero network requests, and zero retries. `derive.mjs` replaced global `fetch` with a throwing function before loading the preparation/freeze code.

The new `inventory.json` lists 35 evidence files (it does not hash itself) and has SHA-256 `b43052d29fd222f9986cfb71e6c25982db2e9b339fd409fb00738feb8d7baf83`. Before derivation, all files in the four earlier inventories were re-hashed and verified: common-input v1, 54 files (`dc728617c4b8d9c876c2ca54632eecf444a94d99376528f5844bf4f8bf20fa29`); batch 2, 35 (`a77a5b74ff0553dd0469201414232d1101e4822834e490b4140d9169ec784a06`); development-4 attempt 2, 20 (`dbe467e0c39556e6799c825d1e4749558c2c1bb0742684bbf8c3a6d68a4dc31e`); and partial-final, 80 (`9a151912d16931dfb20ceac41cd1456755c97042513f1ddf345d578a30e05345`).

The frozen audit reports four compatible cases (dev-1, dev-2, dev-3, development-4), ten not prepared (development-5 through development-8 and holdout-1 through holdout-6), and `commonReadiness: incomplete`. The initial missing-zod setup and standalone-audit BOM failures remain recorded in v1. The original four-page development-4 limit and failed aggregate audit remain recorded in v2. Reproduction must use execution commit `ccc559a25b108d541caa1e0143c5fb90c13c1a92`; the later documentation merge has a different HEAD pin. Do not bypass the guard or rewrite historical pins.

No provider collection, deck builds, tuning, development-5/6 or holdout execution, app change, publishing, policy-currency check, or baseline claim occurred. No new knowledge-base finding was made. Validation: all 943 tests, lint, typecheck, and build passed; existing lint/build warnings remain. Independent delivery review is recorded in the PR.

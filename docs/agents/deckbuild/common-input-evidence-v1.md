# Retained common-input subset evidence

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98), 2026-10-28. Research only; no application changes. Raw exclusive evidence root: `E:/working/agent-sandbox/research/deckbuild/issue-98-common-input-evidence/`.

Two fresh independent provider preparations use unchanged dev-1 and dev-2 briefs/settings, shared date/seed/snapshot and byte-copied dated KB references. This is preparation evidence, not independent deck builds. Original suite and old recordings remain unchanged; `freeze-result.json` preserves prior provider identities separately.

Collection started 2026-10-28T14:42:32.756Z; deadline 2026-10-28T14:54:32.756Z; finished 2026-10-28T14:42:38.486Z. Each preparation has a 120-second runtime and four-page search cap; no provider retries. Bounds are operator checked, not whole-agent enforcement. Setup missing-zod failure and standalone-audit BOM failure are retained separately; dependency installation and encoding correction preceded successful execution.

- dev-1: ready, 386 frozen candidates; preparation manifest `2c758e35ca9676fbac69bda30ba9c4b9572f58e4213b3ef945be7e58ba7b1c10`; prepared-state manifest `ee8eba10ffcaa64d0c031bf10d9dc0e33004a0bc3607a4a97cdebcc301a7d10d`.
- dev-2: ready, 112 frozen candidates; preparation manifest `f6b71cebf4598067cae4d93687c9e854fe82a1900f2d8e663e87a8632975218a`; prepared-state manifest `950f743b17c6f1504c5cf9b51898490154a1a1126917dfa291235a995c51f0bc`.

Preparation replay replaced global fetch with a throwing function and matched the complete JSON result exactly. Preparation manifests retain actual commander lookup/search occurrences. Prepared-state manifests contain zero occurrences: they bind emitted pins for the fixed-suite auditor, and are not retrieval or build recordings. Both manifest types are retained; neither is an old recording relabelled. `collect.mjs` retains exact queries, runtime, normalization path and replay procedure. Pools are bounded explicit searches, not app multi-source parity or comprehensive candidate coverage.

`freeze-inputs.ts` accepted both bindings; standalone `fixed-suite.ts` reports both compatible and twelve not-prepared, with commonReadiness incomplete. This does not establish a common corpus, current policy, full constraints, construction-ready completed decks, ranking quality, labels, repeats or baseline completion. Six holdouts remain untouched. Existing policy currency, gameplay and printing-preference gaps remain unresolved. No new sourced KB finding or primary-source refresh occurred.

Exact SHA-256 references (all other retained files are enumerated in `inventory.json`):

- `source.md`: `4f0b792b484f5c4880983b7a140b49280f93acc2ad4b41629aae95b4d91f407b`
- `policy.md`: `9a3bf1c574b246b4c38449411ab482bf655604b3da851eeec5a2bd82079085cd`
- `kb.md`: `4554707ed0bb557a6a44aac178de8ae5b4ec709e5fe13adf8010f951a8bcc54c`
- `dev-1-recipe.json`: `44a321a498b93548440ffd51c0ad4b4bccd5558ef9e65432df841d6037b58296`
- `dev-2-recipe.json`: `d50f680c13fb9a6da9fb5f5d5bcb0fbdd235bc0e97aa96a303d28424b0a67f9a`
- `dev-1-pool.json`: `15ac6e377e2d46214ff599282244ffeb26e0c242cc0aa79ce047e99d790c9f69`
- `dev-2-pool.json`: `119c1a9714d5d1ad56ca12f0de255179583b3ff1808da196bd675c04e42e137d`
- `frozen-suite.json`: `3e51f0591ea38ce37fbf2d7baa231468e184e8075fae13e518af646652193a30`
- `audit.json`: `8ea279e77a2aea118acd5febb2772d4a57bd5c8083a2966b7c0071372b262eef`
- `bindings.json`: `d877bb30ed50f7eaa83b6aa5087e0d35da3c4d64e82cf52ea81b0ab8e5c8e101`

KB commit and copying caveat: `provenance.json`. Source reference is the dated provider note, policy reference the dated format-policy note, KB reference the rules note; hashes pin bytes without renewing their original check dates.
`pnpm test` passed all 943 tests; typecheck and build passed. Initial lint flagged Markdown formatting; corrected with Prettier and reran lint. Build retains existing chunk-size/dynamic-import warnings. No review, PR, push, merge or publishing performed.

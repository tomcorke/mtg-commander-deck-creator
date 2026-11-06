# Dev-3 pool repair v1

Issue [#264](https://github.com/tomcorke/mtg-commander-deck-creator/issues/264), part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98), 2026-11-06. The [pool exhaustion diagnosis](dev3-pool-exhaustion-diagnosis.md) found the dev-3 pool (47 candidates) could not fill 99 library slots. This record replaces the dev-3 input with a broader Scryfall-only pool. Prior dev-3 evidence is unchanged.

Raw evidence: `E:/working/agent-sandbox/research/deckbuild/issue-264-dev3-pool/` (`collect.mjs`, `audit.mjs`).

## Recipe

Same spec (Ayula, Queen Among Bears, bracket 1), settings, date `2026-10-28`, seed, snapshot, source, policy and KB hashes as the other development inputs. Only the pool search changed:

- before: `id<=g legal:commander (t:bear or t:basic)`
- after: `id<=g legal:commander (t:bear or t:instant or t:sorcery or t:basic)`, name order, max 20 pages, 120 s, zero retries

Instants and sorceries supply the declared ramp, draw, removal and wipe targets while keeping the Bear creature theme. The query was chosen before execution, not tuned on outcomes. No EDHREC requests (permission for live EDHREC recordings is pending in #309). It omits non-Bear creatures, artifacts, enchantments and nonbasic lands, so it is a sufficient pool, not a complete one.

## Result

| Item                                       | Value                                                              |
| ------------------------------------------ | ------------------------------------------------------------------ |
| Status                                     | ready; 1,142 candidates (≥ 99 slots)                               |
| Retrieval manifest (8 Scryfall requests)   | `2b4315fdcc8329b3c5ce672a95a81b10a976694a017c757c475e5391be1f13bd` |
| Prepared-state manifest (0 requests)       | `028b25214c4ffa95328c26ed98e36b84f444d87d97a281ae011d1a9ac5128e8b` |
| Offline recipe `dev-3-recipe.json` SHA-256 | `ca634f49f10f257ca0c1b44d4cdc72ee404441216595d2dc9ca0af8f2ac7378a` |
| Replay with `fetch` throwing               | exact JSON equality                                                |
| Execution commit                           | `bbf9efc`                                                          |

## Common-input audit

The other 13 bindings came from `issue-98-holdout4-23page`. Its inventory verified except two log files appended after hashing (`execution.log`, `test.log`; recorded in `prior-verification.json`). The first aggregate audit failed with `Provider pins incompatible` (`audit-failure.json`): those prepared-state pins predate the current recommender version. `audit.mjs` re-derived the 13 prepared-state manifests offline with `fetch` throwing; each differed from its predecessor only in `recommenderVersion` (`comparisons.json`). `freezeInputs` with fetch forbidden then reported all 14 cases compatible and `commonReadiness: ready` (`audit.json`). Final inventory `inventory-final.json` SHA-256 `dc0401baf80b18a7d85b44aafbf0443ac0af6f0e4045a8433b946e78408d3e82`.

## Prior evidence

Batch-2 inventory (35 files, includes the original dev-3 recipe and preparation) re-verified with no mismatches. The v5 stopped build's `stop.json` (`038cafac…`) and `extend-14.json` (`40931efe…`) are unchanged. No new dev-3 build was run; this establishes pool size only, not deck quality.

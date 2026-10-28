# Remaining development preparations v1

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) remains open with all remaining acceptance work outstanding. This is a documentation-only continuation of [common-input evidence v1](common-input-evidence-v1.md), [v2](common-input-evidence-v2.md), and the [preparation compatibility reconciliation](preparation-compatibility-v1.md). Raw evidence is retained at `E:/working/agent-sandbox/research/deckbuild/issue-98-remaining-development-preparations/`.

## Identity and bounds

Both `collect.mjs` and `continue.mjs` require execution HEAD `ccc559a25b108d541caa1e0143c5fb90c13c1a92` and stop on any mismatch. The strict HEAD guard and deep-equality audit were not changed or bypassed. The four preparations reused the retained common inputs dated `2026-10-28`: seed `issue-98-common-input-evidence-v1`, snapshot `issue-98-common-input-evidence-2026-10-28`, source SHA-256 `4f0b792b484f5c4880983b7a140b49280f93acc2ad4b41629aae95b4d91f407b`, policy SHA-256 `9a3bf1c574b246b4c38449411ab482bf655604b3da851eeec5a2bd82079085cd`, and knowledge-base SHA-256 `4554707ed0bb557a6a44aac178de8ae5b4ec709e5fe13adf8010f951a8bcc54c`. These are retained dated bytes; no policy refresh was performed.

The retained bounds began `2026-10-28T15:18:25.153Z`, deadline `2026-10-28T15:30:25.153Z`, and finished `2026-10-28T15:19:52.891Z` within that deadline. Four cases were attempted, each with a 120,000 ms runtime limit and at most 20 search pages (up to 21 transport requests per case; 84 total). Retries were zero. Queries were explicit broad pools from declared themes, not outcome-tuned; development-7's ninja query is intentionally partial, and development-8's partner-tempo query omits other support. The bounds make no completeness claim and do not auto-expand.

| Case          | Exact Scryfall query                                           | Result / pool count                        | Retrieval manifest (transport entries)                                  | Prepared-state manifest (entries)                                      |
| ------------- | -------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| development-5 | `id<=rw legal:commander (t:artifact or t:basic)`               | ready; 2,655 cards                         | `fc98a3330dc5fa0fc5e0c382754eddbea62d7a6776f5c539f36d50a8bf3a17fd` (17) | `011c527306387b6f58d6b41bacf474e9b3a571cc0bf7d7bfd6ebde487b84a6aa` (0) |
| development-6 | `id:c legal:commander (t:artifact or t:eldrazi or t:basic)`    | ready; 2,233 cards                         | `b27a10917bc6b73f1d68986773656fec66dac4293bb49bc87b299169deb84145` (15) | `2000ae237a9b9fca8f7a8424d0136d0e8d303e00f1e3f52d6f706b69155dbb96` (0) |
| development-7 | `id<=ub legal:commander (t:ninja or t:basic)`                  | ready; 65 cards                            | `23a9dcf701fbe4dfebe41bb592b411e24cb08ca95275d81ef56bd4b36d526d7f` (2)  | `96117308d43581aa99de0be4ffc0055ba1fdf1e4e46671441630907461caaa9b` (0) |
| development-8 | `id<=wubr legal:commander (t:instant or t:sorcery or t:basic)` | limit at 20 pages; no completed pool count | `972d1b95410171bb72fb2d4ae7da50057a1fd230b07d52ad6ecf65a5fb6e5dd9` (21) | none                                                                   |

Each outcome, including the capped development-8 result, replayed exactly (`replayEqual: true`). Retrieval manifests record provider transport; the ready cases' prepared-state manifests pin the resulting frozen state and have zero transport entries. These three zero-entry manifests are not retrievals. The four zero-occurrence derivations in the preceding compatibility reconciliation likewise remain separate from their original retrieval evidence. Development-8 was not retried or expanded after reaching its page limit.

For reproduction, `collect.mjs`/`continue.mjs` call `recordPreparation` against the pinned checkout, then call `replayPreparation` for the recorded manifest with global `fetch` replaced by a throwing function and require exact JSON equality. The aggregate `freezeInputs` audit also runs with fetch forbidden. The initial setup failed with `ERR_MODULE_NOT_FOUND: zod` before provider execution; `pnpm install --frozen-lockfile` succeeded, and `continue.mjs` resumed under the same deadline with no provider retry.

## Frozen result and retained evidence

The frozen audit reports 7 compatible cases (dev-1, dev-2, dev-3, development-4 through development-7), 7 not prepared (development-8 and holdout-1 through holdout-6), and `commonReadiness: incomplete`. This is a compatible prepared subset, not a common corpus or baseline. It establishes no full pool coverage, policy freshness, deck builds, or recommendation-quality result. No holdout was executed.

All previous evidence inventories were re-hashed and verified without rewriting them:

| Retained inventory                       | Files | Inventory SHA-256                                                  |
| ---------------------------------------- | ----: | ------------------------------------------------------------------ |
| `issue-98-common-input-evidence`         |    54 | `dc728617c4b8d9c876c2ca54632eecf444a94d99376528f5844bf4f8bf20fa29` |
| `issue-98-common-input-evidence-batch-2` |    35 | `a77a5b74ff0553dd0469201414232d1101e4822834e490b4140d9169ec784a06` |
| `issue-98-development-4-attempt-2`       |    20 | `dbe467e0c39556e6799c825d1e4749558c2c1bb0742684bbf8c3a6d68a4dc31e` |
| `issue-98-preparation-partial-final`     |    80 | `9a151912d16931dfb20ceac41cd1456755c97042513f1ddf345d578a30e05345` |
| `issue-98-preparation-compatibility`     |    35 | `b43052d29fd222f9986cfb71e6c25982db2e9b339fd409fb00738feb8d7baf83` |

The new `inventory.json` records 113 files and has SHA-256 `8e465314a6c309b155c7ef4dff05939339eb6a2e7c7ccbd1ddaae5a2fcc43692` (the inventory does not hash itself). Evidence record hashes are:

| File                      | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `bounds.json`             | `cc701879bebb478ac1057a2c1c15867dee9fbc9bfa2b497ab38db9ffcbf06fea` |
| `outcomes.json`           | `bad29492482a5a22987e17948f070cd3ef50035ac234887e8401eb2a88b93711` |
| `finished.json`           | `d5631a9d64312d3d972fcebfe74874e78524c98b398daf2ed9bc13e02a487482` |
| `provenance.json`         | `42c69046d1ff75979df5534cf1287e8eb9d39a6513c744f9223acdac593da9a3` |
| `prior-verification.json` | `2e0b2a4908e7881b24aecd2bb437ef0401fc6e2b520ab3120cbd621ca30b2e1e` |
| `freeze-result.json`      | `d2b05149b581e0b73b369c8088de3ed564c65b8704d958a9455407c19cee3424` |
| `setup-failure.json`      | `d41d229a91eb07e35d954451ff7ff2c615d6739894fc633117f89a9eecb8fea4` |
| `collect.mjs`             | `43bc7df0ceb0128b1bb86079e883ae4503f350676646e33454b1870601f6eab6` |
| `continue.mjs`            | `d006698c792aeef53c855c487de1d8900ee77a6f360b7d4f4d3d2e8e9a8949cc` |

All remaining #98 acceptance stays open. This record adds no claim of a shared corpus, complete retrieval, current policy, or completed deck builds.

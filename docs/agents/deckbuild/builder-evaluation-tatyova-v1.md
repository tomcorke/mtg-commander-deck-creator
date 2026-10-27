# Tatyova candidate evaluation, prompt v1

One fresh Codex `gpt-6.1-sol` builder with `reasoningEffort: low` used the unchanged [builder prompt v1](builder.md) to build a 100-card Tatyova, Benthic Druid candidate. A separate fresh session returned a validated best-effort desk review. This adds a different strategy and bracket intent to the [Goblin candidate](builder-evaluation-complete-v1.md); it is neither a paired comparison nor the repeated baseline required by [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Fixed brief and evidence

The new fixed brief targets bracket 3: interactive landfall value, developing resources for a strong accumulated-resource combat turn, with games intended to last at least six turns and no intentional infinite combos. It asks Tatyova to turn land drops into cards and life, then accumulated lands and creatures into a combat win. These are assignment goals, not demonstrated gameplay outcomes.

The recipe explicitly selects balanced/upgraded, excludes Game Changers, tutors, extra turns and unreleased cards, and sets heuristic targets of 38 lands, 12 ramp, eight draw, nine removal and two wipes. These filters do not certify bracket fit. Total budget and per-card cap are null; allowed sets, must-include and must-exclude are empty. Those constraints impose no additional restrictions; this run does not test nonempty constraint enforcement or budget certification.

Provider-backed preparation uses the recorded query `id<=gu legal:commander (o:landfall or o:"additional land" or o:"search your library" t:land) mv<=6`, ordered by name with five pages maximum. It completed two pages, returning 178 results with no remaining page. This is completeness for that query, not strategic retrieval coverage. Preparation, settings, seed, date, source identity and policy topic hashes are pinned in the retained recipe and manifests. No prior builder choices were carried forward, and no recommender mechanism changed.

| Identity                   | Recorded value                                                     |
| -------------------------- | ------------------------------------------------------------------ |
| Evaluation HEAD            | `a2c3ad8bd32264099810e3fe68e0a9b2516356d5`                         |
| Builder prompt SHA-256     | `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b` |
| Knowledge-base commit      | `5b1412c6b304cff9369b393b42d2197aca622a12`                         |
| Preparation manifest       | `83e85092ac4c3abbad63955c225e8e79b5b9246e3299f71ad4870465ca0d178d` |
| Build manifest             | `8e396a1f9bb4da8988b0b06ead143164be1c8211dcad134af93c7abc10a15bf5` |
| Final report SHA-256       | `a6de4b3a9adcdc89311f795b4c63f59d894ea9b30250669ece2ad456640696e3` |
| Original inventory SHA-256 | `6e5dc23178f817191913f504750fc5d015e3f9a87f8c8fe560aed6d48906242b` |
| Review bundle hash         | `2531942d22bdfd63dab93c95f6903b6f88d93f1d6c8de8e1e8585083893dfef1` |

Evidence remains outside Git at `E:/working/agent-sandbox/research/deckbuild/issue-98-slice-17/`. `inventory.json` covers 80 original files; `operator/` separately retains recovery calls, replay/gate outputs, integrity checks, staged review configuration, actual task receipt and validated result. The original result and failures were not rewritten after recovery. Reproduction requires a clean checkout at the evaluation HEAD, retained store and exact command log; later documentation commits correctly fail the pinned version check. No card images were downloaded.

## Bounds and verification

The assignment allowed 300 commands, 60 batches, 14 extensions and 90 seconds per invocation. Setup began at `2026-10-27T23:25:19.164Z`, with execution cutoff `23:37:19.164Z` and finalization deadline `23:41:19.164Z`. A retained `spawnSync` supervisor refused late CLI starts and capped child runtime at the smaller of 90 seconds and the remaining phase time. It enforces CLI process deadlines, not the agent's entire activity or all artifact writes.

The completed log uses 45 commands, five extensions and three batches. Last build execution ended at `23:28:32.343Z`; original artifacts finalized at `23:29:53.963Z`. No CLI call exceeded its phase deadline. Construction stopped after the complete candidate and an ancillary Windows `rg` path error. Required finalization verification failed to launch: the supervisor's `NODE_OPTIONS --import` used an `E:/` path rather than a file URL, causing `ERR_UNSUPPORTED_ESM_URL_SCHEME`. The builder preserved all three failed finalization calls and made no retry. Thus artifacts were timely, but the builder session did not complete its required verification.

The operator then ran a distinct four-minute recovery phase at `23:30:21.218Z`, using a file URL for the same fetch-blocking preload and a 90-second child timeout. Preparation replay, full build replay and construction finished at `23:30:31.702Z`, within that recovery bound and the original deadline. Both entire replay reports matched their originals; the construction gate returned `ready`. These are operator proofs, not a retroactive successful builder finalization. The preload replaces `globalThis.fetch` with a throwing function; it is not an OS network sandbox.

Operator checks verified all 80 original inventory hashes, the unchanged prompt hash, all five append-log concatenations, exact spec equality and matching name multiplicities between the final deck and raw Oracle construction input. The gate uses supplied metadata and shared construction checks; artifact consistency does not authenticate provider claims or establish current policy. No new commands or deck edits were made during recovery.

## Candidate and desk review

The final main deck has 100 cards and no sideboard. It has 37 front-face lands plus Bala Ged Recovery's optional land face. Shared role heuristics count 38 lands, 15 ramp, 11 draw, 12 removal and two wipes; overlapping heuristic counts do not measure quality. Recorded lookup/search evidence supplied the grouped additions, including repeated basics. The retained action log preserves actual offered ranks/scores and explicit retrieval references.

The existing review runner staged only the projected spec/deck, Oracle evidence, unchanged reviewer/rubric/session contracts and approved rules/policy copies. A fresh Codex `gpt-6.1-sol`/low task returned a review accepted by `finishReview`, which rechecked staged hashes and the bundle. It reported no observed contamination and generic ambient host instructions, tools, skill catalog, workspace/branch, project instructions and date/runtime metadata. Restrictions were instructions; enforced-isolation acceptance remains unmet.

| Criterion     | Score / 5               | Confidence |
| ------------- | ----------------------- | ---------- |
| Bracket fit   | 4; appropriate estimate | Medium     |
| Effectiveness | 4                       | Medium     |
| Theme fit     | 5                       | High       |
| Idea fit      | 5                       | High       |
| Fun           | 4                       | Medium     |
| Synergy       | 4                       | High       |

The reviewer selected Tatyova, Avenger of Zendikar and Ramunap Excavator as strongest; Sporemound, Whelming Wave and Weather Maker as weakest. Its retained review cites supplied Oracle entries for these contextual judgements. It noted self-resetting bounce, token bookkeeping and some creature-draw engines that do not reward tokens. No swaps were proposed because outside-deck replacement evidence was absent. These judgements are not independent rank-benchmark labels or measured gameplay quality.

Bracket fit remains an apparent matchmaking fit. The reviewer found no intentional infinite engine, extra turns or mass land denial in the supplied text, but did not establish exhaustive interaction coverage or win-turn distribution. Policy copies were reviewed on 2026-10-03 and were not freshly verified. Actual pace, recovery under disruption, policy currency and enjoyment remain unresolved. No bracket certification follows.

## Triage and remaining work

- **Tooling:** Windows preload paths need file URLs. Operator recovery demonstrates that correction externally; no app or script behavior changed. The failed builder finalization remains a supervision/proof gap in #98.
- **Retrieval:** Avenger was absent from the initial pool because the explicit query capped mana value at six; recorded lookup supplied it. Canonical face names and future selected printings required deliberate recorded search for released editions. This is query/provider workflow evidence, not proof of a production ranking defect.
- **Ranking:** the retained explanation places Rampaging Baloths at zero-based position 141 with total score 35. That state can inform [#105](https://github.com/tomcorke/mtg-commander-deck-creator/issues/105); one selected state does not identify a causal defect or justify a recommender change.
- **Knowledge/gameplay:** policy currency, representative multiplayer pace and recovery, and separately recorded replacement-card evidence remain follow-ups within #98. No new shared rules or policy fact was established.

Keep #98 open for suites and holdouts, a third bracket/spec, independent repeats, reviewer-noise measurement, labelled ranking benchmarks, round summaries, workflow supervision and remaining acceptance. This candidate supplies useful full-deck evidence across another strategy, not an improvement or baseline-completion claim. No live app edits or publishing are included.

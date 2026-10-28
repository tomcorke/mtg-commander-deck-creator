# Deckbuild evaluation data

The [identical-deck Ayula re-reviews](reviewer-variation-ayula-v1.md) record three individual reviews with unchanged bundle/prompt/reference hashes. Scores agree in this one-deck sample while confidence and card selections vary; this is descriptive reviewer variation, not zero population noise or a completed repeated baseline.

The [Ayula candidate evaluation](builder-evaluation-ayula-v1.md) adds a third fixed brief with bracket-1 Bear-themed intent, exact offline replay, construction readiness and a fresh best-effort desk review. It retains failed setup attempts, explicit process deadlines and unresolved selected-printing preferences. Repeats, reviewer noise and ranking labels remain outstanding.

The [Tatyova candidate evaluation](builder-evaluation-tatyova-v1.md) adds a complete landfall deck with bracket-3 intent, operator-verified offline replay/construction and a fresh best-effort desk review. It preserves the builder's failed finalization separately from bounded operator recovery; policy currency and gameplay pace remain unresolved.

The [completed candidate evaluation](builder-evaluation-complete-v1.md) retains a 100-card construction-ready candidate, exact offline replay and one best-effort desk review, including its failed output collection and overall time-bound breach. It is not a repeated baseline round.

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) is being delivered in slices. The record/replay store, offline fixed-pool ranking benchmark, completed-deck review preparation, best-effort review sessions and [builder CLI with provider-backed nextBatch and name-lookup replay](builder-cli.md) are available. [Prepared-input generation](builder-cli.md#prepare-pinned-inputs-from-a-fixed-spec) now initializes CLI pins from a fixed spec, explicit settings and supplied frozen cards. Remaining provider workflows and end-to-end deck builds remain future work.

## Usage

Call `recordStore(absoluteResearchDirectory, pins)` with JSON spec, seed, resolved options, initial state, source/policy/recommender versions, explicit `today` and snapshot ID. Resolve all defaults before recording; never read browser storage. Keep data outside the checkout. Store image URLs as metadata; never fetch image bytes.

For each provider operation call `store.request(request, provider)`. The request descriptor requires provider, endpoint/page kind, method, full query and body, ordering, pagination, date and snapshot ID. Use `null` for unused fields. Include every response-affecting parameter, including headers if applicable, in the descriptor (for example in `query`). Preserve repeated query parameters as ordered pairs. Work IDs are orchestration metadata and must not replace the request descriptor.

The provider receives a copy of the descriptor and returns either `{ status: 'success', value: <JSON> }` or `{ status: 'failure', kind: <classification>, detail: <JSON> }`. Deliberately classify expected transport failures; a thrown exception aborts that operation and is not silently converted into recorded evidence. Successful empty or partial responses can be represented in the JSON value; retain provider outcome metadata there. Execute operations serially: overlapping requests are rejected.

Each occurrence invokes the provider once and saves its outcome before returning. Repeated requests are separate occurrences, so failure then success remains two outcomes. Identical response content shares one immutable SHA-256 file; an existing file is never overwritten. This is not a global request cache: a new recording may observe changed provider data.

`await store.finish()` seals the recorder and returns the manifest's SHA-256 ID. The manifest pins the initial inputs and ordered request/response references. Treat that ID as the run's provider manifest. Saving it again produces the same ID. Do not edit stored files; changed inputs or additional fetches require a new recording and a new baseline.

Call `await replayStore(directory, manifestId)` to replay. Its `pins` expose the pinned inputs; future CLI code must initialise from these. Call `replay.request(descriptor)` in recorded order and check its result before applying data. Replay has no provider callback and cannot fetch from the network. Only listed response hashes are used, even if other recordings exist in the directory.

Missing/out-of-order occurrences or absent response files return `status: 'incomplete'`. The replay instance stays stopped even if a file is later restored. A deliberately recorded failure instead returns a complete result containing that failure outcome. `replay.finish()` checks that every manifest occurrence was consumed. Missing manifests, malformed data and hash mismatches throw storage/integrity errors; they are not provider failures. Start a new replay after repairing storage.

Run the focused checks with `node --experimental-strip-types --test scripts/deckbuild/data.test.ts`.

## Fixed-pool rank benchmark

`scripts/deckbuild/rank-bench.ts` calls the shared `recommend` API once per frozen state. It reads only supplied JSON and writes JSON to stdout. It has no provider or network path and never reads browser storage. Keep real suites, reports and provider recordings in research storage outside the checkout. The committed `rank-bench.fixture.json` is synthetic metric verification, not a labelled MTG evaluation suite or evidence of recommendation quality.

```powershell
node --experimental-strip-types scripts/deckbuild/rank-bench.ts evaluate scripts/deckbuild/rank-bench.fixture.json <recommender-sha> > baseline.json
node --experimental-strip-types scripts/deckbuild/rank-bench.ts compare baseline.json challenger.json > comparison.json
```

Run `evaluate` from each version's checkout with its exact SHA. For a ranking-only experiment, reuse the identical suite. For a retrieval experiment, freeze both pools, label their union, and give each version its own pool with identical state and labels. `compare` accepts different pool hashes but rejects different case sets, non-pool state, labels, history or constraints. It checks label coverage for every pool member and offer. Missing labels are errors, never zero grades. Invalid commands or inputs exit nonzero with diagnostics on stderr and no partial JSON report.

### Suite contract

Start from the fixture; the exported `suiteSchema` and `parseSuite` define the validated format. A suite has `version: 1`, a description and nonempty cases. Each case has:

- `id`: stable partial-state identifier; `specId`: the fixed build brief identifier; `split`: `tuning` or `holdout`. Preserve mechanic-family separation when authoring the real suite.
- `state`: the complete prepared `RecommendState`. Resolve `deckTargets`, `focusedRole` and `powerTarget` explicitly so app defaults cannot silently change a comparison. `powerTarget` is optional for older suites; omission retains the pre-target scoring behavior. When present it is validated and pinned in the evaluation hash. Preserve pool order, evidence, tags and metadata. Use normalized card objects without printing-selection UI fields; deck and sideboard cards omit `reason` and may omit `printsUri`.
- `labels`: independent grades for all baseline/challenger candidates, plus known relevant cards absent from both pools. Each has a name, grade, rationale, `humanReview` (`pending`, `agreed`, `disagreed`) and `humanNote`. Grades: 0 harmful/off-plan, 1 plausible, 2 good, 3 excellent. Record disagreement without silently replacing the original grade; deliberate relabelling requires rerunning both versions. Scores produced by the recommender never supply labels.
- `previouslyOffered`: names already offered at earlier fixed points, for repeated-offer measurement.
- `forbiddenCards`: independently authored names that violate the case's spec constraints. This explicit oracle must include every known forbidden candidate in either pool. An empty list asserts no known violations; it does not certify legality or bracket fit. The completed-deck review path below provides a separate construction gate.

Names match after trimming and lowercasing. Duplicate case IDs, label names or pool names are rejected. Labels retain rationale and human review status in reports. Every report includes suite, evaluation-input and pool SHA-256 hashes, the supplied recommender version, shared scoring version, visible batch and recommender error. These hashes detect changed inputs; version attribution and report authenticity depend on the caller retaining the original files and running the stated checkout.

### Metrics

Each case measures only its visible batch of up to four; future queue batches are provisional.

- **Retrieval recall:** good/excellent labelled names present in the supplied prepared pool, divided by all good/excellent labelled names, including known misses. This is prepared-pool recall, before `recommend` exclusions. With no relevant labels it is `null`.
- **nDCG@4:** gain `2^grade - 1`, discount `log2(position + 2)` with zero-based positions. The ideal ranks the retrieved pool's labels, separating ranking from retrieval. Missing offer slots earn zero; no positive ideal gain yields `null`.
- **Precision@4:** good/excellent offers divided by four, even for a short or empty batch.
- **Good-option coverage:** 1 if the batch has a good/excellent offer, otherwise 0. Its mean is the share of batches with at least one good option.
- **Redundant offers:** count offers whose name appears in `previouslyOffered`, or whose Oracle identity (name fallback) repeats within this batch. Each offer counts at most once. This measures repetition, not strategic redundancy or package balance.
- **Constraint violations:** count offers in `forbiddenCards`, independent of the recommender's scores or exclusion explanations.

Errors remain visible alongside metrics. Comparison output retains both per-case reports and challenger-minus-baseline deltas. Its summaries keep tuning and holdout results separate, with error counts and each metric's unweighted case mean and defined-case denominator. Null metrics are excluded from means; empty groups stay null. More than one frozen state per spec weights that spec more heavily; this tool does not claim commander-level inference, confidence intervals or statistical significance.

Run `node --experimental-strip-types --test scripts/deckbuild/rank-bench.test.ts` for the synthetic checks. Real frozen states (commander-only, about 35/70/90 cards, missing roles and misleading matches), independently labelled union pools, and the synergy/support/lift and class-type ablations still need to be authored and evaluated under #98 before claiming quality improvements for #103 or #105. The first bounded #103 ranking experiment and its illustrative limits are recorded in [power targets](../../domain/power-targets.md).

## Builder prompt and first bounded session

Use the unchanged versioned [builder prompt](builder.md) with a separate pinned assignment. The [first bounded evaluation](builder-evaluation-v1.md) records one real provider-backed Krenko session: 24 reasoned commands, six inspect/choose/extend calls, a 12-card partial deck and exact network-disabled replay. Raw evidence stays in research storage; the summary retains identities, bounds, operator checks and feedback triage. This is workflow evidence, not a completed deck or baseline quality round.

## Remaining scope

Tracked in #98: remaining provider workflows such as Doctor and local-index integration; complete builder sessions and constraint evaluation; fixed specs and holdouts; real labelled ranking suites and experiments; round runner, round summaries, repeated baseline and reviewer-noise measurement. Best-effort reviewer restrictions are accepted; enforced execution isolation is not established. Provider-backed preparation, pool refresh and incremental command replay are available; these tools do not establish complete provider-backed builds or recommender quality.

## Completed-deck review path

Slice 3 accepts existing completed decks; it does not build decks or execute reviewers. `completed-review.ts prepare input.json` reads `{ "spec": ..., "cards": [...] }`. `cards` is an expanded array with one Scryfall-shaped Oracle object per copy, including the designated commanders (no sideboard). Exported `specSchema` and `oracleSchema` define the contract. No network or browser storage is used.

A spec has `commander` (one or two exact card names), `bracket` (1-5), `pace`, `experience`, `theme`, `idea`, and `constraints`: `totalBudget` and `perCardCap` (USD numbers or null), `currency: "USD"`, `allowedSets`, `mustInclude`, and `mustExclude` (arrays; empty means unrestricted). Commander promotion is outside this completed-deck path. Use a neutral brief without round, model or version identities.

Cards use provider fields `name`, `oracle_id`, `type_line`, `mana_cost`, `oracle_text`, `cmc`, `color_identity`, `legalities.commander`, `card_faces`, `power`, `toughness`, `game_changer`, `set`, and `prices.usd`. Essential metadata omissions produce `unresolved`; malformed field values are input errors. Multi-face cards need complete face type, mana cost and Oracle text fields. Empty Oracle text is valid. Set and price constraints refer to the supplied selected printing; missing constrained data is unresolved. Prices are snapshot estimates, not purchase guarantees. The caller must retain the source snapshot/date and its provenance privately; this tool validates supplied data, not its truth or freshness.

Preparation returns `ready` with `bundle` and `bundleHash`, or `rejected`/`unresolved` with errors and unresolved items and no bundle. Non-ready CLI results exit 1. Construction uses the shared validator, including its supported-pairing and chosen-colour limitations, and adds the exact size gate. Known violations take status precedence over unresolved metadata; both lists remain visible. Legality is a gate, never part of the score. Spec constraints are checked separately; bracket fit remains a review judgement.

The bundle contains only the validated spec, a sorted `deck` text string and allowlisted `oracle` objects. Extra input fields (including nested provenance) are discarded. It deliberately contains no run IDs, scores, tags, builder feedback, EDHREC evidence or image bytes. Sorting removes builder order. Free text in approved fields can still reveal identity; the operator must inspect the brief and provider data before review. This is a projection boundary, not a sandbox or a guarantee against contaminated source text.

Manual workflow:

1. Keep inputs and results in research storage outside the checkout. Run `node --experimental-strip-types scripts/deckbuild/completed-review.ts prepare input.json > prepared.json` and check the exit code and status.
2. In a separate review directory, stage only the ready bundle and its content hash, unchanged [reviewer.md](reviewer.md), [rubric.md](rubric.md), and approved dated knowledge-base references. Use neutral filenames, make the inputs read-only, and start a fresh reviewer session with access limited to that directory. The tool does not enforce filesystem/session isolation; if you cannot provide it, label the result as non-blind and do not use it as blind evaluation evidence.
3. Supply the approved Commander rules and format-policy topics from `E:/working/mtg-knowledge-base/knowledge/topics/commander/`. Keep their commit, hashes, prompt/rubric hashes and reviewer model/options in private operator records. Record any requested swap-card Oracle lookups separately and expose only their Oracle data to the reviewer.
4. Collect review.json, then run `node --experimental-strip-types scripts/deckbuild/completed-review.ts validate input.json review.json > validated.json`. It rejects non-ready decks, mismatched bundle hashes, absent strongest/weakest cards and absent swap cuts. Save `validated.json.review` as review.json and `validated.json.markdown` as review.md using a JSON-aware tool. Markdown is rendered from validated JSON so the two outputs stay aligned. Suggested swaps still need independent legality and spec checks; validation does not certify them or verify citations.

The review contract has `version: 1`, the prepared `bundleHash`, and `criteria` with `bracketFit`, `effectiveness`, `themeFit`, `ideaFit`, `fun`, `synergy`. Every criterion needs `score` (integer 1-5), `justification`, and `confidence` (`low`, `medium`, `high`); bracketFit additionally needs `fit` (`under`, `appropriate`, `over`, `unresolved`). `strongest` and `weakest` are nonempty arrays of `{ card, reason, sources: [string] }`. `swaps` contains `{ cut, add, reason, sources: [string] }`. `knowledgeGaps` contains `{ subject, claim, consulted: [string], uncertainty, effect, researchRequest }`. `limitations` is a nonempty string array. Swaps and gaps may be empty. All text fields other than Oracle text are single-line. The schema validates structure and binding, not judgement quality or source authenticity.

The synthetic completed-review tests exercise construction rejection, unresolved evidence, pairing and copy exceptions, provenance projection, ordering and review validation. They are not a completed-deck quality evaluation. Automated builder/provider wiring, fixed real specs and holdouts, enforced reviewer execution isolation, repeated rounds/noise estimates, real reviews and summaries remain tracked in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Best-effort review sessions

Slice 4 automates staging and collection around a fresh T3 `delegate_task`. The user explicitly accepted best-effort isolation for this slice: restrictions are instructions, not a sandbox. The child receives only the generated task, without parent conversation history. Host instructions and tool access may still exist. Results do not satisfy #98's original enforced-isolation acceptance criterion and must not be presented as proven blind evaluations.

The operator first inspects the brief, Oracle text and approved references for embedded provenance or instructions. Prepare the same completed-deck `input.json` described above. Create a private config outside the checkout:

```json
{
  "today": "2026-10-27",
  "knowledgeBaseCommit": "<full 40-character knowledge-base commit>",
  "sourceVersion": "<deck/source snapshot identity>",
  "references": [
    {
      "kind": "rules",
      "path": "E:/working/mtg-knowledge-base/knowledge/topics/commander/rules.md"
    },
    {
      "kind": "format-policy",
      "path": "E:/working/mtg-knowledge-base/knowledge/topics/commander/format-policy.md"
    }
  ]
}
```

The date, commit and snapshot identity are operator assertions; the runner does not authenticate the source or freshness. Reference text hashes preserve the exact supplied contents even if the knowledge-base working tree differs from the asserted commit.

1. Run `node --experimental-strip-types scripts/deckbuild/review-session.ts stage input.json config.json <new-private-output-directory>`. Its parent must exist, and the output must be outside this checkout. Staging rejects non-ready decks and existing output directories. Keep its stdout private.
2. Read `operator.json` in that output directory. Call T3 `delegate_task` with its `launch` object unchanged. It explicitly selects Codex `gpt-6.1-sol` with `target.options.reasoningEffort: "low"`, a fresh task and a stable retry ID. Never send the operator record, original input, source paths, version IDs, builder files or parent history to the child. The runner does not itself connect to T3 or invoke a model.
3. Retain the returned `taskId` and verify provider, model and options. End the turn while the async task runs. On completion, obtain its final `task_status` receipt and save the **structured payload** as `receipt.json`, not the MCP content wrapper. It needs `taskId`, terminal `status`, `providerInstanceId`, `model`, `options` (the returned array of `{id,value}`), and `summary` (the raw reviewer JSON envelope as a string). Pending tasks and questions are not completed reviews. Cancel stalled tasks rather than changing provider or effort; pause on quota exhaustion.
4. Run `node --experimental-strip-types scripts/deckbuild/review-session.ts finish <private-output-directory> receipt.json`. It checks staged text hashes and file membership, the deck binding, model/options, the envelope and the existing review validator. `result.json` contains the private receipt, source/configuration and hashes, plus aligned `review` and `markdown` for successful results. Extract these fields with a JSON-aware tool when separate review files are needed. Existing results are never overwritten. Failed/cancelled/interrupted tasks and reported contamination produce explicit non-review outcomes and exit nonzero; malformed results and integrity failures exit nonzero without a result file.

Only seven files go into a separate neutral temporary directory: the ready bundle, unchanged reviewer prompt and rubric, versioned [session instructions](session.md), review JSON schema, and the two approved references. They are marked read-only as a convenience; the reviewer can still have technical access elsewhere. The task forbids every other directory (including app/knowledge-base checkouts, builder artifacts, operator records, other reviews and skills), all skill use, network, connectors, browser, thread inspection and helpers. Staged source pointers are resolved to the supplied copies. Unavailable swap-card evidence becomes a knowledge gap; this slice does not perform external lookups.

The reviewer returns either a completed envelope with `isolation: "best-effort"`, `contamination: "none-observed"` and `ambientContext` (categories of generic host metadata observed), or an explicit contamination report. T3 can inject a workspace path, branch, general host instructions and skill catalog even without parent history; the reviewer reports these categories and proceeds without inspecting or using them as evidence. Deck-specific source revisions, evaluation versions, builder decisions and other judgements require a contamination outcome. Successful Markdown starts with the isolation limitation and reported ambient context. A self-report does not establish absence of contamination. Receipt attribution is trusted operator input, not cryptographic proof of which task ran; retain the actual T3 task record and inspect its activity when evidence matters. The runner detects changed staged inputs at collection time, not transient reads or modifications restored before collection.

Keep the temporary staging directory until collection finishes. Archive approved inputs and operator records privately if long-term reproducibility is needed, then remove the exact temporary directory recorded in `operator.json` (clear read-only file attributes first if necessary). The runner deliberately leaves evidence intact on errors. Never point cleanup at an inferred parent directory. A deliberate change to session instructions, prompt, rubric or references requires a new baseline; their hashes are kept separately. These sessions do not supply real suites, repeats, reviewer-noise estimates or recommender-quality evidence by themselves.

## Provider-backed commander preparation

`prepare-provider.ts` extends offline preparation by resolving the fixed spec's commander names through the shared Scryfall identifier adapter. Its recipe is the same as `prepare.ts`, with `commanders` omitted and optional `runtimeMs` (default 60000, range 1-600000). Complete explicit settings are required. Supply a normalized frozen `pool`, or select one of the provider-backed pool sources below. No browser defaults or storage are read. A supplied pool retrieves commanders only; preparation does not certify full spec compliance.

```powershell
node --experimental-strip-types scripts/deckbuild/prepare-provider.ts record E:/working/agent-sandbox/research/deckbuild-store recipe.json > preparation.json
node --experimental-strip-types scripts/deckbuild/prepare-provider.ts replay E:/working/agent-sandbox/research/deckbuild-store <preparation-manifest> > replayed-preparation.json
```

The store directory must already exist, be absolute and outside the checkout. Record mode uses the existing paced, allowlisted JSON transport and immutable hashed occurrence store; images are not fetched. The preparation manifest pins the validated recipe (including the supplied pool and runtime bound), date, snapshot, source/policy identities and checkout HEAD. Replay requires the same checkout HEAD, consumes the recorded transport and never calls the network. Retain this preparation manifest alongside the subsequent build manifest: the former contains commander retrieval provenance, while the latter pins the emitted initial state and build command log.

A `ready` result includes `pins`, provider `evidence` and `manifest`. Extract `pins` with a JSON-aware tool and pass that file to `recommend.ts record` as described above. Returned commander names must exactly match the spec; response order cannot change commander order. Canonical-name differences require deliberate correction of the fixed spec rather than silently rewriting it. Shared normalization and commander validation run before any pins are emitted. Missing/partial lookup evidence or provider failures yield `failed`; invalid construction yields `invalid`; missing replay entries yield `incomplete`; runtime exhaustion yields `limit`. These outcomes emit no executable pins and exit nonzero. Corruption or malformed input rejects with diagnostics. Runtime limits bound execution, so a limit outcome is not a deterministic deck result. A later successful recording is a separate manifest, preserving earlier failure evidence.

The synthetic tests prove lookup-to-preparation-to-build execution, partner ordering and rejection, failures, CLI replay, input/runtime bounds and missing/corrupt data. They do not establish live-provider freshness, complete pool retrieval or recommendation quality. Those and remaining evaluation acceptance stay in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Bounded provider search pools

Provider preparation also accepts `poolSearch` instead of `pool` (exactly one is required):

```json
{ "query": "id<=g legal:commander", "order": "name", "maxPages": 4 }
```

Use the same record/replay commands above. Query is explicit, nonempty and at most 2000 characters; order is `name`, `edhrec` or `released`; maxPages is 1?20. Pages begin at 1 and continue until `has_more` is false. A remaining page at the limit returns `limit` with `detail: "pool-pages"` and no pins. Failed or malformed pages return `failed`; missing replay data returns `incomplete`; corruption rejects. An empty completed search is a ready empty pool, not a claim that no suitable cards exist. Runtime bounds include commander lookup and all search pages.

Every page uses the shared Scryfall adapter and recorded transport. `poolEvidence` retains page cards, pagination and outcomes. Shared construction filtering removes commander duplicates, unverified or incompatible cards; selected printing set membership is checked against allowedSets. Shared candidate preparation applies exclusion policy, normalization, deduplication and seeded fallback ordering before existing pool commitment. Price caps remain shared builder filtering, and other spec constraints remain unevaluated intent.

The preparation manifest pins the search recipe and all transport occurrences. Retain it alongside the build manifest to preserve pool provenance. A fresh recording can retrieve changed data; replay never refreshes. This is an explicit search-pool source for executable evaluation, not parity with the app's EDHREC, local-index, theme, mechanic, role-gap and collection retrieval, nor in-build pool refresh. Use appPool below for shared live multi-source retrieval and refresh; local-index integration, real evaluation suites and remaining acceptance stay in #98. No live app behavior changes.

## Shared multi-source pools and in-build refresh

Provider preparation accepts `"appPool": true` instead of `pool` or `poolSearch`; exactly one source is required. It runs the existing app candidate loader in a headless context: commander lookup, EDHREC commander lists and card resolution, fallback searches when needed, theme searches, commander-mechanic searches, role-gap searches, and collection retrieval. This reuses the loader used by Deck Doctor discovery; it does not run Doctor swaps or create a Doctor review. No live application files change.

The same loader now handles the shared reducer's `pool` requests during a build, including `commitSettings` and `nextBatch` after retrieval settings change. Pending decisions are committed by the shared reducer first. The refresh preserves the deck, sideboard, ignored cards, deferred cards and preference state, replaces the queue, commits its pool key and recomputes the offered view through the shared recommender. Commander sub-theme metadata from EDHREC is retained. A build manifest contains its refresh transport occurrences; keep the preparation manifest for initial pool provenance.

All HTTP occurrences pass through the allowlisted immutable store. Parallel source work is serialized at the script transport boundary so the recorder remains single-flight. Each pool retrieval allows at most 100 transport dispatches and shares the enclosing preparation/build runtime limit. Exhaustion returns `limit` without committing a partial pool. Collection pages follow the existing shared adapter; ordinary discovery searches retain the app's bounded page behavior. Multi-source means the app's retrieval workflow, not an exhaustive catalogue of eligible cards. Browser local-index retrieval and late local arrivals are omitted.

Optional-source failures retain the app's fallback/partial-source behavior and remain recorded in the transport manifest. A failed required commander or collection-only operation returns `invalid`; a missing recorded response returns `incomplete` even when the app loader catches a provider exception. Corrupt stored data rejects. Replay uses no network. Empty successful retrieval can commit an empty queue and does not prove that no suitable cards exist. These tools still do not certify full spec constraints or recommendation quality. Real builder sessions, suites/holdouts, repeats, reviewer-noise estimates and remaining acceptance stay in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

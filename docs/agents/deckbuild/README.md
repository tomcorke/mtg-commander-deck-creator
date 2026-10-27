# Deckbuild evaluation data

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) is being delivered in slices. The record/replay store and offline fixed-pool ranking benchmark are available. Provider wiring and end-to-end deck builds remain future work.

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
- `state`: the complete prepared `RecommendState`. Resolve `deckTargets` and `focusedRole` explicitly so app defaults cannot silently change a comparison. Preserve pool order, evidence, tags and metadata. Use normalized card objects without printing-selection UI fields; deck and sideboard cards omit `reason` and may omit `printsUri`.
- `labels`: independent grades for all baseline/challenger candidates, plus known relevant cards absent from both pools. Each has a name, grade, rationale, `humanReview` (`pending`, `agreed`, `disagreed`) and `humanNote`. Grades: 0 harmful/off-plan, 1 plausible, 2 good, 3 excellent. Record disagreement without silently replacing the original grade; deliberate relabelling requires rerunning both versions. Scores produced by the recommender never supply labels.
- `previouslyOffered`: names already offered at earlier fixed points, for repeated-offer measurement.
- `forbiddenCards`: independently authored names that violate the case's spec constraints. This explicit oracle must include every known forbidden candidate in either pool. An empty list asserts no known violations; it does not certify legality or bracket fit. The separate construction/legality gate remains in #98.

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

Run `node --experimental-strip-types --test scripts/deckbuild/rank-bench.test.ts` for the synthetic checks. Real frozen states (commander-only, about 35/70/90 cards, missing roles and misleading matches), independently labelled union pools, and the synergy/support/lift and class-type ablations still need to be authored and evaluated under #98 before tuning #103 or #105.

## Remaining scope

Tracked in #98: provider adapters and complete builder CLI commands/views/logging/limits; fixed specs and holdouts; legality gate; builder/reviewer prompts and rubric; enforced reviewer isolation; real labelled ranking suites and experiments; round runner, round summaries, repeated baseline, reviewer-noise measurement and feedback triage. These tools alone do not establish exact build replay or recommender quality.

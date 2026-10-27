# Deckbuild evaluation data

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) is being delivered in slices. This first slice provides the record/replay store in `scripts/deckbuild/data.ts`. It does not yet wire the app's providers or run a deck build.

## Usage

Call `recordStore(absoluteResearchDirectory, pins)` with JSON spec, seed, resolved options, initial state, source/policy/recommender versions, explicit `today` and snapshot ID. Resolve all defaults before recording; never read browser storage. Keep data outside the checkout. Store image URLs as metadata; never fetch image bytes.

For each provider operation call `store.request(request, provider)`. The request descriptor requires provider, endpoint/page kind, method, full query and body, ordering, pagination, date and snapshot ID. Use `null` for unused fields. Include every response-affecting parameter, including headers if applicable, in the descriptor (for example in `query`). Preserve repeated query parameters as ordered pairs. Work IDs are orchestration metadata and must not replace the request descriptor.

The provider receives a copy of the descriptor and returns either `{ status: 'success', value: <JSON> }` or `{ status: 'failure', kind: <classification>, detail: <JSON> }`. Deliberately classify expected transport failures; a thrown exception aborts that operation and is not silently converted into recorded evidence. Successful empty or partial responses can be represented in the JSON value; retain provider outcome metadata there. Execute operations serially: overlapping requests are rejected.

Each occurrence invokes the provider once and saves its outcome before returning. Repeated requests are separate occurrences, so failure then success remains two outcomes. Identical response content shares one immutable SHA-256 file; an existing file is never overwritten. This is not a global request cache: a new recording may observe changed provider data.

`await store.finish()` seals the recorder and returns the manifest's SHA-256 ID. The manifest pins the initial inputs and ordered request/response references. Treat that ID as the run's provider manifest. Saving it again produces the same ID. Do not edit stored files; changed inputs or additional fetches require a new recording and a new baseline.

Call `await replayStore(directory, manifestId)` to replay. Its `pins` expose the pinned inputs; future CLI code must initialise from these. Call `replay.request(descriptor)` in recorded order and check its result before applying data. Replay has no provider callback and cannot fetch from the network. Only listed response hashes are used, even if other recordings exist in the directory.

Missing/out-of-order occurrences or absent response files return `status: 'incomplete'`. The replay instance stays stopped even if a file is later restored. A deliberately recorded failure instead returns a complete result containing that failure outcome. `replay.finish()` checks that every manifest occurrence was consumed. Missing manifests, malformed data and hash mismatches throw storage/integrity errors; they are not provider failures. Start a new replay after repairing storage.

Run the focused checks with `node --experimental-strip-types --test scripts/deckbuild/data.test.ts`.

## Remaining scope

Tracked in #98: provider adapters and complete CLI commands/views/logging/limits; fixed specs and holdouts; legality gate; builder/reviewer prompts and rubric; enforced reviewer isolation; ranking benchmark (including the synergy/support/lift and class-type questions in the issue comments); round runner, summaries, repeated baseline, reviewer-noise measurement and feedback triage. This foundation alone does not establish exact build replay or recommender quality.

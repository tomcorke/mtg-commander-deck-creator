# Builder CLI

Slice 5 of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) provides reasoned command execution from a frozen, prepared builder state. It uses shared `recommend`, `explainCard` and `applyBuilderAction`. Slice 6 executes reserved `nextBatch` hydration, signature pages and signature-card lookups through the record/replay store. Record mode can use the network; replay has no live provider. Pool refresh and Doctor discovery still stop `incomplete`. The CLI cannot yet build a deck from a commander/spec alone.

Slice 7 adds `lookup` for recorded name-based card evidence. It leaves the deck, queue, pending feedback and offer snapshot unchanged.

## Run

Create an existing absolute research directory outside the checkout. Keep input, command logs, manifests and reports there. The CLI resolves the store's real path and rejects a store within the checkout. It saves hashed manifests through the existing data store and never downloads images.

```powershell
node --experimental-strip-types scripts/deckbuild/recommend.ts record E:/working/agent-sandbox/research/deckbuild inputs.json commands.jsonl > recorded.json
node --experimental-strip-types scripts/deckbuild/recommend.ts replay E:/working/agent-sandbox/research/deckbuild <manifest-hash> commands.jsonl > replayed.json
```

Check the exit code and `status` before consuming a report. `complete` means the supplied commands finished, including an empty log; it does not mean the deck is complete or legal. Construction is explicitly `not-checked`. Feed a completed deck into the separate [completed-review preparation path](README.md#completed-deck-review-path) for its construction gate.

`incomplete`, `invalid` and `limit` reports exit 1 and retain the processed/attempted command prefix and current state. Malformed JSON, invalid schemas, changed pins/logs, wrong checkout versions and corrupt storage exit 1 with diagnostics on stderr and no JSON report. A rejected builder action preserves the previous state. An unsupported fetch-producing action retains its resulting state and stops before executing later commands. A missing replay occurrence retains the unsettled boundary and stops before applying a fabricated response. Restart from the original manifest and log; the output state is diagnostic, not a resumable transport checkpoint.

## Inputs

`inputs.json` has the data store's `Pins` fields: `spec`, `seed`, `resolvedOptions`, `initialState`, `sourceVersion`, `policyVersion`, `recommenderVersion`, `today`, and `snapshotId`. `recommenderVersion` must equal the full HEAD SHA of this checkout. Use a clean checkout for evaluation evidence: checking HEAD cannot authenticate uncommitted edits, supplied data, policy versions or the truth of a spec. Deliberate implementation changes require a new recording/baseline. This foundation does not translate a spec into options or certify its constraints.

`initialState` is a fully resolved `BuilderState`, validated by `initialStateSchema` in `scripts/deckbuild/builder-contract.ts`. Start from `createBuilderState(today, seed)` when authoring a fixture, populate the prepared commander/deck/pool/settings, then explicitly serialize every required field. Missing options are errors, rather than defaults from browser storage. The initial `signatureDeckKey` must equal `seed`; its `today` must equal the pinned date. The prepared pool must have unique names, committed settings (`committedPoolKey` from `builderPoolKey(state)`), no uncommitted feedback, and empty transport reservations, completion history, candidate buffer and Doctor undo history. This restricted entry point does not import arbitrary browser sessions.

`resolvedOptions` contains exactly the fields in `settingsSchema` (`BuilderSettings`) and must match those fields in `initialState`. Recording wraps these options with the CLI/scoring versions, parsed-command hash and resolved limits in the manifest. CLI protocol version 2 pins provider-backed behavior; version 1 manifests from the offline foundation are rejected and require a new recording. Manifests include every HTTP occurrence used by supported reserved work, including repeated attempts and failures. Replay rejects changed commands and incompatible scoring versions; a manifest with unconsumed provider entries yields `incomplete`. No attempt is made to invent responses or use another recording to fill gaps.

Each nonblank line of `commands.jsonl` is `{ "reason": "...", "action": { ... } }`. Reasons are required. For example, using exact names from the visible batch:

```jsonl
{"reason":"Inspect the prepared pool","action":{"type":"view"}}
{"reason":"Advance after inspecting the batch","action":{"type":"nextBatch"}}
{"reason":"Inspect a suspected retrieval miss","action":{"type":"explain","name":"Example Card"}}
```

`commandSchema` is the exact command contract. Supported shared actions cover decisions/likes/ignore reasons, zone choice, theme/sub-theme steering, settings/role targets/focus, collection settings, committing settings, advancing batches, deck edits, supplied card additions/printings, promotion, Doctor discovery/swaps/undo. Operator-supplied transport/state replacement actions (`data`, `restore`, `hydrate`, `poolLoaded`, `settleFetch`), initialization/reset and retry commands are excluded. Start a new pinned run to change the initial prepared data. Commands with supplied card data are operator-authored offline inputs, not evidence of provider retrieval or an autonomous builder drawing only from the CLI. Their contents and reasons are pinned by the log hash.

`decide` takes `{ "type": "decide", "name": "<exact offered name>", "decision": "add|later|ignore" }`. The CLI resolves the actual offered card rather than accepting a replacement payload. Decisions, likes and ignore reasons require a card in the current visible batch. Every decision entry records its one-based visible rank and complete shared score record before application. The score's own `position` is zero-based in the full queue.

The CLI calls `recommend` initially and after successful actions other than decisions, likes, ignore reasons and zone choice, once no feedback is pending. Recommendation inputs merge the current queue with deferred candidates through the shared candidate-merging helper, so deferred cards remain available and can return when eligible. While decisions, likes or ignore reasons remain pending, steering retains the original queue and offer snapshot until a shared commitment action consumes that feedback. This preserves both the original offered scores and the batch used for preference learning. It installs the returned queue/deferred cards as its next offer only after that boundary. This is an explicit CLI protocol; it does not reproduce browser rendering or asynchronous UI timing. Views retain shared scores, placement reasons, source evidence and exclusions, plus current deck analysis and role targets. `explain` evaluates the current state through the shared API; it can therefore report an already-selected card as `in-deck` while the offer snapshot still displays it.

## Bounds and replay proof

An optional fifth argument to `record` supplies a JSON limits object. Defaults are `{ "commands": 500, "batches": 100, "runtimeMs": 60000 }`. Limits are validated, bounded and pinned; replay takes them from the manifest. The batch limit includes the initial batch, and a transition exceeding it leaves the previous state intact. Runtime checks surround commands and fetch settlements. A run-wide abort signal bounds transport and pacing waits; synchronous shared calls remain cooperative and cannot be interrupted. A batch limit stops advancement before spending provider requests. Timed-out results depend on machine timing and are not exact replay evidence. Replay equality applies to completed or deterministically stopped runs on the same implementation and inputs within runtime limits; no duration/timestamps are included in the report.

Reports include the manifest, pin/log/state hashes, asserted recommender SHA, scoring version, action results, final state and view. Manifests bind the parsed JSON commands (object key order and blank lines are irrelevant), including reasons; retain the original log alongside its manifest. The supplied tests invoke the executable CLI in separate processes, compare record/replay JSON, verify shared pre-decision scores, forbid network access, and exercise incomplete fetches, invalid input and limits:

```powershell
node --experimental-strip-types --test scripts/deckbuild/recommend.test.ts
```

These synthetic checks prove the offline protocol, not deck quality. Pool refresh, Doctor discovery, other lookup workflows, builder prompting, real suites/holdouts, repeated rounds and summaries remain in #98. Best-effort reviewer sessions are unchanged; this slice makes no enforced-isolation claim.

## Provider-backed nextBatch

At a shared reserved boundary the CLI runs each pending work item serially, applies `settleFetch`, and continues through hydration, signature pages and signature-card lookup until the shared reducer advances the batch. It then refreshes the shared recommendation view. No scoring or seed-selection logic is duplicated in the CLI. Existing shared quotas bound signature work; hydration retains its existing request limit. Provider failures remain recorded outcomes and are settled according to the shared reducer, rather than stopping as missing evidence. Later boundaries may retry retryable failures.

The transport permits only Scryfall collection POSTs, search GETs and EDHREC card/commander page GETs, rejects redirects, and never fetches card images. It uses the existing adapters for response validation and failure classification. Each work item has a fresh adapter-client identity so caches and wall-clock cooldowns cannot suppress recorded occurrences. The live transport spaces requests by at least one second across work items and honours Retry-After, with a 30-second fallback for HTTP 429. It sends an application-identifying User-Agent. These are app safeguards, not a provider service guarantee.

Request descriptors contain provider/endpoint, method, complete ordered query parameters, effective explicit headers, redirect policy, serialized body, date and snapshot ID. Ordering/pagination are null for these non-paginated operations; any URL parameters remain in the ordered query. Work IDs stay in shared state and never substitute for transport descriptors. HTTP status, headers and text body are stored before adapter parsing, including error or malformed bodies. Network failures are separate stored failure outcomes. A response is not authenticated by these hashes: retain the original run evidence privately.

Replay reconstructs responses locally through the same adapters. Missing/out-of-order entries or absent response files stop `incomplete` without settling the missing work; malformed manifests, corrupt hashes and invalid transport envelopes are integrity errors, never provider failures. Successful, empty, partial, malformed-provider and failed requests can all replay. Runtime-limited runs are diagnostic and do not claim exact replay equality. All recordings, including deliberately stopped runs, need a new baseline when provider inputs change.

The synthetic provider tests verify the full reserved sequence and resulting candidate, network-free replay equality, repeated failure/success attempts, missing responses, corrupt storage and bounds. They exercise real adapters with supplied HTTP responses; they are not live-provider availability or recommender-quality evidence.

## Recorded name lookup

Use `{ "reason": "Inspect a candidate's Oracle text", "action": { "type": "lookup", "names": ["Example Card"] } }` to retrieve card data through the shared Scryfall identifier adapter. A command accepts 1–75 distinct names (case-insensitive), each trimmed, nonempty and at most 200 characters. It uses the same collection-only transport, pacing, runtime bound and immutable occurrence store as nextBatch. Each command gets a fresh adapter identity; a repeated lookup records a separate occurrence, including a failure followed by success.

The command's log entry has `result: { outcome, cards }` for successful, empty or partial lookups. `cards` contains the validated provider objects, including available Oracle fields and image URLs; images are not fetched. Missing names produce fewer cards and `partial` or `success-empty`. Transport/HTTP/provider-parse failures produce an explicit failure `outcome` without fabricated cards. A report can be `complete` with a failed lookup: that means the command finished, not that retrieval succeeded. Inspect each outcome. The adapter matches names using its existing identifier behavior; this is not fuzzy search or a guarantee of name-alias resolution.

Lookup evidence does not add cards or certify their suitability. An operator can supply returned cards to a later `addSearch` command, but this slice still uses a fully pinned command log rather than an interactive autonomous builder session. A missing replay entry stops `incomplete` before later commands, while storage corruption remains an integrity error. No protocol-version bump is needed: existing version 2 command logs retain their behavior and the new command is bound by the existing parsed-command hash and checkout SHA. Basics, printings, pool refresh and Doctor workflows remain in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Recorded single-page search

Slice 8 adds `{ "reason": "Find candidate evidence", "action": { "type": "search", "query": "example", "order": "name", "page": 1 } }`. Query text is trimmed, nonempty and limited to 1000 characters; ordering and an integer page from 1 to 100 are required. The schema lists accepted order values and excludes random ordering. The shared `searchScryfallPage` adapter executes exactly one page; the CLI never follows a returned next-page URL. Query, unique-card mode, ordering and page are pinned in the transport's ordered URL parameters.

Successful results contain `{ outcome, cards, pagination: { page, totalCards, hasMore } }`. Pagination describes provider data, not a complete retrieved pool. Search results undergo card and pagination validation before becoming evidence. The shared adapter maps HTTP 404 to an empty page; malformed and failed responses retain explicit failure outcomes. As with name lookup, inspect each outcome even when the run is complete. Each search occurrence is recorded independently, including failure followed by success. Missing replay evidence stops incomplete; corrupt storage rejects the run.

Search leaves builder state, pending feedback and offers unchanged. Returned cards can supply later operator-authored `addSearch` actions; this remains a pinned command-log workflow, not interactive deck construction. Existing version 2 logs retain their behavior. Pool refresh, Doctor, basics, printings, full spec initialization and evaluation work remain in #98.

## Add cards from recorded evidence

Slice 9 connects retrieval to builder additions without copying provider objects into the log:

```jsonl
{"reason":"Retrieve candidate evidence","action":{"type":"lookup","names":["Example Card"]}}
{"reason":"Select the retrieved candidate","action":{"type":"addRetrieved","commandIndex":0,"names":["Example Card"]}}
```

`commandIndex` is the zero-based index of an earlier parsed command (blank lines do not count). It must reference a `lookup` or `search` result containing card evidence. Select 1–75 distinct exact returned names, each at most 200 characters. Partial retrieval is usable for the cards actually returned. Missing, ambiguous, failed, current/future or non-retrieval evidence stops `invalid` before any addition; later commands do not run. Selecting a missing name alongside a present name adds neither.

The CLI resolves the validated provider objects from its own earlier results and calls shared `addSearch`. Shared construction checks, main-deck capacity and overflow into the app's sideboard apply unchanged. Repeated selections undergo those same checks. The original retrieval entry retains Oracle evidence; the reasoned selection records its source index and names. Additions use the existing recommendation/feedback boundary, and replay resolves the same objects from the pinned transport responses without network access. This does not certify a completed deck, spec constraints or bracket fit.

This remains a fully pinned command-log workflow from a prepared state. It does not provide an interactive session or full spec initialization. Existing version 2 logs retain their behavior; new logs bind selections through the existing command hash and checkout SHA. Remaining work stays in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

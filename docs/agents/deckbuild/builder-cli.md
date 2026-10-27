# Offline builder CLI

Slice 5 of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98) provides reasoned command execution from a frozen, prepared builder state. It uses shared `recommend`, `explainCard` and `applyBuilderAction`. Both modes read local JSON only. Provider adapters remain future work: any planned fetch stops execution as `incomplete`, with its requests in the report. The CLI cannot yet build a deck from a commander/spec alone.

## Run

Create an existing absolute research directory outside the checkout. Keep input, command logs, manifests and reports there. The CLI resolves the store's real path and rejects a store within the checkout. It saves hashed manifests through the existing data store and never downloads images.

```powershell
node --experimental-strip-types scripts/deckbuild/recommend.ts record E:/working/agent-sandbox/research/deckbuild inputs.json commands.jsonl > recorded.json
node --experimental-strip-types scripts/deckbuild/recommend.ts replay E:/working/agent-sandbox/research/deckbuild <manifest-hash> commands.jsonl > replayed.json
```

Check the exit code and `status` before consuming a report. `complete` means the supplied commands finished, including an empty log; it does not mean the deck is complete or legal. Construction is explicitly `not-checked`. Feed a completed deck into the separate [completed-review preparation path](README.md#completed-deck-review-path) for its construction gate.

`incomplete`, `invalid` and `limit` reports exit 1 and retain the processed/attempted command prefix and current state. Malformed JSON, invalid schemas, changed pins/logs, wrong checkout versions and corrupt storage exit 1 with diagnostics on stderr and no JSON report. A rejected builder action preserves the previous state. A fetch-producing action retains its resulting state and stops before executing later commands. Restart from the original manifest and log; the output state is diagnostic, not a resumable transport checkpoint.

## Inputs

`inputs.json` has the data store's `Pins` fields: `spec`, `seed`, `resolvedOptions`, `initialState`, `sourceVersion`, `policyVersion`, `recommenderVersion`, `today`, and `snapshotId`. `recommenderVersion` must equal the full HEAD SHA of this checkout. Use a clean checkout for evaluation evidence: checking HEAD cannot authenticate uncommitted edits, supplied data, policy versions or the truth of a spec. Deliberate implementation changes require a new recording/baseline. This foundation does not translate a spec into options or certify its constraints.

`initialState` is a fully resolved `BuilderState`, validated by `initialStateSchema` in `scripts/deckbuild/builder-contract.ts`. Start from `createBuilderState(today, seed)` when authoring a fixture, populate the prepared commander/deck/pool/settings, then explicitly serialize every required field. Missing options are errors, rather than defaults from browser storage. The initial `signatureDeckKey` must equal `seed`; its `today` must equal the pinned date. The prepared pool must have unique names, committed settings (`committedPoolKey` from `builderPoolKey(state)`), no uncommitted feedback, and empty transport reservations, completion history, candidate buffer and Doctor undo history. This restricted entry point does not import arbitrary browser sessions.

`resolvedOptions` contains exactly the fields in `settingsSchema` (`BuilderSettings`) and must match those fields in `initialState`. Recording wraps these options with the CLI/scoring versions, parsed-command hash and resolved limits in the manifest. Every manifest in this slice has zero provider entries: its data is entirely in the initial state and command log. Replay rejects changed commands and incompatible scoring versions; a manifest with unconsumed provider entries yields `incomplete`. No attempt is made to invent responses or use another recording to fill gaps.

Each nonblank line of `commands.jsonl` is `{ "reason": "...", "action": { ... } }`. Reasons are required. For example, using exact names from the visible batch:

```jsonl
{"reason":"Inspect the prepared pool","action":{"type":"view"}}
{"reason":"Advance after inspecting the batch","action":{"type":"nextBatch"}}
{"reason":"Inspect a suspected retrieval miss","action":{"type":"explain","name":"Example Card"}}
```

`commandSchema` is the exact command contract. Supported shared actions cover decisions/likes/ignore reasons, zone choice, theme/sub-theme steering, settings/role targets/focus, collection settings, committing settings, advancing batches, deck edits, supplied card additions/printings, promotion, Doctor discovery/swaps/undo. Transport/state replacement actions (`data`, `restore`, `hydrate`, `poolLoaded`, `settleFetch`), initialization/reset and retry commands are excluded. Start a new pinned run to change the initial prepared data. Commands with supplied card data are operator-authored offline inputs, not evidence of provider retrieval or an autonomous builder drawing only from the CLI. Their contents and reasons are pinned by the log hash.

`decide` takes `{ "type": "decide", "name": "<exact offered name>", "decision": "add|later|ignore" }`. The CLI resolves the actual offered card rather than accepting a replacement payload. Decisions, likes and ignore reasons require a card in the current visible batch. Every decision entry records its one-based visible rank and complete shared score record before application. The score's own `position` is zero-based in the full queue.

The CLI calls `recommend` initially and after successful actions other than decisions, likes, ignore reasons and zone choice, once no feedback is pending. Recommendation inputs merge the current queue with deferred candidates through the shared candidate-merging helper, so deferred cards remain available and can return when eligible. While decisions, likes or ignore reasons remain pending, steering retains the original queue and offer snapshot until a shared commitment action consumes that feedback. This preserves both the original offered scores and the batch used for preference learning. It installs the returned queue/deferred cards as its next offer only after that boundary. This is an explicit CLI protocol; it does not reproduce browser rendering or asynchronous UI timing. Views retain shared scores, placement reasons, source evidence and exclusions, plus current deck analysis and role targets. `explain` evaluates the current state through the shared API; it can therefore report an already-selected card as `in-deck` while the offer snapshot still displays it.

## Bounds and replay proof

An optional fifth argument to `record` supplies a JSON limits object. Defaults are `{ "commands": 500, "batches": 100, "runtimeMs": 60000 }`. Limits are validated, bounded and pinned; replay takes them from the manifest. The batch limit includes the initial batch, and a transition exceeding it leaves the previous state intact. Runtime checks are cooperative, before and after commands; they cannot interrupt a synchronous shared call. Timed-out results depend on machine timing and are not exact replay evidence. Replay equality applies to completed or deterministically stopped runs on the same implementation and inputs within runtime limits; no duration/timestamps are included in the report.

Reports include the manifest, pin/log/state hashes, asserted recommender SHA, scoring version, action results, final state and view. Manifests bind the parsed JSON commands (object key order and blank lines are irrelevant), including reasons; retain the original log alongside its manifest. The supplied tests invoke the executable CLI in separate processes, compare record/replay JSON, verify shared pre-decision scores, forbid network access, and exercise incomplete fetches, invalid input and limits:

```powershell
node --experimental-strip-types --test scripts/deckbuild/recommend.test.ts
```

These synthetic checks prove the offline protocol, not deck quality. Live provider request descriptors and response consumption, all-fetch action wiring, builder prompting, real suites/holdouts, repeated rounds and summaries remain in #98. Best-effort reviewer sessions are unchanged; this slice makes no enforced-isolation claim.

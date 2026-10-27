# Planned recommendation fetches

Issue #188 replaces signature polling and hourly, tab-wide budgets with reducer-owned work. The public API is exported from `src/recommendations.ts` and remains importable in Node.

`nextBatch` reserves work before transport runs. A reservation includes a stable ID, context generation, boundary ID and attempt number. Calling the planner again while a boundary is pending returns no new requests or quota charges. The app sends committed reservations from an effect; a script feeds the same recorded `settleFetch` actions into `applyBuilderAction`.

The order at a batch boundary is:

1. Settle any current-data hydration needed by the snapshot.
2. Select signature seeds and settle every planned EDHREC page.
3. In planned page order, select bounded candidate names and settle the card lookup.
4. Commit feedback and deferrals, advance cooldowns and the batch, merge signature results, then rank with the updated context.

Until all planned work settles, the old queue and batch remain visible. Missing responses stay pending. Duplicate and stale completions do nothing. A restore or new build advances the context epoch even when the workspace and commander names match a previous context. Responses are success, success-empty, partial, invalid, transient failure, permanent failure or cancelled. Only transient failure and cancellation permit another attempt at a later boundary. No retry timer runs.

The approved budget change is **eight page attempts and four card-lookup attempts per build**, held in `BuilderState.signatureQuota`. Each pass selects at most three seeds and 24 names per seed. A lookup reserves at most 72 distinct names, so it fits one provider collection POST. Cached, failed and cancelled logical reservations consume quota; cache warmth never changes the logical plan. Saving and settings refreshes retain quota; starting a new build resets it. Reload replay is outside scope and restored builds receive fresh quota defaults. Provider pacing, cooldowns and page-visibility pauses belong to transport, not planning.

Signature results can replenish a short or exhausted queue. The outgoing visible cards cannot be consumed twice, and new arrivals cannot be accidentally consumed as the outgoing batch. Existing exhaustion behavior still jumps to the next available deferral batch before merging arrivals. Role focus uses the same boundary and focused ranking. Owned, ignored and deferred cards remain blocked. Names excluded when a page was planned, and names already settled by a lookup, cannot reappear from that retained page after the queue advances.

Pool builds use checked local data when ready and never await the optional index. Late local results are buffered and merged only after the next planned batch boundary settles; they do not change the active batch or its decisions. `prepareCandidates` accepts ordered raw records, including `released_at`, EDHREC entries and hydrated records, provenance and provider outcomes. The app uses this preparation before ranking. Current-data hydration runs at workspace initialisation, pool completion, explicit retry and batch boundaries, rather than reacting to every pending-card change. Automatic printing repair no longer starts from arbitrary queue changes; printing loading remains attached to initialisation, settings commits and batch advancement.

Proof: `pnpm test` includes frozen/interleaved replay, reverse order, missing/duplicate/stale responses, partial and malformed data, quotas, retries, short queues and app-handler/script parity. `pnpm check:planned-fetches:browser` uses controlled providers in the repository's sandboxed Chrome harness to verify idle silence, a held batch, repeated clicks, settlement and visible signature additions.

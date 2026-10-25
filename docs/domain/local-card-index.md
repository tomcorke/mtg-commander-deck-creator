# Local card index

The index supplements live recommendations; it does not replace EDHREC evidence or Scryfall Tagger searches. Its roles, themes and feature labels are the app's heuristics, not rules or provider classifications. Provider field meanings and bulk-format observations live in the [card-data reference](../../../mtg-knowledge-base/knowledge/topics/providers/card-data.md).

## Generate and publish

```bash
pnpm build:card-index
pnpm build
```

`pnpm build` runs the generator before Vite. It downloads Scryfall's Oracle bulk data, sets and creature-type catalog, validates the complete inputs, then writes `public/local-card-index.json`. Vite copies this ignored artifact into `dist/`; generated data and downloaded images are never committed. The production build substitutes the downloaded creature catalog into the bundled creature-type module without changing the tracked development snapshot.

The generator supports gzip JSONL manifests and legacy JSON-array downloads. A daily source cache and previous validated artifact live under `LOCALAPPDATA/commander-creator/card-index`, or `XDG_CACHE_HOME`/`~/.cache` on other systems. Rebuilding a cached source reruns the current classifiers. If refreshing fails, generation warns and uses a previous validated index. With no valid prior artifact, the build fails rather than publish an empty pool. Preserve this cache between builds where possible.

## Contents and coverage

Cards are ordered by Oracle ID. Numeric postings index actual creature subtypes, `tagsFor`, `rolesForCard`, and categorical `cardFeatures` labels such as `mana:repeatable`. Oracle mentions can add theme tags without making a card a creature of that type. Subtype postings currently follow printed type lines; shared every-type matching remains in [#136](https://github.com/tomcorke/mtg-commander-deck-creator/issues/136). Costs and explanatory evidence text are not feature labels.

Card rows retain gameplay text, faces, mana value, colour identity, Commander legality, Game Changer membership, release/printing information and Scryfall image URLs. Prices and purchase URLs are omitted; local-only prices are unknown until live enrichment. Existing price-cap behavior still permits unknown prices.

Metadata records the bulk timestamp, creature catalog, full provider sets snapshot with card counts, and newest **represented printing set**. Oracle bulk data selects one printing per gameplay identity. The newest represented set is not proof of complete set membership, and this table cannot answer printing/set-ownership questions.

Measured on 2026-10-25:

| Item                            |      Measurement |
| ------------------------------- | ---------------: |
| Commander-legal card identities |           32,116 |
| Creature catalog values         |              367 |
| Raw artifact                    | 34,741,032 bytes |
| Gzipped artifact                |  6,713,838 bytes |

The payload exceeds #137's initial estimate because it retains offline gameplay and presentation data. Gzip size assumes the host enables HTTP compression; it is not a measured production transfer. Payload reduction and mobile parsing measurements are tracked in [#148](https://github.com/tomcorke/mtg-commander-deck-creator/issues/148).

## Runtime

`src/adapters/local-card-index.ts` fetches the artifact only on its first query or count, never merely because the start screen renders. Concurrent consumers share the load. It compares sets, changed set dates/counts and new creature types against live provider inventories, checking again after fifteen minutes on the next query. Requests have timeouts. Status is exposed by `localCardIndexStatus()` and logged as `fresh`, `stale`, `unchecked` or `unavailable`, with reasons and the bulk timestamp when known. A failed check is never called fresh; a failed index load never reports a known zero count.

`queryLocalCardIndex` unions selected theme, creature-type, role and feature postings, applies colour identity, and keeps stable table order. `countLocalCards` exposes the same breadth for future count displays. Theme tags include support cards; use the singular `creatureTypes: ['Cat']` facet for subtype membership alone.

The index is progressive in the builder: a recommendation build never waits for it. If the index is not loaded and coverage-checked, `localCardsIfReady` starts the load and returns nothing, and the build records each local query it skipped. The first batch shows live results only. Once the index is ready, `enrichWithLocalCards` runs those queries, plus the release-ordered refresh when the index is stale, and appends new candidates to the end of the queue. They are ranked at the next batch boundary. Enrichment never touches the visible batch or a pending decision, and it skips cards already queued, in the deck or sideboard, ignored or deferred. If a role focus or a nearly empty queue leaves the visible batch short of four cards, a card that would join it is dropped until the next pool build rather than appearing mid-decision. A superseded request writes nothing. Deck Doctor still waits for the index, since it is not a first-batch path.

Builder theme retrieval, role-gap retrieval, fallback pools and Deck Doctor merge local candidates with live results. Oracle IDs deduplicate renamed cards; legacy records fall back to names. Live records override snapshots, while live EDHREC inclusion/synergy evidence is retained. A saved `localIndexSnapshot` flag prevents later query merges from replacing live data with a snapshot and gives local-only matches no popularity/evidence bonus; current-data hydration clears it.

Normal live searches always remain active. A stale or unchecked index also triggers a release-ordered search from the bulk date so popularity ordering does not hide recent cards. This refresh currently uses the existing one-page search adapter; pagination for long-outdated indexes is tracked in [#149](https://github.com/tomcorke/mtg-commander-deck-creator/issues/149). Local results remain useful during ordinary network failures, but provider cooldown errors still propagate. Collection-only retrieval continues to use live printing-aware queries.

## Performance (#151)

Measured on 2026-10-25 against the 34,741,032-byte artifact above, at source commit `f5dcae9`, with headless Chrome 155. `pnpm measure:local-card-index` reproduces the main-thread rows; values are medians of three runs. The mobile row is a 4x CPU-throttled desktop, a documented equivalent rather than a real device.

| Profile                    | JSON parse | Validation | Longest task | Heap retained |
| -------------------------- | ---------: | ---------: | -----------: | ------------: |
| Desktop                    |      68 ms |     131 ms |       199 ms |         43 MB |
| Mobile equivalent (4x CPU) |     308 ms |     583 ms |       891 ms |         43 MB |

The hosted artifact is served with `Content-Encoding: gzip` and transfers 6,950,123 bytes (`Cache-Control: max-age=600`). At 9 Mbps that is about 6 s before parsing. A warm HTTP cache skips the download but not the parse. The response text adds another transient ~35 MB until it is collected.

Before #151, the first batch waited for all of this, plus the two-request coverage check. That is roughly 7 s on the mobile equivalent; this figure is derived from the rows above, not timed end to end. Now the first batch is independent of the index; the browser gate proves the batch renders while the index request is still open. The parse is still a single main-thread long task after the first batch (about 0.9 s on the mobile equivalent), so it can delay a click made while it runs. Worker parsing or a smaller payload is the next step and is coordinated with [#148](https://github.com/tomcorke/mtg-commander-deck-creator/issues/148).

Provider request counts are unchanged: every live search still runs, the coverage check adds one sets and one creature-type request per fifteen minutes, and a stale index adds one release-ordered search per live query. The index offers no request saving. Live sources are never skipped.

Recommendation quality (live-only compared with local-plus-live on fixed provider responses) is not yet measured; candidate counts are not evidence of better picks. That evaluation is tracked in [#154](https://github.com/tomcorke/mtg-commander-deck-creator/issues/154).

## Checks and comparisons

```bash
pnpm check:local-card-index:browser
pnpm audit:recommendations -- --local-index public/local-card-index.json --output audit.md
```

The browser gate checks start-screen laziness, shared loading, stale-type logging and missing/corrupt fallback. It also checks that a delayed, missing or failed index never delays the first live batch, and that enrichment keeps the visible batch and its decisions. Unit tests cover generator/cache failures, classifier parity, numeric-posting validation, coverage drift, identity filtering, counts, live precedence, exclusions and Deck Doctor integration.

The audit can use a pinned artifact for deterministic local role-gap breadth and records its bulk/set metadata. EDHREC evidence and Tagger searches remain live, so this is not a full deterministic replay. The provider-manifest replay and fixed-pool ranking harness remain part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

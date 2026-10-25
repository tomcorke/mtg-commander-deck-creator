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

Builder theme retrieval, role-gap retrieval, fallback pools and Deck Doctor merge local candidates with live results. Oracle IDs deduplicate renamed cards; legacy records fall back to names. Live records override snapshots, while live EDHREC inclusion/synergy evidence is retained. A saved `localIndexSnapshot` flag prevents later query merges from replacing live data with a snapshot and gives local-only matches no popularity/evidence bonus; current-data hydration clears it.

Normal live searches always remain active. A stale or unchecked index also triggers a release-ordered search from the bulk date so popularity ordering does not hide recent cards. This refresh currently uses the existing one-page search adapter; pagination for long-outdated indexes is tracked in [#149](https://github.com/tomcorke/mtg-commander-deck-creator/issues/149). Local results remain useful during ordinary network failures, but provider cooldown errors still propagate. Collection-only retrieval continues to use live printing-aware queries.

## Checks and comparisons

```bash
pnpm check:local-card-index:browser
pnpm audit:recommendations -- --local-index public/local-card-index.json --output audit.md
```

The browser gate checks start-screen laziness, shared loading, stale-type logging and missing/corrupt fallback. Unit tests cover generator/cache failures, classifier parity, numeric-posting validation, coverage drift, identity filtering, counts, live precedence, exclusions and Deck Doctor integration.

The audit can use a pinned artifact for deterministic local role-gap breadth and records its bulk/set metadata. EDHREC evidence and Tagger searches remain live, so this is not a full deterministic replay. The provider-manifest replay and fixed-pool ranking harness remain part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

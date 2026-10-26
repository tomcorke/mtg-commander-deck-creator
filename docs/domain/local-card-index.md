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

Recommendation quality is measured below; candidate counts alone are not evidence of better picks.

## Quality (#154)

Measured on 2026-10-26 with `pnpm evaluate:local-retrieval`, which runs production Deck Doctor retrieval (EDHREC, theme and role-gap searches) and first-batch ranking twice per deck: once live-only and once with the local index. The provider fixture is recorded once and replayed offline, so both arms see identical live responses.

- Source commit `2e543db` plus the role-gap fix below. Corpus bulk `2026-10-25T21:01:54.847+00:00`, newest set `mdd`.
- Provider fixture: 63 responses, sha256 `99b4ffd46d688bf6e7c81e9a2ab726caed2f93e77f385ffc8a0e7b4a54ed042c`. It is 19 MB of provider data and stays outside the repository, like the index.
- Settings: precon power, Game Changers, tutors, extra turns and unreleased cards excluded, deck health on, balanced style, no collection, default targets, no price cap. No index status is supplied, so the stale-index release refresh does not run.

Eight partial decks cover two narrow creature-type themes, two non-typal themes, two creature-only starts with role gaps, and two decks EDHREC already serves well. Eight labelled strong fits per deck were written before the first run.

| Deck                      | Live pool | Local+live pool | Labels found (live → both) | Local-only in top 20 | Top 4 changed |
| ------------------------- | --------: | --------------: | -------------------------: | -------------------: | ------------- |
| Ayula bears (typal)       |       245 |             292 |                  6/8 → 7/8 |                    4 | no            |
| Arahbo cats (typal)       |       339 |             498 |                  4/8 → 6/8 |                    1 | yes           |
| Teysa sacrifice           |       337 |           2,662 |                  8/8 → 8/8 |                    0 | no            |
| Sythis enchantments       |       321 |           2,017 |                  8/8 → 8/8 |                    0 | yes           |
| Krenko goblins (role gap) |       290 |             596 |                  6/8 → 6/8 |                    2 | no            |
| Ghalta (role gap)         |       197 |             197 |                  6/8 → 6/8 |                    0 | no            |
| Atraxa counters (EDHREC)  |       409 |           2,874 |                  8/8 → 8/8 |                    2 | yes           |
| Ur-Dragon (EDHREC)        |       318 |             848 |                  8/8 → 8/8 |                    0 | no            |

A blind spot-check rated 125 cards U (useful now), M (marginal) or N (not useful) from a shuffled sheet without arm or rank. Each deck mixed both arms' top fours, the six best-ranked local-only additions and a random six from live ranks 5–40. The reviewer was the agent that wrote the script, so this is a manual check, not an independent panel.

| Group                   |   U |   M |   N |
| ----------------------- | --: | --: | --: |
| Live top 4              |  20 |  11 |   1 |
| Local+live top 4        |  20 |  10 |   2 |
| Live sample, ranks 5–40 |  21 |  22 |   5 |
| Best local-only         |   7 |  22 |  13 |

Findings:

- **Recall improves only for narrow typal themes.** Arahbo found Adaptive Automaton and Metallic Mimic; Ayula found Webweaver Changeling. Every other deck's labels were already in the live pool. The large non-typal pool growth (up to 7×) added no labelled card.
- **Local-only additions are weaker than live candidates.** 17% were rated useful, against 44% of the live sample. The useful ones were Ruthless Knave and Skullport Merchant (Teysa), Goblin Airbrusher (Krenko), Idyllic Grange and Room of Refuge (Atraxa), and Dragonbroods' Relic and Draconic Disciple (Ur-Dragon).
- **Top-four usefulness is unchanged overall** (20 U in each arm). Arahbo improved by one useful card; Sythis and Atraxa each lost one. No local-only card reached a top four. Those changes come from local cards raising role supply in the ranking context, tracked in [#175](https://github.com/tomcorke/mtg-commander-deck-creator/issues/175).
- **Every-type lands crowd typal ranks.** Soulstone Sanctuary ranked 6th for Ayula, ahead of stronger live cards, with Mutavault, Faceless Haven and Abundant Countryside close behind. Tracked in [#174](https://github.com/tomcorke/mtg-commander-deck-creator/issues/174).
- **Evidence is not inflated.** No local-only addition carried EDHREC inclusion or synergy.
- **Local supply skipped a live search (fixed).** Before this change, local snapshot cards counted toward role supply in `uncoveredRoleGaps`, so Ayula's local arm dropped `otag:removal` from its live Tagger search and its pool had 16 removal candidates instead of 25. Role gaps now count only live candidates, and both arms send the same searches.
- **Role-gap decks gained little.** Ghalta's creature-only start triggered no gap search because EDHREC already supplied enough cards for each role, so the index never ran. Krenko's local additions were mostly lands and marginal goblins.
- **The #151 short-batch ceiling was not observed.** With each spell role focused, every live queue already had four visible cards, so no local addition was dropped. It can still occur for very small pools; this evaluation did not reproduce one, so the result is inconclusive rather than clean.

Decision: keep local retrieval, since it is the only source of the extra typal recall and live sources are never skipped. Restrict its influence through #174 and #175 before giving local candidates more weight. The label set is small and the spot-check has one reviewer, so treat the per-deck differences as indicative.

## Checks and comparisons

```bash
pnpm check:local-card-index:browser
pnpm audit:recommendations -- --local-index public/local-card-index.json --output audit.md
pnpm evaluate:local-retrieval -- --record --fixtures <fixture.json> --output <dir>
```

The browser gate checks start-screen laziness, shared loading, stale-type logging and missing/corrupt fallback. It also checks that a delayed, missing or failed index never delays the first live batch, and that enrichment keeps the visible batch and its decisions. Unit tests cover generator/cache failures, classifier parity, numeric-posting validation, coverage drift, identity filtering, counts, live precedence, exclusions and Deck Doctor integration.

`evaluate:local-retrieval` replays offline without `--record`; a missing fixture stops it rather than fetching. The audit can use a pinned artifact for deterministic local role-gap breadth and records its bulk/set metadata. EDHREC evidence and Tagger searches remain live, so this is not a full deterministic replay. The provider-manifest replay and fixed-pool ranking harness remain part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

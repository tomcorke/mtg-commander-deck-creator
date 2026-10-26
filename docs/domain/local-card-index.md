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

The version 1 wire format stores fixed-column card rows and a shared string dictionary.
Column order lives in `src/domain/local-card-index.ts`; changing it requires a new
wire version. Numeric string cells reference the dictionary, while mana value and
Game Changer cells retain their scalar types. Null cells omit absent fields; `[null]`
preserves explicitly unknown Game Changer data. Nested faces, images and legality
objects retain their existing shape. Links and image URLs are preserved verbatim.
The decoder expands rows before the existing card, posting and coverage validation.
It also accepts legacy object artifacts for build-cache fallback; unknown wire
versions fail through the existing unavailable-index fallback. No request is added
to the start screen and live data keeps precedence.

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

## Role-supply ranking (#175)

Decision: snapshot candidates contribute zero to ranking role supply, matching the live-only
retrieval-gap policy. A discount would still make live-card boosts depend on snapshot breadth.
Snapshots remain eligible recommendations and receive role boosts themselves; hydration clears
`localIndexSnapshot`, after which the card counts normally. Initial scoring contexts and batch
advancement share this count. This is an app ranking heuristic, not a claim about card quality.

Replayed the #154 provider fixture on 2026-10-26 before and after this change, based on
`e463caf7edd846ff7dddc0f1007194a8be5a1b9b`. The before run includes only the evaluation script's
builder-action compatibility repair; the after run adds the role-supply change (scoring version 2).
Both use the same corpus bulk `2026-10-26T21:01:59.922+00:00`, newest set `mdd`, and the settings
listed under #154. This is a newer corpus and code baseline than the original #154 report;
compare these two runs, not their absolute ranks against that older report.
Provider fixture sha256 remains `99b4ffd46d688bf6e7c81e9a2ab726caed2f93e77f385ffc8a0e7b4a54ed042c`.
Corpus artifact sha256 is `70e5ae269752e7e149f812ad87c009ed1475faedd6c604bc29a891a61ec2a358`.
The replay accesses 66 request keys (including replayed failures absent from the fixture), with
no network recording. Raw reports and summaries are outside Git at
`E:/working/agent-sandbox/research/local-role-supply-175/{before,after}`; the fixture is at
`E:/working/agent-sandbox/research/local-retrieval-154/provider-fixtures.json`.

```text
pnpm evaluate:local-retrieval --fixtures E:/working/agent-sandbox/research/local-retrieval-154/provider-fixtures.json --local-index E:/working/mtg-commander-deck-creator/public/local-card-index.json --output E:/working/agent-sandbox/research/local-role-supply-175/after
```

| Deck      | Top four differs between live and local+live, before → after | Local-only in top 20, before → after |
| --------- | ------------------------------------------------------------ | ------------------------------------ |
| Ayula     | no → no                                                      | 1 → 1                                |
| Arahbo    | no → no                                                      | 0 → 0                                |
| Teysa     | no → no                                                      | 0 → 0                                |
| Sythis    | yes → no                                                     | 0 → 0                                |
| Krenko    | no → no                                                      | 1 → 3                                |
| Ghalta    | no → no                                                      | 0 → 0                                |
| Atraxa    | yes → no                                                     | 2 → 0                                |
| Ur-Dragon | no → no                                                      | 0 → 0                                |

Sythis's local+live first batch changes from Witch Enchanter, Gleaming Splendor, Mana Bloom,
and Hall of Heliod's Generosity to Sanctum Weaver, Mana Bloom, Gleaming Splendor, and Hall of
Heliod's Generosity. Atraxa replaces Summon: Fenrir with The Theorist, Jace Beleren, matching
the live-only batch. All eight live-only batches are unchanged. Candidate pools, labelled recall,
and live search lists are unchanged in both arms; no local-only top-four card appears.
This proves removal of the measured supply interference, not improved general recommendation
quality. Local-only ranks can still change because those cards use the same live-supply boosts.

Regression tests fail before the fix on both seams: a snapshot raises context ramp supply from
1 to 2, and 30 snapshot ramp cards reverse two live cards during batch advancement. They pass
afterward, including snapshot eligibility, snapshot-only supply, and hydrated-card counting.

## Checks and comparisons

```bash
pnpm check:local-card-index:browser
pnpm audit:recommendations -- --local-index public/local-card-index.json --output audit.md
pnpm evaluate:local-retrieval -- --record --fixtures <fixture.json> --output <dir>
```

The browser gate checks start-screen laziness, shared loading, stale-type logging and missing/corrupt fallback. It also checks that a delayed, missing or failed index never delays the first live batch, and that enrichment keeps the visible batch and its decisions. Unit tests cover generator/cache failures, classifier parity, numeric-posting validation, coverage drift, identity filtering, counts, live precedence, exclusions and Deck Doctor integration.

`evaluate:local-retrieval` replays offline without `--record`; a missing fixture stops it rather than fetching. The audit can use a pinned artifact for deterministic local role-gap breadth and records its bulk/set metadata. EDHREC evidence and Tagger searches remain live, so this is not a full deterministic replay. The provider-manifest replay and fixed-pool ranking harness remain part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Payload measurements for #148

Measured on 2026-10-26 using the same 32,116-card corpus (bulk timestamp
`2026-10-26T21:01:59.922+00:00`) before and after a lossless full-corpus round trip.
Raw bytes fall from 34,741,032 to 26,798,023 (23%); Node gzip bytes fall from
6,713,838 to 6,182,424 (8%). All cards and postings compare deeply equal.

Sequential `pnpm measure:local-card-index` runs in sandboxed headless Chrome
155.0.8059.85, medians of three samples per profile:

| Profile / format                     | JSON parse ms | Validate + expand ms | Longest task ms | Long-task total ms | Retained heap MB |
| ------------------------------------ | ------------: | -------------------: | --------------: | -----------------: | ---------------: |
| Desktop / object                     |            52 |                   80 |             132 |                132 |               43 |
| Desktop / compact                    |            43 |                  101 |             143 |                143 |               40 |
| Mobile equivalent (4x CPU) / object  |           241 |                  475 |             744 |                951 |               43 |
| Mobile equivalent (4x CPU) / compact |           181 |                  464 |             644 |                644 |               40 |

These are CPU-throttled desktop measurements, not physical mobile-device results.
Expansion is included in validation. Desktop total decode slightly regresses;
mobile parse, total decode and retained heap improve in this run. Long tasks remain,
and timings vary between runs. The format reduces transfer size without claiming
to eliminate main-thread stalls or improve recommendation quality/provider counts.

A production HTTP request on this date returned `Content-Encoding: gzip`,
`Content-Length: 6950465` and `Cache-Control: max-age=600` for the existing object
artifact. The compact artifact has not been published: its gzip bytes above are
local compression measurements, not measured production transfer. Verify transfer
again after a separately authorized release. Results are also fed to
[#151](https://github.com/tomcorke/mtg-commander-deck-creator/issues/151).

The compact wire browser group passes lazy/shared/fresh/stale/missing/corrupt
checks. The progressive first-batch group fails because its held request reaches
the production 10-second timeout before the mocked batch appears. The same failure
reproduces with the browser script, generator and domain parser restored from
baseline `fb7af48`; no compact response has arrived at that point. Fixture repair is
tracked in [#204](https://github.com/tomcorke/mtg-commander-deck-creator/issues/204).

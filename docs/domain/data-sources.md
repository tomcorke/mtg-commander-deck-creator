# Card data integration

Read the maintained [Scryfall and EDHREC reference](../../../mtg-knowledge-base/knowledge/topics/providers/card-data.md) for provider field meanings, contracts, dated observations, and evidence limits. Keep reusable provider findings in that knowledge base, checked out beside this repository.

This note retains app-specific integration decisions; they are not provider guarantees.

## Normalization and saved snapshots

New normalized cards retain `oracle_id` as `oracleId`, along with Commander legality, Game Changer membership, and whether mana value is known. Construction checks compare Oracle identities when both records have them; legacy snapshots fall back to names until refreshed. Saved-deck and queue refresh on load is implemented under B12 in [COMPLETED.md](../../COMPLETED.md); failed or oversized refreshes retain cards with unverified-data warnings.

Relevant code: `src/domain/card-model.ts`, `src/domain/printing.ts`, and `src/adapters/scryfall.ts`.

### Card input audit (#586)

The live adapter validates and normalises named cards, random cards, identifier collection
results, printing pages, discovery search pages and selected-set collection pages before
returning cards or caching them. The normaliser fills a missing root `type_line` from distinct
face type lines in face order. Conversion uses the same fallback for older unchecked inputs.
It preserves supplied root fields and printing metadata; it does not infer missing Oracle
identity or mana value from a face.

Malformed list entries, envelopes and individual named/random cards fail the request.
Identifier collections retain their partial-result policy: malformed entries are omitted
and unresolved identifiers are reported as not found. Printing progress callbacks receive
validated cards too. The low-level `fetchScryfallCollection` returns a raw HTTP response;
its card consumer, `resolveScryfallIdentifiers`, performs validation.

The other card ingress paths already require `isScryfallCard`: the local card-index schema,
build-time index generation, builder-fetch snapshots and deckbuild contracts/provider data.
Those paths reject raw face-only records rather than passing a missing type to consumers.
Session-cache casts read records validated by the live adapter; `AppView`'s manual-card cast
reads that adapter's builder state.

## Foil treatments

The app treats a foil tag in Scryfall `promo_types` as applying only to the `foil` finish. This is an app convention because Scryfall does not say which finish a tag applies to. Treatment names and descriptions follow [mtg.wiki: Foil](https://mtg.wiki/page/Foil).

## Pacing and caching

App pacing and per-client session caching live in `src/adapters/scryfall.ts`. Their local settings are not Scryfall's provider limits or recommended freshness interval. See [recommendation design](../recommendation-design.md) for session-cache behavior.

Pacing and cache settings in `src/adapters/edhrec.ts` are local safeguards, not an EDHREC service contract.

## Commander Spellbook

Deck review's Known combos section uses a build-time copy of Commander Spellbook's bulk export, because Spellbook's live API accepts browser requests only from its own site. See [combo data](combo-data.md) for access, filters, matching and limits.

## EDHREC adaptation

The app consumes `https://json.edhrec.com/pages/{kind}/{slug}.json` through `src/adapters/edhrec.ts`. Successful access is not a stability guarantee or a published rate allowance.

Lists overlap, and first-list deduplication affects the app's explanation. `tag_counts` are EDHREC classifications, not official mechanics or this app's theme tags.

The adapter currently retains `num_decks`, `synergy`, and `lift`, not the `potential_decks` denominator. App sample-size and association cutoffs are [heuristics](heuristics.md), not provider guarantees.

## Live EDHREC recordings

Synthetic EDHREC is the default for development, tests and rendered reviews. Live recording is opt-in, under the policy [decided in #309](https://github.com/tomcorke/mtg-commander-deck-creator/issues/309#issuecomment-6881275269) on 2026-11-14. Production app EDHREC use is unchanged.

### Terms status

EDHREC's [Terms of Use](https://edhrec.com/terms) (effective 2024-08-06, checked 2026-11-14) license "personal, noncommercial use". They prohibit automated scripts that send requests to the site, and copying or downloading any part of it. Live recording knowingly does not comply with those terms. The owner accepts the risk, mainly an IP block or a takedown request, and is not seeking permission. robots.txt does not override the terms. EDHREC has no public API.

### Scope

- Only `https://json.edhrec.com/pages/{commanders|cards}/{slug}.json` GETs, made through the app's adapters.
- Only on demand for an investigation. Never scheduled. No crawling, sitemap or identity-list sweeps.
- Agents may record, or make a one-off research fetch, when their issue needs it. They stay within the cap and log every run.

### Opt-in

| Surface                                                                                               | Opt-in                   | Without it                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| `pnpm dev:record`                                                                                     | `DEV_REPLAY_EDHREC=live` | Serves the synthetic fixture                                 |
| `scripts/deckbuild/recommend.ts` `record` or `extend`; `scripts/deckbuild/prepare-provider.ts record` | `--live-edhrec`          | The first EDHREC request stops the run: `Live EDHREC is off` |
| `pnpm dev:replay`, `pnpm check:dev-replay`, tests, rendered reviews                                   | None                     | Always synthetic; never fetch EDHREC                         |

```powershell
$env:DEV_REPLAY_EDHREC = 'live'; pnpm dev:record; Remove-Item Env:DEV_REPLAY_EDHREC
node --experimental-strip-types scripts/deckbuild/recommend.ts record --live-edhrec <store-dir> inputs.json commands.jsonl
```

`DEV_REPLAY_EDHREC` accepts only `synthetic` or `live`. `check:dev-replay` ignores it. The supervisor (`supervise.ts`) never passes `--live-edhrec`, so EDHREC work stops a supervised run.

`evaluate:local-retrieval --record` and `audit:recommendations` require `--live-edhrec` before any network work and route EDHREC through the same run guard. Evaluation replay remains offline. `scripts/measure-first-batch.ts` uses only synthetic responses (including EDHREC), with no live mode or network fallback.

### Rate

`scripts/live-edhrec.ts` enforces these limits for each run, meaning one `dev:record` server or one CLI invocation:

- Requests are serial and at least 1 s apart.
- Retry-After is honoured.
- Requests carry a descriptive User-Agent and refuse redirects.
- A run makes at most 50 EDHREC page requests. `dev:record` cache hits do not count.
- The run stops at the first 403, 429 or 5xx response, or at the cap. A stopped run refuses every later EDHREC request.
- A Vite restart of `dev:record` (the `r` shortcut or a config change) starts a new run with its own log row. Never restart to get past a stop.

There is no daily ledger. A one-off research fetch made without these tools follows the same limits by hand.

### Storage

Live responses stay in the machine-local cache until someone deletes them by hand. Nothing refreshes or expires them.

- `dev:record` writes them to its replay cache, `commander-creator/dev-replay-v1` under `LOCALAPPDATA`, `XDG_CACHE_HOME` or `~/.cache`. In live mode it refuses a `DEV_REPLAY_CACHE_DIR` inside the checkout.
- The deckbuild CLI writes them to its store directory, which must already be outside the checkout.
- To purge, delete that directory.

Never commit a response body. `scripts/edhrec-bodies.test.ts` runs in `pnpm test` and fails when a tracked file contains an EDHREC page body (a quoted `json_dict` key, raw or escaped) or a dev-replay EDHREC entry. A hand-authored fixture passes only when its file contains the phrase `synthetic EDHREC fixture`.

### Run log

Every live run prints one Markdown row: on stderr for the CLI, and on server close, interrupt or stop for `dev:record`.

```text
EDHREC run log: | 2026-11-14 | deckbuild recommend record | 12/50 | completed |
```

Paste the rows into the PR or evidence doc under this header:

| Date (UTC) | Mode | EDHREC pages | Stop reason |
| ---------- | ---- | ------------ | ----------- |

Stop reasons are `completed`, `interrupted`, `error`, `page-cap` and `http-<status>`. Log a one-off manual fetch with mode `manual`.

### Attribution

Committed docs and PRs may quote derived values, such as an inclusion count, a rank or a few card names. Give the source URL and fetch date, and label the value as provider data:

> Provider data: EDHREC, `https://json.edhrec.com/pages/commanders/<slug>.json`, fetched 2026-11-14.

Never commit response bodies or full lists.

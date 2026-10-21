# Card data integration

Read the maintained [Scryfall and EDHREC reference](../../../mtg-knowledge-base/knowledge/topics/providers/card-data.md) for provider field meanings, contracts, dated observations, and evidence limits. Keep reusable provider findings in that knowledge base, checked out beside this repository.

This note retains app-specific integration decisions; they are not provider guarantees.

## Normalization and saved snapshots

New normalized cards retain `oracle_id` as `oracleId`, along with Commander legality, Game Changer membership, and whether mana value is known. Construction checks compare Oracle identities when both records have them; legacy snapshots fall back to names until refreshed. Saved-deck and queue refresh on load is implemented under B12 in [COMPLETED.md](../../COMPLETED.md); failed or oversized refreshes retain cards with unverified-data warnings.

Relevant code: `src/domain/card-model.ts`, `src/domain/printing.ts`, and `src/adapters/scryfall.ts`.

## Foil treatments

The app treats a foil tag in Scryfall `promo_types` as applying only to the `foil` finish. This is an app convention because Scryfall does not say which finish a tag applies to. Treatment names and descriptions follow [mtg.wiki: Foil](https://mtg.wiki/page/Foil).

## Pacing and caching

App pacing and per-client session caching live in `src/adapters/scryfall.ts`. Their local settings are not Scryfall's provider limits or recommended freshness interval. See [recommendation design](../recommendation-design.md) for session-cache behavior.

Pacing and cache settings in `src/adapters/edhrec.ts` are local safeguards, not an EDHREC service contract.

## EDHREC adaptation

The app consumes `https://json.edhrec.com/pages/{kind}/{slug}.json` through `src/adapters/edhrec.ts`. Successful access is not a stability guarantee or a published rate allowance.

Lists overlap, and first-list deduplication affects the app's explanation. `tag_counts` are EDHREC classifications, not official mechanics or this app's theme tags.

The adapter currently retains `num_decks`, `synergy`, and `lift`, not the `potential_decks` denominator. App sample-size and association cutoffs are [heuristics](heuristics.md), not provider guarantees.

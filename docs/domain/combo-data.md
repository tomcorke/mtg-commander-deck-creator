# Combo data

Deck review's **Known combos** section lists combos in the main deck and cards one away from a combo, using [Commander Spellbook](https://commanderspellbook.com/) data (#502). This note covers the app's integration. Reusable provider facts belong in the [MTG knowledge base](../../../mtg-knowledge-base/knowledge/topics/providers/card-data.md); the facts below were checked on 2026-11-13 and are pending a knowledge-base update.

## Kind of claim

Spellbook is **provider data** from a community database (see `CONTEXT.md`). A listed combo is neither a bracket verdict nor proof the deck plays well. Absence means Spellbook lists none, not that none exists. Spellbook's own per-combo bracket tags are not shown, so the app never presents a combo as a bracket assignment.

Bracket wording in the section and in the `twoCardCombos` glossary entry cites [format policy](../../../mtg-knowledge-base/knowledge/topics/commander/format-policy.md): no intentional two-card infinite combos in Brackets 1–2, and in Bracket 3 none that can happen cheaply in about the first six turns.

## Source and access

Checked 2026-11-13:

- Spellbook's [API guide](https://github.com/SpaceCowMedia/commander-spellbook-backend/blob/master/docs/api.md) says not to export the dataset through the HTTP API. It publishes every variant in `https://json.commanderspellbook.com/variants.json.gz` and asks consumers to fetch it on their own schedule. It asks for sparse API use, a named User-Agent, `429` handling, and credit with a link to commanderspellbook.com.
- The live API (`backend.commanderspellbook.com`, including `find-my-combos`) returns CORS headers only for `commanderspellbook.com` subdomains and `localhost`; a request from this app's production origin gets none. The bulk files on `json.commanderspellbook.com` return `Access-Control-Allow-Origin: *`.
- The export is about 32 MB gzipped and about 735 MB of JSON. It is served with `Content-Encoding: gzip`.
- The site and backend code are MIT-licensed. No separate data licence or terms page was found; the site describes itself as unofficial Fan Content under Wizards' Fan Content Policy.

So the app stays client-only by shipping a compacted copy, like the [local card index](local-card-index.md), and credits Spellbook with links in the section and on every combo.

## Generate

```bash
pnpm build:combo-index
```

`pnpm build` runs it after the card index. `scripts/build-combo-index.ts` downloads the gzipped export (cached for a day under `LOCALAPPDATA/commander-creator/combo-index`, or `XDG_CACHE_HOME`/`~/.cache`), streams it, and writes the ignored `public/combo-index.json`. If the download or validation fails it reuses the previous validated artifact; with none, the build fails rather than ship an empty index. Generated data is never committed.

The index keeps a combo when Spellbook marks it public (`OK` or `E`), Commander-legal and not a spoiler, and it names every piece as one copy of a specific card. It drops combos that need "any card of a kind" (Spellbook templates), because the client cannot tell which deck cards satisfy a template. Results drop Spellbook's hidden utility features and list standalone results first. Each card keeps its name, Oracle ID and Scryfall image key.

Measured on 2026-11-13 from the 2026-11-13T14:13 export: 113,628 combos over 7,394 cards; 8,055,397 bytes raw and 1,773,877 bytes gzipped. Parsing and matching a 78-card list took about 63 ms and 17 ms in Node.

## Matching

`findDeckCombos` (`src/domain/combo-index.ts`) applies the find-my-combos rules a client can check, on the main deck only (sideboard excluded). Cards match by Oracle ID, then by name for legacy saved cards.

- **In this deck:** every piece is present, and any piece Spellbook says must be the commander is a commander.
- **One card away:** exactly one piece is missing, it is not one that must be the commander, and the combo's colour identity fits the commander's. Results are grouped by the missing card, most combos first.
- Combos that need a different commander are skipped.

On the Meren audit list from `docs/agents/design-conventions.md`, these rules returned the same included combo and the same 24 one-away combos as Spellbook's `find-my-combos` on 2026-11-13.

## Power

Power changes how the section frames combo pieces. It is an app setting, not a bracket:

| Power    | Included combos                              | Cards one away                                                      |
| -------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Core     | Amber status; a note quotes bracket guidance | "Cards that would add a combo": add one only on purpose             |
| Upgraded | Neutral status; the same bracket note        | "One card away"                                                     |
| High     | Success status                               | "Add one card to complete a combo": listed as additions to consider |

Recommendations do not use combo data yet. Boosting combo pieces in High power and warning on offers in Core remain open in #502.

## Play experience signals

**Two-card combos** counts included combos of exactly two cards. Spellbook lists finite combos too, so the count is a prompt for table talk, not the bracket barometer itself. **Win-the-game text** reuses the `finisher` clue in [heuristics](heuristics.md): printed text that says you win or an opponent loses.

## Proof

`pnpm test` covers the stream splitter, filters, wire validation and matching rules. `pnpm check:deck-combos:browser` serves a synthetic index and checks each Power framing, details for a missing card, the deck-list filter, the unavailable state and the 390px layout; `DECK_COMBOS_SCREENSHOTS=<dir>` saves light, dark and narrow evidence. The card-reference and contrast gates also open the section with that fixture. Browser gates otherwise answer `/combo-index.json` with 404, so a locally generated index never mixes into fixture runs.

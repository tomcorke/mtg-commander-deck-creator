# Combo data

Deck review's **Known combos** section lists combos in the main deck and cards one away from a combo, using [Commander Spellbook](https://commanderspellbook.com/) data (#502). Recommendations use the same data: offers that complete a combo carry a note, and High power ranks them higher. This note covers the app's integration. Reusable provider facts (access, the bulk export, statuses and tags, licence) live in the knowledge base's [Commander Spellbook combo data](../../../mtg-knowledge-base/knowledge/topics/providers/combo-data.md) topic, reviewed 2026-11-13.

## Kind of claim

Spellbook is **provider data** from a community database (see `CONTEXT.md`). A listed combo is neither a bracket verdict nor proof the deck plays well. Absence means Spellbook lists none, not that none exists. Spellbook's per-combo bracket tags (`bracketTag`) are Spellbook's own estimates, not Wizards' Commander Brackets, even where the names match. The index drops them and the app does not show them, so it never presents a combo as a bracket assignment. Any future use must label them as Spellbook's estimates.

Bracket wording in the section and in the `twoCardCombos` glossary entry cites [format policy](../../../mtg-knowledge-base/knowledge/topics/commander/format-policy.md): no intentional two-card infinite combos in Brackets 1–2, and in Bracket 3 none that can happen cheaply in about the first six turns.

## Source and access

Checked 2026-11-13:

- Spellbook's [API guide](https://github.com/SpaceCowMedia/commander-spellbook-backend/blob/master/docs/api.md) says not to export the dataset through the HTTP API. It publishes every variant in `https://json.commanderspellbook.com/variants.json.gz` and asks consumers to fetch it on their own schedule. It asks for sparse API use, a named User-Agent, `429` handling, and credit with a link to commanderspellbook.com.
- The live API (`backend.commanderspellbook.com`, including `find-my-combos`) returns CORS headers only for `commanderspellbook.com` subdomains and `localhost`; a request from this app's production origin gets none. The bulk files on `json.commanderspellbook.com` return `Access-Control-Allow-Origin: *`.
- The export is about 32 MB gzipped and about 735 MB of JSON. It is served with `Content-Encoding: gzip`.
- The site and backend code are MIT-licensed. No separate data licence or terms page was found, so reuse terms for the dataset remain unresolved (a knowledge-base open question). The site describes itself as unofficial Fan Content under Wizards' Fan Content Policy.

So the app stays client-only by shipping a compacted copy, like the [local card index](local-card-index.md), and credits Spellbook with links in the section, on every combo and on every combo offer note.

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

Power changes how Deck review and recommendations treat combo pieces. It is an app setting, not a bracket:

| Power    | Included combos                              | Cards one away                                                      |
| -------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Core     | Amber status; a note quotes bracket guidance | "Cards that would add a combo": add one only on purpose             |
| Upgraded | Neutral status; the same bracket note        | "One card away"                                                     |
| High     | Success status                               | "Add one card to complete a combo": listed as additions to consider |

An offer that would complete a combo carries a **Completes a combo** note at every Power, styled like the Included combos status:

- **Core:** amber; add it only on purpose, and tell your table. Ranking is unchanged.
- **Upgraded:** neutral; worth mentioning to your table. Ranking is unchanged.
- **High:** success; a **Combo completion** score of 7, or 10 for two or more combos, ranks it higher.

## Recommendations

Ranking runs in the builder reducer, which must replay the same actions to the same queue, so it never reads the lazily loaded index. Builder state instead holds `comboLinks`: up to 300 combos (fewest cards, then most popular) whose pieces are all among the main deck, queue, Later cards and buffered local candidates, with any must-be-commander piece a commander (`reachableComboLinks`). Links use the app's card names, matched by Oracle ID then name as above.

- **Pool load:** at High power, `start` loads the index alongside the pool and waits up to 2 seconds for it once the pool is ready, so the first batch can rank with links. Slower or failed loads rank without them. Other Powers do not wait; their notes appear once the effect stores links.
- **Afterwards:** `useComboLinksEffect` recomputes links when the set of deck and pool card names, or the commanders, changes, and stores them with a `data` action only when they differ. Storing links never re-ranks, so the visible batch never shuffles; the next ranking (Next recommendations, a settings commit) uses them.
- **Scoring:** `buildRecommendationContext` counts, for each card, the links it alone would complete with the current main deck and commanders (`comboCompletions`). Deck doctor's replacement scores share that context, so High power favours combo-completing replacements too. Only High power scores them: 4 + 3 per combo, capped at 10, shown as **Combo completion** in "Why this card" at High only. Each ranking re-counts as the deck grows.
- **Notes:** `ComboOfferNote` names the deck pieces of the first combo with card references and links it on Spellbook.

Limits: the 300-link cap is chosen without regard to the deck, so with a large pool, short pool-only combos can crowd out a longer combo the deck is one card from completing. The boost counts combos, not their results, so a loop that does not win counts the same as one that does. Links are not saved with a deck; they return once combo data loads after a restore. The deckbuild CLI has no combo data, so its rankings never include the combo factor.

## Play experience signals

**Two-card combos** counts included combos of exactly two cards. Spellbook lists finite combos too, so the count is a prompt for table talk, not the bracket barometer itself. **Win-the-game text** reuses the `finisher` clue in [heuristics](heuristics.md): printed text that says you win or an opponent loses.

## Proof

`pnpm test` covers the stream splitter, filters, wire validation, matching rules, combo links and completions, the High-only score, and reducer replay with stored links. `pnpm check:deck-combos:browser` serves a synthetic index and checks each Power framing, details for a missing card, the deck-list filter, the unavailable state and the 390px layout; `DECK_COMBOS_SCREENSHOTS=<dir>` saves light, dark and narrow evidence. `pnpm check:combo-offers:browser` checks the offer note at each Power, its card reference and Spellbook link, the High score row, that High ranks a combo-completing card first in the next batch while Core does not, and no note without combo data; `COMBO_OFFERS_SCREENSHOTS=<dir>` saves evidence. The card-reference and contrast gates open the section, and an offer note from a fixture that adds one offer combo. Browser gates otherwise answer `/combo-index.json` with 404, so a locally generated index never mixes into fixture runs.

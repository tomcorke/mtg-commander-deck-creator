# Card data sources

Checked 2026-10-03. Scryfall supplies card and printing data; EDHREC supplies observed deck-building statistics. Neither provider replaces the [Commander rules](commander-rules.md) or [format policy](format-policy.md). Missing metadata is unknown, not evidence that a card is colourless, legal, or outside the Game Changers list.

## Scryfall: card versus printing

The [card object contract](https://scryfall.com/docs/api/cards) distinguishes gameplay fields from printing fields.

- **`oracle_id`** identifies the Oracle gameplay identity across reprints. Use it to distinguish cards from their editions; display names, translated names, flavour names, and illustrations are not reliable gameplay identifiers. Scryfall can canonicalize interchangeable names: [the printing originally named Rick, Steadfast Leader](https://api.scryfall.com/cards/sld/143) now returns Greymond, Avacyn's Stalwart with the same Oracle identity as its Magic-world version.
- **`id`** identifies a Scryfall printing object, not an individual owned copy. Set, string-valued `collector_number`, and language describe the edition. A printing object can support several finishes; finish is a separate selection.
- **Exception:** `reversible_card` has no root `oracle_id`; each face has its own. These are unrelated cards printed on opposite sides, not one transforming card. See [layouts](https://scryfall.com/docs/api/layouts).

Oracle identity helps with singleton checks; it does not encode basic-land or allowed-copy exceptions. New normalized cards retain `oracle_id` as `oracleId`, along with Commander legality, Game Changer membership, and whether mana value is known. Construction checks compare Oracle identities when both records have them; legacy snapshots fall back to names until refreshed. Saved-deck and queue refresh on load remains open under B12 in `TODO.md`. Relevant code: `src/domain/card-model.ts`, `src/domain/printing.ts`, and `src/adapters/scryfall.ts`.

## Scryfall fields we use

Definitions come from [Card Objects](https://scryfall.com/docs/api/cards).

| Field                     | Meaning and limits                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color_identity`          | The card's Commander colour identity, including applicable faces, indicators, and characteristic-defining abilities, but excluding reminder text. It is not `colors`, mana production, or castability. A chosen-colour commander still needs the player's pregame choice; an empty array cannot express that choice.                        |
| `legalities.commander`    | Format inclusion status, not commander designation or whole-deck legality. The API's legality values are `legal`, `not_legal`, `restricted`, and `banned`; Commander does not normally use `restricted`. Identity, quantities, pairing, and companion conditions are separate. Lutri's companion-only ban is not expressible by this field. |
| `game_changer`            | Nullable boolean reflecting the official Game Changers list. `true` means listed; missing/null is not `false`. It says nothing about a deck's Game Changer count or bracket intent.                                                                                                                                                         |
| `cmc`                     | Decimal mana value, despite the historical field name. It is not the amount paid to cast a spell. Use the rules for split cards, DFC faces, X, alternative costs, and cost reductions; do not round the provider value when storing it.                                                                                                     |
| `produced_mana`           | Optional potential mana types, including colourless `C`, that a card could produce. It does not describe amount, timing, activation costs, conditions, or currently available mana. Mana production does not set colour identity or prove ramp.                                                                                             |
| `card_faces`, `layout`    | Layout-dependent gameplay regions. Root mana cost, Oracle text, colours, power/toughness, and images may move to faces. Multiple faces do not necessarily mean a separate reverse-side image.                                                                                                                                               |
| `released_at`             | Release date of this printing, in `YYYY-MM-DD` form. A future reprint can coexist with released editions of the same card. Release date is not format legality, preview date, or the date of the card's first-ever printing.                                                                                                                |
| `finishes`                | Available `nonfoil`, `foil`, and/or `etched` finishes for the printing. A finish is not a different gameplay card, and available finishes do not guarantee separate images.                                                                                                                                                                 |
| `prices`, `purchase_uris` | Daily market estimates and marketplace links. Price values are strings or null, with separate currency/finish keys such as `usd`, `usd_foil`, and `usd_etched`. Null is unknown, not zero. A displayed estimate is not a purchase quote or proof of stock.                                                                                  |

## Faces and images

Read [Layouts and Faces](https://scryfall.com/docs/api/layouts) and [Card Imagery](https://scryfall.com/docs/api/images), not just the length of `card_faces`.

Split, flip, Adventure, and prepared-spell regions can share one front image. Actual double-faced layouts can supply `card_faces[].image_uris`; ordinary cards commonly supply root `image_uris`. Meld uses `all_parts` to relate separate cards and their combined result. Reversible cards represent separate gameplay identities. A card's presence in `card_faces` alone proves neither a playable back face nor a back image.

For ordinary DFCs, commander eligibility uses front-face characteristics; colour identity includes the back. An MDFC land face can be played as a land, but a transforming land back cannot simply be chosen as the turn's land play. Root `cmc` and a face's casting option need not describe the same mana demand. Use the supplied image URLs; do not infer face count from image count or commit downloaded art.

## Search predicates are not card fields

The [syntax guide](https://scryfall.com/docs/syntax) defines predicates evaluated by Scryfall's search index.

- **`is:commander`** finds commander-eligible cards; **`legal:commander`** finds cards legal for inclusion. There is no per-card `can_be_commander` boolean. Eligibility alone does not validate a partner pairing or replace legality. Excluding `is:commander` also excludes eligible legends that could be useful in the 99.
- **`id<=...`** filters colour identity; `c:` filters colour. `mana:` and `mv:` query costs and mana value, respectively. These are different properties.
- **`is:gamechanger`** corresponds to current list membership. **`otag:`** searches Scryfall Tagger's functional Oracle tags, not a rules keyword or the app's regex tags. `o:` searches Oracle wording; it does not execute the effect. Tagger classifications can change; see [the tag API](https://scryfall.com/docs/api/tags).
- **`date<=today`**, set, finish, and price predicates constrain printing data. A rolled-up result is still one selected printing, not every edition or every price of that card.

The [search API](https://scryfall.com/docs/api/cards/search) defaults to **`unique=cards`**, collapsing matching prints with the same name and functionality. `unique=art` deduplicates illustrations; `unique=prints` returns editions. Use `prints_search_uri` for a card's printings; art deduplication is not singleton validation.

Search returns a paginated List, up to 175 cards per page. Follow `has_more` and `next_page`; one page is not the full pool. `total_cards` describes the query's result count, not cards already fetched. **`order=random` is undocumented** for this endpoint; it must not be treated as uniform sampling. The separately documented [`/cards/random`](https://scryfall.com/docs/api/cards/random) is not a search ordering mode.

[`/cards/collection`](https://scryfall.com/docs/api/cards/collection) accepts at most 75 identifiers per POST. Name or Oracle-ID lookup chooses an edition; set and collector number specify a printing. Missing identifiers appear in `not_found` and shift positional mapping, so results cannot be matched by array index alone.

## Scryfall pacing and freshness

The [rate-limit contract](https://scryfall.com/docs/api/rate-limits), checked on this date, specifies:

- Search, named, random, and collection: **2 requests/second, 500 ms spacing**.
- Manifest: **10/minute, 6 seconds spacing**. Other API methods: **10/second, 100 ms spacing**.
- HTTP 429 limits access for 30 seconds. Continuing to overload can cause blocking. Honour exposed retry timing and provider cooldowns; immediate retries are not acceptable.
- Cache downloaded data for **at least 24 hours** where practical. Prices update once daily; gameplay data changes less often. Scryfall directs high-volume name, price, and image resolution to [daily bulk data](https://scryfall.com/docs/api/bulk-data).

App pacing and per-client session caching live in `src/adapters/scryfall.ts`. Their local settings are not Scryfall's provider limits or recommended freshness interval. Cached legality, Game Changers, prices, and saved snapshots describe their fetch date, not an immutable fact.

## EDHREC pages and list taxonomy

EDHREC's website JSON is **undocumented and unversioned**. The app consumes `https://json.edhrec.com/pages/{kind}/{slug}.json` through `src/adapters/edhrec.ts`; successful access is not a stability guarantee or a published rate allowance.

- **Commander pages** describe decks led by that commander or pair. Tags, budget, brackets, and date filters can narrow the population. Example: [Brago](https://json.edhrec.com/pages/commanders/brago-king-eternal.json).
- **Card pages** describe co-occurrence around an ordinary card, across eligible commanders. Their commander lists are not additional ordinary-card recommendations. Example: [Hardened Scales](https://json.edhrec.com/pages/cards/hardened-scales.json).

Observed lists live at `container.json_dict.cardlists`, with `tag`, `header`, and `cardviews`. Taxonomy includes `newcards`, `topcards`, `gamechangers`, ordinary type lists, `utilityartifacts`, `utilitylands`, `manaartifacts`, and `lands`; card pages also have `newcommanders` and `topcommanders`. These are truncated website lists, not every eligible card. Lists overlap, and first-list deduplication affects the app's explanation.

**On 2026-10-03 both example pages use `highliftcards`, not the older `highsynergycards`.** A list title is not the definition of its metrics: commander entries can contain both `synergy` and `lift`. Missing or renamed lists and fields are provider drift, not evidence that no relevant cards exist. `tag_counts` are EDHREC classifications, not official mechanics or this app's theme tags.

## EDHREC metrics and evidence limits

The primary references are the [FAQ](https://edhrec.com/faq) and [From Synergy to Lift](https://edhrec.com/articles/from-synergy-to-lift-the-math-behind-edhrecs-new-era).

- **Synergy** is a difference between conditional inclusion and comparison inclusion, not a multiplier. The observed JSON uses fractions: `0.20` is a 20-percentage-point difference, not a 20% relative increase or a probability that two cards interact.
- **Raw lift** compares co-occurrence with independence: `P(A and B) / (P(A) * P(B))`. Independence is 1; above/below 1 means positive/negative association. EDHREC adjusts the populations for eligibility and preview dates. Its displayed **log-lift** uses base 10 and is centred on 0; displayed 1 means raw lift 10. Never compare a raw threshold with displayed log-lift or a synergy percentage.
- **`num_decks`** counts observed decks containing the featured card/commander and the candidate. **`potential_decks`** is the eligible comparison population for that pairing, respecting colour identity, commander, preview dates, and active filters. Inclusion uses the appropriate potential-deck denominator, not a global total or necessarily the page's headline count. The adapter currently retains `num_decks`, `synergy`, and `lift`, not that denominator.

EDHREC says it collects daily from Archidekt, Moxfield, and Scryfall, with website updates usually following within days. Its users are a self-selected sample, not all Commander players, played games, or tournament results. Popularity, budget, precons, uploaded-but-unplayed decks, and EDHREC's own recommendations can affect associations. EDHREC attempts to reject illegal decks, but does not guarantee complete ingestion or rules validation of every returned pairing. Its theme definitions are developer-tuned, not one scientific formula.

**Co-occurrence is not a rules interaction, combo proof, win rate, optimality measure, or bracket verdict.** App sample-size and association cutoffs are [heuristics](heuristics.md), not provider guarantees. Pacing and cache settings in `src/adapters/edhrec.ts` are local safeguards, not an EDHREC service contract.

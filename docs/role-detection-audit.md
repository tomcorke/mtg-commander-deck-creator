# Role detection: six-deck audit

Reviewed 2026-10-25 for #33, against baseline `51148b2`. These are app heuristics, not rules or proof of card quality.

## Sample and evidence

The maintained [fixture](../src/fixtures/real-deck-roles.json) contains six intact published Commander precons: 600 slots, 411 unique deck cards, and seven additional issue-reproduction cards. All 418 unique cards have independently authored roles and mana/draw/interaction/wipe labels, Oracle text, Oracle IDs, source URLs, review notes, and retrieval dates. Repeated basics retain their quantities. No card images are stored.

| Deck                      | Purpose          | Published list data                                                     | Wizards publication                                                                                            |
| ------------------------- | ---------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Power Hungry (C13)        | Sacrifice        | [MTGJSON](https://mtgjson.com/api/v5/decks/PowerHungry_C13.json)        | [Original archive](https://magic.wizards.com/en/content/power-hungry-commander-2013-card-set-archive), now 404 |
| Primal Genesis (C19)      | Tokens/populate  | [MTGJSON](https://mtgjson.com/api/v5/decks/PrimalGenesis_C19.json)      | [2019 lists](https://magic.wizards.com/en/news/feature/decks-commander-2019-edition-2019-08-08)                |
| Mystic Intellect (C19)    | Spells/flashback | [MTGJSON](https://mtgjson.com/api/v5/decks/MysticIntellect_C19.json)    | [2019 lists](https://magic.wizards.com/en/news/feature/decks-commander-2019-edition-2019-08-08)                |
| Nature's Vengeance (C18)  | Lands/ramp       | [MTGJSON](https://mtgjson.com/api/v5/decks/NatureSVengeance_C18.json)   | [2018 lists](https://magic.wizards.com/en/news/feature/commander-2018-edition-decklists-and-tokens-2018-07-27) |
| Plunder the Graves (C15)  | Graveyard        | [MTGJSON](https://mtgjson.com/api/v5/decks/PlunderTheGraves_C15.json)   | [2015 lists](https://magic.wizards.com/en/news/feature/commander-2015-edition-decklists-2015-11-06)            |
| Exquisite Invention (C18) | Artifacts        | [MTGJSON](https://mtgjson.com/api/v5/decks/ExquisiteInvention_C18.json) | [2018 lists](https://magic.wizards.com/en/news/feature/commander-2018-edition-decklists-and-tokens-2018-07-27) |

MTGJSON supplied quantities; [Scryfall collection](https://scryfall.com/docs/api/cards/collection) supplied gameplay inputs. Returned names, not response positions, resolved the cards. The Wizards articles linked for five decks establish provenance, not a second card-by-card extraction. C13's unavailable original publication makes its source chain weaker.

An independent research agent read each Oracle input and wrote labels without running the detector or copying its output. The implementation review then compared those labels with the app. This is AI-assisted manual review, not human-player consensus. Historical precons cover six useful strategy families, not the current metagame or observed games. Historical inclusion does not establish current legality.

## Go/no-go decisions

**Go:** narrow shared rules correct demonstrated wording families: graveyard returns and own-board effects are not opposing wipes; selected multi-target/damage effects are removal; variable creature damage can be a wipe; keyword cycling is a cantrip, while mentions of cycling are not; sacrifice-self draw is one-shot; four-card draw and cross-sentence draw/discard are recognized. Trigger conditions no longer conceal a separate opposing effect merely because the condition mentions your own creatures.

**Go:** 36 additional reviewed Oracle-ID overrides handle isolated modal, cross-sentence, controller-relative and indirect effects without building an Oracle parser. Each override has a card-name comment and a sourced fixture. Ordinary land mana still receives no ramp credit; reviewed two-land searches, Temple of the False God's two-mana output, and Opal Palace's fixing are separate cases. Conditions and affordability remain unsolved.

**No-go:** do not widen wipe credit to limited edicts. Barter in Blood, Butcher of Malakir, Shattergang Brothers, Tectonic Hellion and Tribute to the Wild can remove chosen permanents without clearing a board. Preserve the existing narrower convention and withhold wipe/removal credit rather than claiming a wipe delta. Their independent proposed labels remain in `independent_expected`; `app_review` explains the accepted narrower labels.

**No-go:** do not count Fountainport's expensive land-to-Treasure conversion as ramp. Keep its true land and repeatable-draw roles. Its independent proposed ramp label and the policy disagreement also remain in the fixture. No global land-to-ramp expansion was made.

`null` and `unknown` both withhold role credit. Tests require exact known feature labels and exact role sets, but allow either cautious no-credit state where the review has no in-scope feature. A missing match is not proof that a card has no useful function. Wipes can have an opposing interaction feature while still suppressing the targeted-removal role.

## Original reports checked

- [Rally the Ancestors](https://scryfall.com/search?q=%21%22Rally+the+Ancestors%22) returns your graveyard creatures and later exiles those creatures. It is not a wipe. Its EDHREC instant category now says **Instant support**, not **Interaction**.
- [Sun Titan](https://scryfall.com/search?q=%21%22Sun+Titan%22) is not targeted removal. The baseline already handled its graveyard return correctly; the new fixture prevents regression. A tested Sun Titan-to-Rally swap invents neither a removal nor a wipe delta.
- [Fountainport](https://scryfall.com/search?q=%21%22Fountainport%22) really draws cards. [Carrier Thrall](https://scryfall.com/search?q=%21%22Carrier+Thrall%22) really supplies burst mana through its Scion. A **Land or mana** source category is not a claim that Carrier Thrall is a land. Neither valid function was removed to match the report's premise.
- [Liesa, Shroud of Dusk](https://scryfall.com/search?q=%21%22Liesa%2C+Shroud+of+Dusk%22) has a spell-cast life-loss trigger, not a death payoff. [Liesa, Forgotten Archangel](https://scryfall.com/search?q=%21%22Liesa%2C+Forgotten+Archangel%22) is the death/hand-recursion card. Keep their identities separate. Forgotten Archangel already receives sacrifice/death tags and stays linked in a sacrifice deck; no fake death tag was added to Shroud.
- Requiem Angel, Butcher of Malakir and Sun Titan no longer get a curve-only casting warning merely for costing six or seven. The app's conservative high-cost heuristic now requires **at least eight mana and three above the spell average**. Colour-source warnings remain independent, and supported `{2/colour}` alternatives retain their discount. This threshold is not a universal Commander casting rule.

Independent change review added three live-Oracle regressions outside the six-deck sample: [Mutilate](https://api.scryfall.com/cards/named?exact=Mutilate) must retain wipe credit when its magnitude mentions your Swamps; [Living Death](https://api.scryfall.com/cards/named?exact=Living%20Death) must retain its battlefield sacrifice despite the adjacent graveyard exchange; [Wheel and Deal](https://api.scryfall.com/cards/named?exact=Wheel%20and%20Deal) grants opponents seven cards but gives you only one. The first uses a tighter own-board exclusion; the latter two use reviewed overrides. Opponent-only four-through-seven-card draw is also excluded consistently. These regressions are in `src/card-features.test.ts` and do not inflate the 418-card independent sample.

## Comparison

Against the accepted conservative labels, baseline `51148b2` disagreed on **55 of 418 role sets** and **102 feature sets**. Both are now **0**. Unknown/null equivalence applies only to no-credit states, not to positive labels.

Quantity-weighted counts include commanders. Each cell is **baseline → reviewed/current**, not a suggested target.

| Deck                | Lands   | Ramp    | Draw    | Targeted removal | Wipes |
| ------------------- | ------- | ------- | ------- | ---------------- | ----- |
| Power Hungry        | 39 → 39 | 5 → 6   | 4 → 3   | 6 → 15           | 3 → 5 |
| Primal Genesis      | 39 → 39 | 5 → 7   | 12 → 12 | 6 → 8            | 1 → 2 |
| Mystic Intellect    | 40 → 40 | 7 → 10  | 9 → 9   | 5 → 7            | 2 → 4 |
| Nature's Vengeance  | 43 → 43 | 10 → 14 | 8 → 10  | 7 → 8            | 2 → 5 |
| Plunder the Graves  | 38 → 38 | 7 → 7   | 7 → 9   | 9 → 10           | 2 → 2 |
| Exquisite Invention | 38 → 38 | 10 → 13 | 12 → 13 | 4 → 9            | 2 → 3 |

Run `node --experimental-strip-types --test src/real-deck-roles.test.ts` for 418 per-card checks, six deck-total checks, and three integration checks covering Doctor links/curve, provider labels and swap deltas. Boundary tests in `src/card-features.test.ts` check negative and ambiguous wording as well as positive matches.

No saved targets, schema, ranking weights or UI layouts changed. Costs, timing, resources, most implicit engines, and unreviewed Oracle wording remain heuristic limits; package-aware ranking remains #105. Two existing browser gates fail identically on the baseline and this branch; repair is tracked in #146. The screenshot review uses a separate synthetic Teysa reproduction state, not one of the six published decklists.

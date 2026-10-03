# Domain context

This app helps a player build a 100-card Magic: The Gathering Commander deck. This file defines the app's domain terms and points to the reference material agents must use instead of remembered MTG knowledge.

## Use the references, not memory

Commander rules and policy changed often in 2024–2026. Model training data is likely to be out of date: for example, on legendary Vehicles as commanders, partner variants, tutors in brackets, the Game Changers list, Lutri's companion ban, and hybrid colour identity. Before writing code or docs that depend on an MTG fact, check the matching reference:

| Question                                                                                                        | Read                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does the game allow? Deck size, singleton, colour identity, partners, companions, mana value, mana symbols | [docs/domain/commander-rules.md](docs/domain/commander-rules.md)                                                                                                                             |
| Can this card be a commander?                                                                                   | [docs/commander-eligibility.md](docs/commander-eligibility.md)                                                                                                                               |
| What is banned? What do brackets and Game Changers mean?                                                        | [docs/domain/format-policy.md](docs/domain/format-policy.md)                                                                                                                                 |
| What do Scryfall and EDHREC fields mean, and how far can they be trusted?                                       | [docs/domain/data-sources.md](docs/domain/data-sources.md)                                                                                                                                   |
| Which app numbers and classifiers are heuristics, and what are their limits?                                    | [docs/domain/heuristics.md](docs/domain/heuristics.md)                                                                                                                                       |
| Where does the code encode an MTG assumption, and is it right?                                                  | [docs/domain/assumption-audit-2026-10-03.md](docs/domain/assumption-audit-2026-10-03.md), a dated snapshot whose line numbers drift; its fixes are tracked in `TODO.md` as B12, B13, and A15 |

If a reference does not answer the question, check the primary source it cites, then add the answer to the reference with the date checked.

## Kinds of domain claim

Label every MTG claim in code comments, docs, and UI copy with how strong it is. Never present a weaker kind as a stronger one.

1. **Rule:** the Comprehensive Rules. Changes only with a new rules file.
2. **Policy:** Wizards' ban list, Commander Brackets, and the Game Changers list. Changes at announcements, so record the date checked.
3. **Provider data:** what Scryfall or EDHREC returns. Scryfall reflects rules and policy closely; EDHREC is undocumented statistics from user-submitted decks.
4. **Heuristic:** a community convention or app estimate, such as 35 lands or a regex that detects ramp. Useful, but never a rule, a bracket verdict, or proof of card quality.

Prefer reading rules and policy from Scryfall fields at runtime over hard-coding lists. A hard-coded list needs a source and a check date beside it.

## Glossary

**Commander** — the legendary card designated to lead the deck. It starts in the command zone and counts towards the 100 cards. A deck has one commander, or two through a partner ability.

**Partner pair** — two commanders allowed by one shared partner ability. Their colour identities combine. The deck is still 100 cards, so 98 remain.

**Colour identity** — the colours a card requires a deck's commander to have. It differs from a card's colour. Read it from Scryfall `color_identity`.

**Main deck** — the 100 cards that would be played, including commanders. "Complete" means exactly 100. A complete count does not prove the deck is legal.

**Library** — the main deck minus commanders: 99 cards, or 98 with a partner pair, in a complete deck before the opening draw. A partial deck in the builder has fewer. Draw and land simulations sample from it.

**Sideboard** — an app holding area for cards the player may want later. Official Commander has no sideboard (CR 903.5e). Sideboard cards never count towards size, legality, analysis, or simulation.

**Companion** — a card outside the 100 whose condition the starting deck meets. The app does not support companions yet.

**Card and printing** — a card is the gameplay object, identified by Scryfall `oracle_id`. A printing is one physical version, identified by set and collector number. Art, finish, and price belong to printings and have no gameplay effect. Singleton applies to cards.

**Deck goal** — Balanced, Thematic, Fun & varied, or Competitive. It changes recommendation scoring and batch composition, never construction rules.

**Power target** — Core, Upgraded, or High. It maps loosely to Brackets 2, 3, and 4 and sets default exclusions. It does not verify a bracket.

**Exclusions** — optional filters for Game Changers, tutors, extra turns, unreleased cards, and fast mana. They are player preferences that approximate bracket guidance. Brackets limit Game Changers and extra turns; tutors are no longer a bracket restriction.

**Bracket** — one of Wizards' five Commander Brackets, describing intended game experience. The app may say which bracket guidelines a deck appears to meet. It must not assign a bracket.

**Game Changer** — a card on Wizards' Game Changers list. Read it from Scryfall `game_changer`.

**Role** — a deck function detected by heuristics: land, ramp, card draw, targeted removal, or board wipe. **Role targets** are the player's editable counts for each role.

**Theme and sub-theme** — the declared deck strategy and up to two narrower focuses. **Tags** are regex-detected card traits used to match them.

**Recommendation batch** — a group of up to four candidate cards. The player chooses **Add**, **Later**, **Ignore**, or **More like this** for each.

**Signature seed** — a selected main-deck card whose engine is used to find more candidates from EDHREC. Its results show `Seen with <seed>`.

**Deck review** and **Deck Doctor** — analysis of the current deck, and an optional flow that proposes equal-count swaps for the player to approve.

**Collection** — set codes the player prefers or restricts to. It is not an inventory of owned cards.

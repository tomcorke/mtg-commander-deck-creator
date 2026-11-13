# Domain context

This app helps a player build a 100-card Magic: The Gathering Commander deck. This file defines the app's domain terms and points to the reference material agents must use instead of remembered MTG knowledge.

Shared MTG references now live in the sibling [MTG knowledge base](../mtg-knowledge-base/README.md) at `E:/working/mtg-knowledge-base`. Read its `AGENTS.md` before using or updating those notes. Keep that checkout beside this repository; worktrees use the same main knowledge-base checkout. App terminology, heuristic implementations, and code audits remain here. Migration preserved the original check dates; it did not revalidate sources.

## Use the references, not memory

Commander rules and policy changed often in 2024–2026. Model training data is likely to be out of date: for example, on legendary Vehicles as commanders, partner variants, tutors in brackets, the Game Changers list, Lutri's companion ban, and hybrid colour identity. Before writing code or docs that depend on an MTG fact, check the matching reference:

| Question                                                                                                        | Read                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What does the game allow? Deck size, singleton, colour identity, partners, companions, mana value, mana symbols | [Commander rules](../mtg-knowledge-base/knowledge/topics/commander/rules.md)                                                                                                                                      |
| Can this card be a commander?                                                                                   | [Commander eligibility](../mtg-knowledge-base/knowledge/topics/commander/eligibility.md)                                                                                                                          |
| What is banned? What do brackets and Game Changers mean?                                                        | [Format policy](../mtg-knowledge-base/knowledge/topics/commander/format-policy.md)                                                                                                                                |
| What do Scryfall and EDHREC fields mean, and how far can they be trusted?                                       | [Card data sources](../mtg-knowledge-base/knowledge/topics/providers/card-data.md); [app integration](docs/domain/data-sources.md)                                                                                |
| Where do known combos come from, and what do they prove?                                                        | [Combo data](docs/domain/combo-data.md)                                                                                                                                                                           |
| Which app numbers and classifiers are heuristics, and what are their limits?                                    | [docs/domain/heuristics.md](docs/domain/heuristics.md)                                                                                                                                                            |
| Where does the code encode an MTG assumption, and is it right?                                                  | [docs/domain/assumption-audit-2026-10-03.md](docs/domain/assumption-audit-2026-10-03.md), a dated snapshot whose line numbers drift; its fixes were tracked as B12, B13 (see `COMPLETED.md`), and A15 (issue #12) |

If a reference does not answer the question, check the primary source it cites, then add the answer to the matching knowledge-base topic with the date checked. App-only findings stay in this repository.

## Kinds of domain claim

Label every MTG claim in code comments, docs, and UI copy with how strong it is. Never present a weaker kind as a stronger one.

1. **Rule:** the Comprehensive Rules. Changes only with a new rules file.
2. **Policy:** Wizards' ban list, Commander Brackets, and the Game Changers list. Changes at announcements, so record the date checked.
3. **Provider data:** what Scryfall or EDHREC returns. Scryfall reflects rules and policy closely; EDHREC is undocumented statistics from user-submitted decks.
4. **Heuristic:** a community convention or app estimate, such as 35 lands or a regex that detects ramp. Useful, but never a rule, a bracket verdict, or proof of card quality.

Prefer reading rules and policy from Scryfall fields at runtime over hard-coding lists. A hard-coded list needs a source and a check date beside it.

## Glossary

Player-facing names and definitions for these terms live in `src/domain/glossary.ts`. Change UI copy there so role labels, settings help, the intro guide and Commander basics stay in step.

**Commander** — the legendary card designated to lead the deck. It starts in the command zone and counts towards the 100 cards. A deck has one commander, or two through a partner ability.

**Partner pair** — two commanders allowed by one shared partner ability. Their colour identities combine. The deck is still 100 cards, so 98 remain.

**Colour identity** — the colours a card requires a deck's commander to have. It differs from a card's colour. Read it from Scryfall `color_identity`.

**Main deck** — the 100 cards that would be played, including commanders. "Complete" means exactly 100. A complete count does not prove the deck is legal.

**Library** — the main deck minus commanders: 99 cards, or 98 with a partner pair, in a complete deck before the opening draw. A partial deck in the builder has fewer. Draw and land simulations sample from it.

**Sideboard** — an app holding area for cards the player may want later. Official Commander has no sideboard (CR 903.5e). Sideboard cards never count towards size, legality, analysis, or simulation.

**Companion** — a card outside the 100 whose condition the starting deck meets. The app does not support companions yet.

**Card and printing** — a card is the gameplay object, identified by Scryfall `oracle_id`. A printing is one physical version, identified by set and collector number. Art, finish, and price belong to printings and have no gameplay effect. Singleton applies to cards.

**Priority** — Theme first, Balanced, Deck needs first, or Surprise me. It changes recommendation ranking and batch composition, never construction rules.

**Power** — Core, Upgraded, or High power. It selects app-specific recommendation filters and pace heuristics. Core excludes a short list of fast-mana cards; Upgraded gently favours lower-cost utility, and High does so more strongly. See [power targets](docs/domain/power-targets.md) for limits and evaluation. It is not a bracket verdict, and Core is not a preconstructed-deck power claim.

**Expected opponents** — opposing strategies the player expects to face: graveyard, artifact, token, combo, big-creature or spellslinger decks. Chosen in Recommendation settings and saved with the deck. Recommendations favour cards whose rules text reads as an **answer** to a selected strategy and label them "Answers … decks"; Deck review counts answers against a heuristic target per strategy: 3 by default, editable there and saved with the deck. Answer detection is a text heuristic, not proof a card stops the strategy.

**Exclusions** — independent recommendation filters for Game Changers, tutors, extra turns, and unreleased cards. Tutor, extra-turn, and release filters are player preferences, not bracket limits. Game Changer counts have official bracket limits; see [format policy](../mtg-knowledge-base/knowledge/topics/commander/format-policy.md). These filters do not verify a bracket.

**Bracket** — one of Wizards' five Commander Brackets, describing intended game experience. The app may say which bracket guidelines a deck appears to meet. It must not assign a bracket.

**Game Changer** — a card on Wizards' Game Changers list. Read it from Scryfall `game_changer`.

**Role** — a deck function detected by heuristics: land, ramp, card draw, targeted removal, or board wipe. **Role targets** are the player's editable counts for each role.

**Theme and extra theme** — up to three declared deck strategies. The first chosen is the **theme**; up to two more are **extra themes**. Start, the builder and Deck review use these names; code calls extra themes sub-themes. A **suggested theme** is one that several recently added cards share; the player chooses **Use** or **Dismiss**. **Tags** are regex-detected card traits used to match them. **Theme cards** are main-deck cards tagged for the theme; the builder tracks them against an editable, heuristic target. In Theme first, an offer that matches no selected theme carries a heuristic **Generic pick** mark.

**Recommendation batch** — a group of up to four candidate cards. The player chooses **Add**, **Later**, **Ignore**, or **More like this** for each. **Undo** reverses the most recent Add, Later or Ignore, even after **Next recommendations**.

**Later & ignored** — the cards the player set aside in earlier batches. **Later** cards return after a few batches; **ignored** cards never return unless restored. From the list the player can add a card, bring a Later card back now, move an ignored card to Later, or un-ignore it.

**Starting deck** — an app-built draft that fills the main deck to 100 from the ranked recommendations, role targets and basic lands. It is a heuristic draft for the player to edit, never a tuned list. **Add all** adds every undecided card in the visible batch. One undo removes either.

**Signature seed** — a selected main-deck card whose engine is used to find more candidates from EDHREC. Its results show `Seen with <seed>`.

**Deck review** and **Deck Doctor** — analysis of the current deck, and an optional flow that proposes equal-count swaps for the player to approve.

**Known combo** — a combo Commander Spellbook lists whose pieces are all in the main deck; a card **one away** would complete one. Provider data from a community database, never a bracket verdict. Power changes how Deck review frames them and how recommendations treat an offer that would complete one: a note at every Power, a ranking boost only at High.

**Set selection** — set codes the player prefers or restricts to, shown as "Sets to build from". It is not an inventory of owned cards. Older code and documents call this "collection".

**Owned cards** — a list of cards the player owns, imported from a text list or a collection CSV and stored only in this browser. Ownership is by card name; each owned copy covers one card of that name in any printing. It belongs to the player, not to a deck.

**Ownership mode** — Ignore owned cards, Prefer owned cards, or Owned cards only. Prefer ranks owned cards higher; Owned only offers nothing else. Export's **Still needed** list holds the main-deck cards, commanders included, that owned cards do not cover.

**Share link** — a link to this app whose `#share=` fragment holds the whole deck: commanders, main deck and sideboard, with each printing and finish. Opening it shows a read-only **shared deck** preview; **Copy to my decks** makes it the current deck after confirming any replacement.

# Commander rules reference

Checked 2026-10-03 against the [Comprehensive Rules effective 2026-09-25](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt). Rule numbers below are from that file. These are hard game rules. They change only when Wizards publishes a new Comprehensive Rules file, usually alongside a set release.

Format policy that changes more often (ban list, brackets, Game Changers) is in [format-policy.md](format-policy.md). Commander eligibility has its own note in [../commander-eligibility.md](../commander-eligibility.md).

## Deck construction (903.5)

- **Size:** exactly 100 cards, including the commander. Minimum and maximum are both 100 (903.5a). With two commanders, the 100 still includes both (702.124b), so 98 cards remain.
- **Singleton:** other than basic lands, every card must have a different English name (903.5b). "Basic" is a supertype (205.4c), so Snow-Covered Plains (`Basic Snow Land — Plains`) and Wastes are exempt. Do not test for the literal text `Basic Land` or a fixed list of five names. Cards with interchangeable names (201.3) count as the same name, so compare Scryfall `oracle_id`, not printing, flavour name, or display name. Cards whose own text allows more copies, such as "A deck can have any number of cards named …", override this through 113.6n. Some cards allow only a fixed number, such as Seven Dwarves (up to seven) and Nazgûl (up to nine).
- **Colour identity:** every colour in a card's colour identity must also be in the commander's colour identity (903.5c). Colourless cards fit every deck.
- **Basic land types:** a card with a basic land type is allowed only if every colour of mana it could produce is in the commander's colour identity (903.5d). This catches nonbasic dual lands whose types imply mana, even when the card has no coloured symbols in its text.
- **No sideboards:** "Commander games do not use sideboards" (903.5e). The app's sideboard is a deck-building holding area, not a game sideboard. It must never count towards the 100 or towards legality checks.

## Colour identity (903.4)

Colour identity is the colours of every mana symbol in the card's mana cost **or rules text**, plus colours from characteristic-defining abilities and colour indicators (903.4).

- Reminder text is ignored (903.4c). Extort reminder text does not add white or black, for example.
- The back face of a double-faced card counts (903.4d), even though a DFC's back face is normally ignored in other zones.
- Alternative characteristics count, such as the Adventure half of an adventurer card (903.4e).
- Hybrid symbols count as **both** colours. A `{W/U}` card has white-blue identity and cannot go in a mono-white deck, even though it is castable with white mana alone.
- Phyrexian mana symbols count as their colour. `{G/P}` is green identity.
- A commander that chooses its colour before the game (903.4b) fixes that choice for deck construction.
- Colour identity is not colour. A land with `{T}: Add {G}` in its text is colourless but has green identity.

In practice, use Scryfall's `color_identity` field. It already applies these rules. Do not recompute identity from `colors` or `mana_cost`. The one gap is a chosen-colour commander such as The Prismatic Piper or Faceless One: Scryfall reports an empty array, but the player's choice sets the real identity (903.4b).

## Commanders (903.3, 702.124)

A commander is a legendary card that is a creature, a Vehicle, or a Spacecraft with a power/toughness box (903.3). Cards that say they "can be your commander" are also eligible (903.3a). Eligibility uses the card's characteristics during deck construction, so abilities that work outside the game count: Grist, the Hunger Tide is a creature outside the battlefield and can be a commander (113.6c). See [../commander-eligibility.md](../commander-eligibility.md) for the app's rule.

A deck may have two commanders only through a **partner ability** (702.124a). The partner abilities are distinct and cannot be mixed (702.124f):

| Ability             | Pairing rule                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partner             | Both cards have plain "Partner" (702.124h).                                                                                                         |
| Partner—[text]      | Both cards have the same "Partner—[text]" ability. Current variants: Character select, Father & son, Friends forever, Survivors (702.124i).         |
| Partner with [name] | Each names the other (702.124j).                                                                                                                    |
| Choose a Background | One commander has "Choose a Background"; the other is a legendary Background enchantment (702.124k). Backgrounds cannot be commanders on their own. |
| Doctor's companion  | One has "Doctor's companion"; the other is a legendary Time Lord Doctor creature with no other creature types (702.124m).                           |

A card with more than one partner ability uses only one of them. No combination ever gives more than two commanders (702.124g). The pair's colour identity is the union of both identities (702.124c). Commander damage and commander tax are tracked per commander (702.124d).

New partner variants arrive with new sets. When Scryfall shows a pairing keyword the code does not recognise, treat the card as a single commander and record the gap. Do not guess pairing rules.

## Companions (702.139)

A companion starts outside the game. It is not one of the 100 cards. In Commander, its deck-building condition is checked against the starting deck **including the commander** (702.139b). It must also fit the commander's colour identity (903.11a). Once per game, during their main phase with an empty stack, a player may pay `{3}` to put it into their hand (702.139a). Conditions that need a larger deck, such as Yorion's, cannot be met because Commander decks are exactly 100 cards. Lutri, the Spellchaser is banned as a companion only; see [format-policy.md](format-policy.md#ban-list).

## Mana symbols (107.4)

- `{W}{U}{B}{R}{G}` are the colours. `{C}` is a cost payable only with colourless mana; it is not a colour and adds nothing to colour identity (107.4c).
- `{S}` must be paid with mana from a snow source (107.4h). Snow is neither a colour nor a mana type.
- Hybrid symbols, including `{2/W}` and `{C/W}`, are coloured symbols (107.4e). Hybrid Phyrexian symbols such as `{W/U/P}` exist.
- In rules text, `{H}` means any Phyrexian symbol (107.4g). `{P}` is now Scryfall's **pawprint** modal-budget symbol, not Phyrexian mana.
- Get symbol images from Scryfall's [`/symbology`](https://api.scryfall.com/symbology) `svg_uri`; do not derive filenames. For example, `{W/U/P}` is `WUP.svg`.

## Mana value (202.3)

- Mana value is the total mana in the mana cost, ignoring colour (202.3).
- `{X}` counts as 0 outside the stack (202.3e).
- Each hybrid symbol counts as its largest component, so `{2/W}` counts 2 (202.3f).
- Each Phyrexian symbol counts 1 (202.3g).
- A split card not on the stack uses the combined cost of both halves (202.3d).
- Any double-faced card in the library, hand, or graveyard has only its front face's characteristics (712.8a), so its deck-building mana value is the front face's.
- A transforming DFC's back face uses the front face's mana value (202.3b). A modal DFC on the stack or battlefield uses the face that is up (712.8f).
- Lands and cards with no mana cost have mana value 0 (202.3a).

Use Scryfall's top-level `cmc` for the card's mana value. For curve and land-count heuristics, also check MDFC `card_faces[]`: a spell with a land back face can be played as a land, which rules-defined mana value does not show.

## Game setup and play

These rarely matter for deck building, but they shape heuristics.

- Starting life is 40 (903.7). Opening hand is seven cards. In multiplayer, a player's first mulligan is free (103.5c).
- In multiplayer, **no player skips their first draw** (103.8c). Only a two-player game skips the starting player's first draw (103.8a). Simulations of a normal four-player game must draw on turn one.
- The commander starts in the command zone (903.6). Casting it from there costs `{2}` more for each previous cast **from the command zone** that game (903.8). Casts from other zones do not add tax.
- A player dealt 21 or more combat damage by the same commander loses (903.10a).
- The default multiplayer setup is free-for-all with attacks against multiple players (903.2). Most games have four players.
- Cards from outside the game cannot enter a Commander game unless a rule, special action, or effect specifically allows it in Commander (903.11). An ordinary wish does not. When it is allowed, the card must fit the commander's colour identity and must not share a name with a card in the player's starting deck or one they own in the game (903.11a).

## Not Commander

Brawl (903.12) and Commander Draft (903.13) are different formats inside the same rule. Brawl uses 60 cards, allows planeswalker commanders, and has different life totals. Do not apply Brawl rules or Scryfall's `brawl` legality to this app.

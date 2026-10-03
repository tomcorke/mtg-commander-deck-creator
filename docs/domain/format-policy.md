# Commander format policy

Checked 2026-10-03. This file covers Wizards of the Coast policy that changes between rules updates: the ban list, Commander Brackets, and the Game Changers list. These are policy, not game rules. They can change at any banned-and-restricted announcement.

Hard rules are in [commander-rules.md](commander-rules.md).

## Who decides

Wizards of the Coast manages Commander, advised by the Commander Format Panel. Gavin Verhey announces changes. Commander announcements share the regular banned-and-restricted schedule, but not every announcement changes Commander. The last Commander change was on [2026-02-09](https://magic.wizards.com/en/news/announcements/commander-banned-and-restricted-february-9-2026). The May and [2026-08-10](https://magic.wizards.com/en/news/announcements/banned-and-restricted-august-10-2026) announcements made no Commander changes.

Before relying on anything below, check the date at the top. If it is older than the most recent announcement, re-verify against the sources.

## Sources of truth

| Topic         | Primary source                                                                                             | Machine-readable source                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Ban list      | [Wizards banned and restricted list](https://magic.wizards.com/en/banned-restricted-list#commander-banned) | Scryfall `legalities.commander` (`legal`, `not_legal`, `banned`) |
| Brackets      | [Wizards Commander format page](https://magic.wizards.com/en/formats/commander)                            | None                                                             |
| Game Changers | [Wizards Commander format page](https://magic.wizards.com/en/formats/commander)                            | Scryfall `game_changer` boolean; search `is:gamechanger`         |

On 2026-10-03, Scryfall's `is:gamechanger` returned 53 cards, matching Wizards' list. Prefer Scryfall's fields over hard-coded lists in the app. If a list must be hard-coded, record the check date beside it.

## Ban list

Commander bans apply to the deck and to the commander. As of 2026-10-03, the Commander ban list is:

- All 25 Conspiracy cards, all 9 ante cards, and cards banned in every format for offensive content.
- Ancestral Recall, Balance, Black Lotus, Chaos Orb, Channel, Dockside Extortionist, Emrakul, the Aeons Torn, Erayo, Soratami Ascendant, Falling Star, Fastbond, Flash, Golos, Tireless Pilgrim, Griselbrand, Hullbreacher, Iona, Shield of Emeria, Jeweled Lotus, Karakas, Leovold, Emissary of Trest, Library of Alexandria, Limited Resources, Mana Crypt, Mox Emerald, Mox Jet, Mox Pearl, Mox Ruby, Mox Sapphire, Nadu, Winged Wisdom, Paradox Engine, Primeval Titan, Prophet of Kruphix, Recurring Nightmare, Rofellos, Llanowar Emissary, Shahrazad, Sundering Titan, Sylvan Primordial, Time Vault, Time Walk, Tinker, Tolarian Academy, Trade Secrets, Upheaval, Yawgmoth's Bargain.

**Banned as a companion.** Since 2026-02-09, Lutri, the Spellchaser may be in the deck or be the commander, but cannot be a companion. Scryfall reports Lutri as `legal` because `legalities` has no companion-only state. Handle this case in code if the app ever supports companions.

**Unbanned cards become Game Changers.** Wizards' usual practice is to move an unbanned card onto the Game Changers list. Lutri was the stated exception.

## Commander Brackets

Brackets are an optional matchmaking tool, still labelled beta. They describe the intended game experience. They are not a deck-validation algorithm, and Wizards explicitly says a deck is not placed in a bracket by "a calculator". The app must not claim that a deck **is** a given bracket. It can say which bracket guidelines a deck appears to meet or break.

The current definitions come from the [2025-10-21 update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025) and the format page.

| Bracket      | Intent                                                                                            | Game Changers                 | Expect to play at least |
| ------------ | ------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------- |
| 1 Exhibition | Theme over power. Thematic or substandard win conditions. Flexible legality by pregame agreement. | None, unless agreed for theme | 9 turns                 |
| 2 Core       | Unoptimized, straightforward decks. Incremental, telegraphed, disruptable wins. Low pressure.     | None                          | 8 turns                 |
| 3 Upgraded   | Strong synergy and card quality. Wins can come in one big turn from accumulated resources.        | Up to 3                       | 6 turns                 |
| 4 Optimized  | Lethal, consistent, and fast, but not the cEDH metagame.                                          | Unlimited                     | 4 turns                 |
| 5 cEDH       | Built for the competitive metagame.                                                               | Unlimited                     | Any turn                |

The format page also names three "barometers" that guide each bracket: two-card infinite combos, extra turns, and mass land denial. The [original brackets announcement](https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta) set these guidelines, and later updates have not replaced them:

- **Mass land denial:** none in Brackets 1–3. Wizards defines it as cards that regularly destroy, exile, or bounce lands, keep lands tapped, or change what mana four or more lands per player produce without replacing them. Examples are Armageddon, Ruination, Sunder, Winter Orb, and Blood Moon. The concern is intentional deck building, not an incidental board state.
- **Two-card infinite combos:** none intentional in Brackets 1–2. In Bracket 3, none that can happen cheaply in about the first six turns. The 2025-10 update replaced "no early-game combos" with the turn expectations above. Those expectations also cover finite wins: a deck that often wins before the bracket's turn count does not fit, whether or not a loop is involved. Holding a combo back until later does not fix that.
- **Extra turns:** none in Bracket 1. Low quantities in Brackets 2–3, not chained or looped.

**Tutors are no longer a bracket restriction.** The 2025-10-21 update removed the earlier "few tutors" guidance from all brackets. The most efficient tutors are on the Game Changers list instead. An app filter that excludes tutors is a player preference, not an official bracket rule.

**Precons are no longer the definition of Bracket 2.** The same update removed the link between Core and preconstructed decks, because precon power varies widely.

**No bracket changes as of 2026-02-09.** The [2026-02-09 brackets update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026) made no bracket-level changes. Wizards said it would not change brackets until after at least one 2026 MagicCon, and might then drop the beta label. Check the format page for the current status. It also restated that Bracket 1 may stretch card-legality rules by pregame agreement.

## Hybrid colour identity: no change

In 2025 Wizards floated letting a hybrid card fit a deck with **either** of its colours. On 2026-02-09 it shelved that proposal. Hybrid symbols still require **all** their colours in the commander's identity, as [commander-rules.md](commander-rules.md#colour-identity-9034) describes. Do not implement "or" hybrid identity unless a later Comprehensive Rules file changes 903.4.

## Game Changers

Game Changers are cards that "dramatically warp Commander games": runaway resources, game shifts many players dislike, locking players out, efficient unrestricted tutoring, or commanders that are unfun in casual games. Wizards avoids listing high-mana-value cards or legends that are only strong as commanders. A card's absence from the list does not mean it is weak.

Current list, 53 cards, from the format page on 2026-10-03:

Ad Nauseam, Ancient Tomb, Aura Shards, Biorhythm, Bolas's Citadel, Braids, Cabal Minion, Chrome Mox, Coalition Victory, Consecrated Sphinx, Crop Rotation, Cyclonic Rift, Demonic Tutor, Drannith Magistrate, Enlightened Tutor, Farewell, Field of the Dead, Fierce Guardianship, Force of Will, Gaea's Cradle, Gamble, Gifts Ungiven, Glacial Chasm, Grand Arbiter Augustin IV, Grim Monolith, Humility, Imperial Seal, Intuition, Jeska's Will, Lion's Eye Diamond, Mana Vault, Mishra's Workshop, Mox Diamond, Mystical Tutor, Narset, Parter of Veils, Natural Order, Necropotence, Notion Thief, Opposition Agent, Orcish Bowmasters, Panoptic Mirror, Rhystic Study, Seedborn Muse, Serra's Sanctum, Smothering Tithe, Survival of the Fittest, Teferi's Protection, Tergrid, God of Fright, Thassa's Oracle, The One Ring, The Tabernacle at Pendrell Vale, Underworld Breach, Vampiric Tutor, Worldly Tutor.

Recent changes:

- **2025-10-21:** removed Expropriate, Jin-Gitaxias, Core Augur, Sway of the Stars, Vorinclex, Voice of Hunger, Kinnan, Bonder Prodigy, Urza, Lord High Artificer, Winota, Joiner of Forces, Yuriko, the Tiger's Shadow, Deflecting Swat, and Food Chain.
- **2026-02-09:** [added Farewell](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026), and added Biorhythm on its unban. Lutri was unbanned but deliberately not added.

This list is the most likely domain fact in this repository to go stale. Use Scryfall's `game_changer` field at runtime where possible.

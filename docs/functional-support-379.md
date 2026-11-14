# Functional support before/after (#379)

The user built a Rabbit deck on Upgraded and was never offered Sol Ring or creature-type support such as Patchwork Banner. This records a reproducible case, why each card was or wasn't offered, the change, and a before/after evaluation. Land guidance is out of scope here; see [land-guidance-379.md](land-guidance-379.md).

## Reproducible case

The original deck, commander, settings and offer history were not supplied, so this case stands in for them.

| Pin           | Value                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| App revision  | `main` at `81216e9` (before); scoring version 8 on this branch (after)                                                                       |
| Commander     | Finneas, Ace Archer (G/W Rabbit typal), with theme `Rabbits`                                                                                 |
| Settings      | Upgraded power, Balanced priority, default exclusions (Game Changers, tutors, extra turns, unreleased), creature slot on, no price cap       |
| Targets       | Defaults: 35 lands, 10 ramp, 10 draw, 8 removal, 3 wipes                                                                                     |
| Deck state    | Commander only                                                                                                                               |
| Offer history | Every batch from the first, under two fixed policies: add every offer (accept-all), or add every nonland offer until 64 spells (spells-only) |

Differences from the report:

- The user's commander is unknown. Finneas stands in as a popular Rabbit commander.
- The user's priority is unknown, so the default, Balanced, is used. The comparison cases cover Theme first, Core and Deck needs first.
- PR #381 (creature-type support) merged on 2026-11-06, the day of the report, so the report most likely predates it.
- The build is simulated offline. It uses the app's own reducer and `recommend`, as `scripts/deckbuild/recommend.ts` does, with fixed decisions instead of a player's. Signature enrichment, which adds at most three engines' cards, is settled as failed and not simulated.

The pool comes from `scripts/deckbuild/prepare-provider.ts record --live-edhrec` with `"appPool": true`, which runs the app's candidate loader. The recordings stay in local research storage and are not committed. A replay re-derives each version's pool from the same recorded responses, offline.

| Date (UTC) | Mode                              | EDHREC pages | Stop reason |
| ---------- | --------------------------------- | ------------ | ----------- |
| 2026-11-14 | deckbuild prepare-provider record | 1/50         | completed   |
| 2026-11-14 | deckbuild prepare-provider record | 1/50         | completed   |
| 2026-11-14 | deckbuild prepare-provider record | 1/50         | completed   |

The runs fetched Finneas, Krenko and Tatyova, in that order.

> Provider data: EDHREC, `https://json.edhrec.com/pages/commanders/finneas-ace-archer.json`, `https://json.edhrec.com/pages/commanders/krenko-mob-boss.json` and `https://json.edhrec.com/pages/commanders/tatyova-benthic-druid.json`, fetched 2026-11-14.

## Why each card was or wasn't offered (before)

| Card             | Retrieved                                                    | Eligible                                               | Offered                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sol Ring         | Yes. EDHREC Mana Artifacts list; provider data: 79% of decks | Yes. Legal, not a Game Changer, no setting excludes it | **Never.** Its text "Add {C}{C}" labelled it `Land or mana`, so it competed with 62 lands and mana cards for the one mana slot per batch. Lands won all 25 slots. The three spell slots skip `Land or mana` cards, so it had no other route. |
| Patchwork Banner | Yes. Mana Artifacts list; provider data: 48%                 | Yes                                                    | **Batch 2.** "Add one mana" lacks "Add {", so it kept a spell reason and gained theme credit from #381. Before #381 it had no creature-type credit.                                                                                          |

The trace also showed that scoring ignored inclusion. With ramp short, Commander's Sphere (provider data: 6%) and Heaped Harvest (8%) took ramp slots that Arcane Signet (67%) and Cultivate (51%) never reached. The ramp target filled by batch 12, and after that ramp earned no deck-need credit.

## Changes

- **Land slot holds lands only.** A nonland mana source keeps its EDHREC list's reason and competes with spells (`slotReason`). From the fallback pool it is `Mana support`, and a restored draft relabels saved cards the same way, so the user's existing draft is fixed too.
- **Role quality.** While a ramp, draw, removal or wipes target is short, an off-theme card's deck-need credit scales with its EDHREC inclusion, from 60% of full credit at 0% to full at 40% (`roleQuality`). Generic role-gap and local-index results without inclusion get the credit for 20%. On-theme cards, lands and other cards without inclusion keep full credit. A met role gives no lift, so staples are not forced.
- **Creature-type package.** For a creature-type theme, a payoff (Patchwork Banner, Herald's Horn, "Rabbits you control") gains package credit while the deck has fewer than one per three members of the type.
- `recommendationScoringVersion` 7 → 8. The Deck needs and Strategy package explanations describe the new behaviour.

## Before and after

Each cell gives the batch in which the card was first offered (– means never), before → after. A build lasts 25 batches, or 22 for spells-only. Ramp cards are those in the final deck, with their mean EDHREC inclusion (provider data). Theme cards are deck cards matching the theme.

| Case                     | Sol Ring | Arcane Signet | Patchwork Banner | Herald's Horn | Ramp (mean inclusion) | Theme cards |
| ------------------------ | -------- | ------------- | ---------------- | ------------- | --------------------- | ----------- |
| Rabbit, accept-all       | – → 9    | – → 6         | 2 → 1            | 16 → 14       | 12 (17%) → 11 (31%)   | 52 → 54     |
| Rabbit, spells-only      | – → 7    | – → 5         | 2 → 1            | 15 → 14       | 10 (18%) → 10 (35%)   | 45 → 46     |
| Rabbit, Theme first      | – → –    | – → –         | 4 → 1            | 3 → 5         | 7 (20%) → 4 (27%)     | 62 → 62     |
| Rabbit, Core             | – → 8    | – → 6         | 2 → 2            | 16 → 15       | 12 (16%) → 10 (35%)   | 53 → 54     |
| Rabbit, Deck needs first | – → –    | – → –         | 1 → 1            | – → –         | 12 (16%) → 12 (17%)   | 43 → 44     |
| Rabbit, price cap $0.50  | – → –    | 8 → 1         | – → –            | – → –         | 10 (24%) → 10 (19%)   | 35 → 35     |
| Rabbit, Sol Ring ignored | – → –    | – → 5         | 2 → 2            | 16 → 15       | 12 (17%) → 10 (25%)   | 52 → 54     |
| Krenko (Goblins)         | – → –    | – → –         | 1 → 15           | 13 → 18       | 15 (27%) → 13 (35%)   | 71 → 73     |
| Tatyova (Landfall)       | – → –    | – → –         | – → –            | – → –         | 16 (24%) → 14 (25%)   | 58 → 61     |

- **Rabbit:** Sol Ring and Arcane Signet are now offered in ordinary Balanced and Core builds, by batch 9. Ramp mean inclusion roughly doubles, theme cards don't drop, and Patchwork Banner arrives in batch 1.
- **Constraints hold:** Theme first still gives Sol Ring no deck-need lift, so it isn't offered there. No offer breaks the price cap or the ignore list in any case.
- **Deck needs first:** ranking follows strict score order, and Sol Ring stays a few points below the top cards, as on `main`. Ramp quality barely moves (16% → 17%).
- **Krenko:** Skirk Prospector (provider data: 86%, a Goblin) moved from the land slot into batch 1, and ramp quality improves. Krenko's own text and the Goblin lords count as creature-type payoffs, so the package credits Goblin creatures rather than more payoffs. Patchwork Banner moves from batch 1 to 15 and Herald's Horn from 13 to 18. Sol Ring is still not offered, because on-theme Goblin ramp meets the target first.
- **Tatyova:** little change. Landfall-tagged ramp keeps full credit as on-theme and meets the target, so Cultivate (65%) and Sol Ring (67%) are not offered.
- Removal mean inclusion and count fell slightly for Krenko, and ramp mean inclusion fell for the price-capped case (24% → 19%). Draw and removal moved by a few points elsewhere.

`src/domain/functional-support.test.ts` retains the Rabbit regression (synthetic cards; it fails on `81216e9`) and the ignore, price-cap, role-quality and creature-type cases. `src/domain/builder-state.test.ts` covers relabelling a restored draft.

## Measured or estimated

The offer batches, counts and inclusion means are measured: they are outputs of deterministic simulated builds over recorded provider data. They are not player decisions, play data or win rates. Inclusion is how often this commander's EDHREC decks play a card, not card power. The 40% full-credit point, the 60% floor and one payoff per three members are app heuristics and are not calibrated; calibration belongs to #98.

## Not covered

- Land guidance and land offers are unchanged. The land-guidance acceptance item moves to [#587](https://github.com/tomcorke/mtg-commander-deck-creator/issues/587) (baseline and clamps) and [#589](https://github.com/tomcorke/mtg-commander-deck-creator/issues/589) (role-aware land fill).
- Krenko and Tatyova still don't offer Sol Ring once on-theme ramp meets the ramp target: [#591](https://github.com/tomcorke/mtg-commander-deck-creator/issues/591).
- Treasure makers count as ramp, which fills the ramp target early in Goblin decks: [#592](https://github.com/tomcorke/mtg-commander-deck-creator/issues/592).
- The user's own deck and offer history remain unknown.

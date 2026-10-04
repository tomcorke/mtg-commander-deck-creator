# First-use and commander-discovery investigation

Checked 2026-10-04 against live Scryfall responses. This is an app heuristic review, not player acceptance or a Commander rule.

## Source trial

`scripts/investigate-a9-source.ts` queried all 35 selectable themes with `is:commander legal:commander date<=today`, ordered by EDHREC inclusion. It inspected up to 12 results per theme (390 cards in total). Responses were bounded by the existing adapter; “175 fetched” is not the query's total result count.

Scryfall's [search API](https://scryfall.com/docs/api/cards/search) supplies card text, type lines, identity, legality and image URLs. Its [syntax reference](https://scryfall.com/docs/syntax) defines the query operators. The trial records each Oracle text beside its query; rerun the script to reproduce the source packet. The captured packet is `a9-source-investigation.json` in the Windows temporary directory, checked at 2026-10-04T12:10:15.518Z.

| Theme                 | Query term                   | Observation                                                                                                                                       |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Equipment             | `o:equipment`                | 81 fetched. The first 12 include equipment costs, attachment, protection and rewards. Use a live query, labelled “Oracle text matches Equipment”. |
| Landfall              | `o:landfall`                 | 35 fetched. The first 12 contain landfall triggers. Use a live query with the same limited claim.                                                 |
| Goad                  | `o:goad`                     | 30 fetched. The first 12 contain goad effects. Use a live query with the same limited claim.                                                      |
| Enchantments          | `o:enchantment`              | Loran of the Third Path and Kogla match through destroying enchantments; a text match does not establish a deck engine.                           |
| Group hug / Political | `o:"each player"`            | The first results include damage, sacrifice and theft. “Each player” is not evidence of shared benefit or negotiation.                            |
| Voltron               | `o:"commander you control"`  | Only two results. This misses equipment and aura engines.                                                                                         |
| ETB                   | `o:"enters the battlefield"` | No results in the captured trial. The old wording is not a usable discovery source.                                                               |
| Big mana              | `o:"add {"`                  | Back-face lands and small mana abilities appear beside large mana engines.                                                                        |
| Mill                  | `o:mill`                     | Self-mill and opponent-mill appear together.                                                                                                      |
| Creature-type themes  | `t:<type>`                   | Correct types do not establish support for a deck built around that type.                                                                         |

Keep the existing curated lists for other themes and extend them with the reviewed names in `src/domain/commander-discovery.ts`. Label these “Curated for <theme>”, not provider synergy. Curated names are hydrated through Scryfall and rejected if current construction data cannot establish commander eligibility. Colour choices require exact identity; name, theme and colours compose rather than replacing one another.

This bounded trial does not establish comprehensive theme coverage. An empty combination must stay empty with Clear filters available; it must not silently substitute unrelated commanders. The default name/colour discovery remains a Scryfall commander search.

## First use

Casual, Upgraded and High power are editable recommendation presets. They do not assign brackets, change construction rules, or verify a deck. Skip preserves current settings. Imports and resumed drafts bypass the preset step.

The guide is optional, requested once through a persisted preference, and starts only after the first batch. React Joyride 3.2.0 was exercised against the installed React 19 version before adoption. Display settings, recovery, card references, art and double-faced previews reuse the existing shared components.

Run `pnpm test:browser:a2-a9` for light, dark and 390px checks of discovery, display, preset/sets, guide keyboard/Escape, resume, Skip and prepared-draft reload. Provider responses are mocked; live provider quality and visual acceptance are separate gates.

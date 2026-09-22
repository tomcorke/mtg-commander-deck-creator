# Commander eligibility

Checked 2026-09-22 against Wizards of the Coast's current Comprehensive Rules.

## Rules

- **Comprehensive Rules 903.3**: A Commander deck has a legendary card as its commander. The card must be a creature, a Vehicle, or a Spacecraft with one or more power/toughness boxes. This makes legendary creatures and legendary Vehicles eligible. It also makes legendary Spacecraft eligible when they have a power/toughness box.
- **Comprehensive Rules 903.3a**: A card with an ability stating that it can be your commander is eligible even when it does not meet the normal card-type test. This is the exception that covers cards such as specially permitted planeswalkers.
- **Comprehensive Rules 903.4**: The deck must respect the commander's colour identity.
- **Comprehensive Rules 702.124k**: A legendary Background enchantment can be a second commander only with a commander that has “choose a Background.” It is not a standalone commander under 903.3.
- **Comprehensive Rules 702.124m**: “Doctor's companion” permits a matching legendary Time Lord Doctor creature pair. It changes pairing rules, not the normal single-card eligibility test.
- **Comprehensive Rules 903.12c**: Brawl separately allows legendary planeswalker cards. That rule does not apply to regular Commander.

## Sources

- [Wizards Comprehensive Rules](https://magic.wizards.com/en/rules)
- [Current rules text download](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt)
- [Wizards Commander format overview](https://magic.wizards.com/en/formats/commander)

## Scryfall data

Scryfall does not provide a per-card `can_be_commander` boolean. Its [search syntax](https://scryfall.com/docs/syntax) provides `is:commander`, so `t:planeswalker is:commander` can find commander-eligible planeswalker cards. To identify the reason for an individual card, inspect `type_line`, `power`, `toughness`, `oracle_text`, and `card_faces[].oracle_text` in the [card API object](https://scryfall.com/docs/api/cards). The useful explicit-permission query is `t:planeswalker o:"can be your commander"`.

`legalities.commander` only means that a card may be included in a Commander deck; it is not a commander-eligibility flag. For example, a legal-in-deck Spacecraft without a power/toughness box is not necessarily a legal commander.

## App rule

Promotion should allow a card when it is a legendary creature, a legendary Vehicle, a legendary Spacecraft with power/toughness data, or any card whose Oracle text explicitly says it can be your commander. Regular planeswalkers and other legendary noncreature, non-Vehicle, non-Spacecraft cards remain ineligible unless they have that explicit permission.

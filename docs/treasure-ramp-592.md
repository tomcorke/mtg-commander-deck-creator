# Treasure and burst ramp counting (#592)

In #379's pinned Krenko (Goblins) build, one-shot and conditional Treasure makers filled the ramp target early. After that, ramp earned no deck-need credit, so Sol Ring and Arcane Signet were never offered. The counting rule this issue decided is in [heuristics.md](domain/heuristics.md#ramp-counting-592). This page records the before/after comparison.

## Method

This reruns the [#379 comparison](functional-support-379.md) offline, using #379's pinned provider recordings in local research storage. No live EDHREC run was made.

| Pin       | Value                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| Before    | `main` at `4c2a5b5`, scoring version 8                                                      |
| After     | This branch, scoring version 9                                                              |
| Recording | Krenko, Mob Boss, Finneas and Tatyova from 2026-11-14; 1/50 EDHREC pages per run            |
| Settings  | #379's: Upgraded, Balanced, default exclusions, creature slot on, default targets (10 ramp) |
| Policies  | accept-all (add every offer) and spells-only, from the commander alone, up to 25 batches    |

> Provider data: EDHREC, `https://json.edhrec.com/pages/commanders/krenko-mob-boss.json`, fetched 2026-11-14.

Both versions build from the same pool, re-derived by `main` from the recording. The branch's pool loader would make one extra Scryfall role-gap search, because Krenko's pool now has 19 ramp-role cards instead of 38, below twice the 10-card shortfall. That search is not in the recording, so its candidates (at most ten ramp cards from Scryfall Tagger) are absent here. The comparison isolates the counting change, not the extra retrieval.

## Before and after

Each cell is before → after. "Offered" is the batch of first offer (– means never). "Target met" is the batch in which the deck reached 10 ramp under that version's own rule. "Lasting ramp" counts final-deck cards that are ramp under the new rule, so both columns use the same yardstick. Theme cards are deck cards matching the theme.

| Krenko case           | Sol Ring | Arcane Signet | Target met | Lasting ramp | Theme cards |
| --------------------- | -------- | ------------- | ---------- | ------------ | ----------- |
| Balanced, accept-all  | – → 15   | – → –         | 7 → 15     | 5 → 10       | 73 → 71     |
| Balanced, spells-only | – → 9    | – → 23        | 8 → –      | 3 → 7        | 58 → 56     |
| Theme first           | – → –    | – → –         | – → –      | 4 → 4        | 76 → 76     |
| Core                  | – → –    | – → 9         | 8 → 14     | 5 → 10       | 73 → 71     |
| Deck needs first      | – → 8    | – → 8         | 7 → 12     | 5 → 10       | 74 → 70     |
| Price cap $0.50       | – → –    | 16 → 5        | 16 → 18    | 10 → 10      | 61 → 59     |
| Sol Ring ignored      | – → –    | – → –         | 7 → –      | 5 → 9        | 73 → 72     |

- **Krenko, Balanced:** the ramp target now fills at batch 15 instead of 7. The final deck holds 10 lasting ramp cards instead of 5. Under the old rule it counted 13 ramp, of which 8 were one-shot or conditional: Crime Novelist, Fable of the Mirror-Breaker, Enterprising Scallywag, Reckless Lackey, Spawn-Gang Commander, Wily Goblin, Unexpected Windfall and Spiteful Banditry. Sol Ring is first offered in batch 15.
- **Constraints hold:** Theme first still gives no deck-need lift, so it offers neither staple. No case offers a card over the price cap or the ignored Sol Ring.
- **Theme cards** fall by 0–4, most in Deck needs first, where deck needs weigh most.
- **Rabbit and Tatyova** are unchanged in every measure: their ramp is rocks, dorks and land search.

## Sol Ring and Arcane Signet (for #591)

In Krenko Balanced on this branch, both staples carry about 22 deck-need points while ramp is short, against 12 evidence. From batch 9 Sol Ring often ranks fifth or sixth in the queue but is held back by batch diversity placement; it reaches the batch at 15. Arcane Signet ranks 9th to 58th and is not offered before Sol Ring brings ramp to 10. After that its deck-need credit is 0 and it falls to about position 150. A met target still gives a staple no lift, which is #591's scope.

## Measured or estimated

Offer batches, counts and theme counts are measured outputs of deterministic simulated builds over recorded provider data, not player decisions or play data. The counting rule is an app heuristic: whether conditional Treasure "is ramp" is a deckbuilding convention, not a rule.

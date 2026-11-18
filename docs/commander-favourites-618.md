# Commander favourites ranking (#618)

Offline comparison on the same captured candidate pools. No live EDHREC requests.
#607 Kotis recording: 2026-11-15; #379 Rabbit, Krenko and Tatyova: 2026-11-14.
Provider data: EDHREC commander pages for [Kotis](https://json.edhrec.com/pages/commanders/kotis-the-fangkeeper.json), [Finneas](https://json.edhrec.com/pages/commanders/finneas-ace-archer.json), [Krenko](https://json.edhrec.com/pages/commanders/krenko-mob-boss.json), [Tatyova](https://json.edhrec.com/pages/commanders/tatyova-benthic-druid.json).

## Method

Commander-only starts, original themes and targets; Theme first and Balanced. Rabbit/Krenko/Tatyova use their pinned #379 prepared pools and Upgraded settings. Kotis uses the saved #607 queue (1,299 cards), Core; decisions and ignored lists reset. No price or total budget. Kotis compact snapshots are hydrated from recorded Scryfall responses, with missing local matches supplied from the local index dated 2026-11-18. This reconstructs the saved candidate pool; it does not replay the original twelve player decisions or prove live retrieval quality.
Rank positions below are in the initial composed queue, not measured successive interactive batches. Drafts run the actual starting-deck planner. Baseline is this branch HEAD before edits; scoring 12 to 13. Local evidence: `E:/working/agent-sandbox/research/618-before.json` and `618-after.json`.

## Results

| Case             | Theme cards in draft before ? after | Majority-inclusion theme favourites drafted before ? after |
| ---------------- | ----------------------------------- | ---------------------------------------------------------- |
| rabbit-thematic  | 44 ? 44                             | 0 ? 8 / 8                                                  |
| rabbit-balanced  | 22 ? 23                             | 7 ? 8 / 8                                                  |
| krenko-thematic  | 54 ? 54                             | 1 ? 7 / 7                                                  |
| krenko-balanced  | 45 ? 45                             | 7 ? 7 / 7                                                  |
| tatyova-thematic | 49 ? 50                             | 0 ? 4 / 4                                                  |
| tatyova-balanced | 19 ? 20                             | 1 ? 4 / 4                                                  |
| kotis-thematic   | 53 ? 53                             | 0 ? 5 / 5                                                  |
| kotis-balanced   | 39 ? 39                             | 5 ? 5 / 5                                                  |

| Kotis card             | Theme first position before ? after | Balanced position before ? after |
| ---------------------- | ----------------------------------- | -------------------------------- |
| Swiftfoot Boots        | 144 ? 5                             | 71 ? 5                           |
| Aqueous Form           | 142 ? 1                             | 75 ? 1                           |
| Rancor                 | 147 ? 9                             | 79 ? 9                           |
| Dragonfire Blade       | 152 ? 13                            | 83 ? 13                          |
| Favor of the Overbeing | 150 ? 17                            | 87 ? 17                          |

All five Kotis majority-inclusion theme favourites are drafted after the change. Theme first previously drafted zero; this reconstructed Balanced baseline already drafted all five, although they were buried in the queue. That differs from the original audit and is disclosed rather than attributed to this fix.

The change intentionally promotes majority-inclusion theme favourites in every comparison build. Krenko?s Skirk Prospector moves from position 1 to 5 in Balanced; some other early role picks move back. Rabbit?s high-cost Byrke remains late in the queue because of mana-fit screening, but the draft includes it. Theme totals stay level or rise in these cases. These are heuristic composition results, not deck quality or win-rate measurements.

## Scope

The 50% threshold and one early slot per batch are app heuristics. Filters, budget checks, and player decisions still gate draft eligibility. #591 functional staple offering still runs after favourite placement; #592 ramp classification is unchanged. #619 should build on the favourite reservation before role quotas, and address the remaining evidence-free theme filler selection separately. UI explanations for mana-fit holds are deferred to [#632](https://github.com/tomcorke/mtg-commander-deck-creator/issues/632).

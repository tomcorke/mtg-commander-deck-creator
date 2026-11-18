# Starting-deck speculative theme filler (#619)

Offline, same-pool comparison using the #618 harness reconstruction and its recorded #607 Kotis and pinned #379 Rabbit, Krenko and Tatyova pools. No live EDHREC requests. Kotis is Core; other cases Upgraded; commander-only starts, original themes/targets, no budget, decisions reset. This does not reproduce the original player decisions or measure live retrieval quality. Local hydration uses the 2026-11-18 index. Rebased baseline e6436bc (#637), including its draw-role corrections. Scoring 14 -> 15.

| Case             | Theme cards before -> after | Speculative local theme spells before -> after |
| ---------------- | --------------------------- | ---------------------------------------------- |
| rabbit-thematic  | 44 -> 44                    | 0 -> 0                                         |
| rabbit-balanced  | 23 -> 23                    | 0 -> 0                                         |
| krenko-thematic  | 53 -> 53                    | 0 -> 0                                         |
| krenko-balanced  | 45 -> 45                    | 0 -> 0                                         |
| tatyova-thematic | 49 -> 49                    | 0 -> 0                                         |
| tatyova-balanced | 22 -> 22                    | 0 -> 0                                         |
| kotis-thematic   | 53 -> 37                    | 18 -> 3                                        |
| kotis-balanced   | 39 -> 18                    | 30 -> 3                                        |

All majority-inclusion theme favourites from #618 remain drafted. Queue ranking is unchanged: this change caps starting-deck picks, not interactive offers. Rabbit, Krenko and Tatyova drafts are unchanged. Kotis loses theme count deliberately: the broad Voltron classifier supplied many speculative matches. This is a composition regression in theme totals, not evidence of worse or better gameplay. Role and land choices can also change because later spells alter demand and land-role evidence.

Kotis retained speculative theme spells:

- kotis-thematic: One with Nature, Paradise Mantle, Krovikan Plague.
- kotis-balanced: One with Nature, Paradise Mantle, Krovikan Plague.

The cap leaves beneficial local cards and false positives competing for the same three slots; it does not assess quality. The Voltron classifier limit is documented in `docs/domain/heuristics.md` under the issue's permitted documentation option.

Reproduction artifacts: `E:/working/agent-sandbox/research/619-measure.mjs`, `619-before.json`, `619-after.json`. The JSON includes full draft names, initial top twelve and favourite positions. Provider-list coverage here uses the saved pool provenance (`Local card match` / local snapshot versus EDHREC-enriched entries), not a fresh page scrape; EDHREC lists are truncated and absence is not proof of poor fit.

Direct re-check against the recorded Kotis commander page (320 distinct card names, captured 2026-11-15): Theme first drafted cards absent from that page fall from 18 to 5; Balanced from 33 to 5 (basics excluded). Theme first's five are One with Nature, Paradise Mantle, Krovikan Plague, Restless Reef and Creeping Tar Pit; Balanced's five are One with Nature, Paradise Mantle, Krovikan Plague, Inspiring Call and Terrasymbiosis. The latter two are not selected-theme matches, so the theme cap does not restrict them. The two lands illustrate demand-driven land-plan changes outside the spell cap.

Peer review: Claude Opus 5.5 at high effort found that hydration clears the local snapshot flag on owned candidates. The cap now also recognizes their persistent `In your collection` reason; a regression checks owned-only hydrated candidates. The same-pool measurements are identical after that fix (`619-reviewed-after.json`). The scoring-version comment now covers draft composition. The existing queue-merge provenance limitation is documented rather than changing retrieval in this issue.

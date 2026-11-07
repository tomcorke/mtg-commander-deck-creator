# Power-target ranking experiment

Issue [#103](https://github.com/tomcorke/mtg-commander-deck-creator/issues/103) remains open. This first slice adds a bounded pace heuristic and fixed-pool evidence. It does not establish target calibration, reviewed anchor decks, complete-deck functionality, blind distinguishability, or risk coverage. Those require the remaining build/review work in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Profiles and limits

The saved identifiers remain `precon`, `upgraded`, and `high`. These are app targets, not official brackets. Priority, exclusions, editable role targets, theme, price and collection constraints remain independent settings.

- **Core (`precon`):** preserve existing role ranking and the existing short fast-mana filter. Aim for incremental development without weakening the deck by suppressing functional roles.
- **Upgraded:** gently prefer earlier ramp, draw and targeted interaction. Deduct one point per mana value above 3, capped at 4; wipes use threshold 5.
- **High:** prefer earlier utility more strongly. Deduct two points per mana value above 2, capped at 8; wipes use threshold 4.

The deduction is a separate `powerFitPenalty` in score explanations. It applies to the shared heuristic role classifier, across all priorities and recommendation surfaces. A card with several utility roles receives one deduction. No deduction applies to lands, unknown mana values, X costs, or cards with no detected utility/wipe role. An omitted target preserves previous ranking for API callers. Positive factors total 108, including the strategy-package term; this deduction reduces that total.

These thresholds are uncalibrated app heuristics. Mana value is not efficiency, consistency, quality, casting probability or a win-turn prediction. Alternate costs, modal faces, conditional effects, repeatable engines and thematic expensive utility can be misranked. This is deliberately a small preference, not a cutoff: expensive functional cards remain eligible, and role deficits retain their existing weighting. Keeping every candidate eligible does not prove Core decks are functional. No target automatically excludes tutors, extra turns or Game Changers; explicit exclusions still apply in preparation. Existing Core fast-mana filtering remains unchanged.

## Policy recheck

Read the sibling knowledge base's `knowledge/topics/commander/format-policy.md`, then reopened the [current Wizards format page](https://magic.wizards.com/en/formats/commander) and [October 21, 2025 update](https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025) on 2026-10-27. The format page still describes optional brackets through intended game experience; the update explicitly removes tutor restrictions and the Core/precon equivalence. These policy sources support keeping app targets and tutor preferences separate from bracket verdicts. They do not supply the scoring thresholds above. This narrow recheck does not revalidate the entire ban list or Game Changers list.

## Fixed-pool evidence

Research artifacts live outside Git at `E:/working/agent-sandbox/research/power-targets-103/`: `suite.json`, `sources.json`, `scryfall-response.json`, `validation.json`, `baseline.json`, `challenger.json`, `comparison.json`, and `README.md`.

A separate Codex gpt-6.1-sol helper at low effort authored 54 labels before running the ranker or reading the scoring implementation. All human reviews are pending. Six tuning cases cover Tatyova landfall and Sythis enchantments at all three targets, nine candidates each, with identical non-power state and pool within each family. Scryfall data was fetched on 2026-10-27; source records retain exact requests, printing and Oracle IDs. No downloaded card images are stored.

Baseline is commit `0cfe78ad99f18170cdcf5761ce0af6fedeea59b6`, exported outside the checkout, with only the benchmark schema extended to accept and hash `powerTarget`. Production scoring is unchanged in that baseline; it ignores the target. Both versions evaluate the same frozen suite. The benchmark pins the target in the evaluation hash, preventing accidental cross-target baseline/challenger comparison. Use the commands in [benchmark usage](../agents/deckbuild/README.md) with these artifacts and exact version attribution.

Observed scoring-v3 results:

- Tatyova High nDCG@4 rises from 0.4131 to 0.7889. The batch changes from Urban Evolution / Beast Within / Cultivate / Nature's Lore to Growth Spiral / Urban Evolution / Pongify / Llanowar Elves. Precision@4 remains 0.75.
- Tatyova Core and Upgraded batches remain unchanged (nDCG 0.9039 and 0.7769). All Sythis batches remain unchanged (Core 0.8885, Upgraded 1.0000, High 0.7477).
- All six cases retain good-option coverage 1, prepared-pool recall 1, zero redundant offers and zero known constraint violations. These narrow pools contain no known forbidden candidates; this is not an exclusion or legality evaluation.

This shows a target-dependent change in one illustrative family, not universal separation or improved deck quality. It also shows the limitation: a scoring difference need not change the visible batch. No thresholds were tuned against these labels. There is no holdout, human calibration, retrieval experiment, completed deck or blind review. Synthetic regression tests separately prove the ranking mechanism, priority independence, unchanged eligibility, price/ignore constraints, and schema pinning. Reviewed anchors, richer consistency and acceleration signals, blind build rounds, overshoot/undershoot checks and sourced early-win/extra-turn/land-denial indicators remain in #103.

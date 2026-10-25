# Review: deck-role targets and nonbasic land suggestions

Issue #119. Reviewed against `main@3c84e38` on 2026-10-25. This is a sourced review and implementation proposal, not a behavior change. Defaults, saved targets, and current recommendations remain unchanged here.

## Recommendation

- Keep the editable starting targets at **35 lands, 10 ramp, 10 draw, 8 targeted removal, and 3 wipes**. None is a format rule or a universal optimum. Do not replace them with 40 or 43 on the strength of one creator heuristic.
- Keep a player's saved target authoritative. The current **Use N** action already asks before changing the land target. Do not apply a calculated land count automatically.
- Keep raw role counts distinct from role quality. `analysis.counts` counts cards matching role rules; `roleCredit` already gives burst mana and cantrips half credit in role-need ranking. Do not silently turn the displayed targets into fractional credits before #33 validates features on representative decks and #98 can measure resulting builds.
- Keep the current range formula until an evidence-validated alternative exists, but label it as a rough curve heuristic rather than a probability or optimal count. If future work adds an explicit land-drop goal, keep it separate from the saved target and baseline; calculate the 99/98-card simple case exactly, then model castability separately. No universal threshold is supported, and partial-deck results stay provisional.
- Give nonbasic lands a dedicated candidate comparison against the current mana base. Explain each candidate's source benefit and its costs or conditions. Keep basic lands as valid alternatives and all additions manual. Do not sample candidates with the #128 simulation yet; its assumptions and output are not a calibrated candidate-ranking policy.

## Role targets

The current defaults and role labels live in [`src/deck-analysis.ts`](../src/deck-analysis.ts). `Deck review`, recommendation urgency, and Deck Doctor consume the same counts and editable targets. Counts include commander cards and exclude the sideboard. Cards can fill multiple roles, so role totals are not distinct deck slots. Wipe matches suppress targeted-removal matches; other overlaps remain possible. A target gap is guidance, not a legality failure or a required minimum.

| Role             | Default | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lands            |      35 | Keep as a player-editable starting point. Treat MDFCs as one optional land play, not a land and spell at once. A strategy such as landfall may justify a player's manual adjustment, but no universal bonus is supported.                                                                                                                                                                                                                                                                          |
| Ramp             |      10 | Keep the raw target. Preserve the feature distinction: `land-ramp` and `repeatable` accelerate over time; `burst` is temporary; `fixing` finds a land for hand and is not acceleration. Current role-need ranking gives burst half credit; the land estimate currently counts detected burst as full ramp. `cardFeatures` distinguishes land-to-hand `fixing` and unknown-destination searches, but has no landcycling label; validate that classifier gap separately from choosing target credit. |
| Draw             |      10 | Keep the raw target. `net` and `cantrip` both count in the display; role-need ranking gives cantrips half credit. Impulse access and recursion are different features and do not currently fill this draw role.                                                                                                                                                                                                                                                                                    |
| Targeted removal |       8 | Keep as a heuristic count of detected opposing interaction. Bounce and countermagic count by convention; costs, timing, target restrictions, and modal choices remain outside the count.                                                                                                                                                                                                                                                                                                           |
| Board wipes      |       3 | Keep as a heuristic count of selected mass effects. It is not a guarantee of full-board clearance; ownership, conditions, and asymmetric effects need card-level review.                                                                                                                                                                                                                                                                                                                           |

The 2022 EDHREC article reports observed averages of 35.9 lands, 12.7 ramp, 7.6 draw, 8.5 removal, and 2.7 sweepers. Its land median and mode are 36; the 5th–95th percentile is 30–41. The article does not give a reproducible sample size or filter set. These are historical submitted-deck frequencies, and its Scryfall Tagger categories do not match this app's classifiers. They describe what appeared in those lists, not optimal counts or a 36-land floor. [EDHREC article](https://edhrec.com/articles/the-deck-of-many-things-card-frequencies-by-type-and-function-across-edh)

The updated Karsten analysis fits a 99-card guideline of `31.42 + 3.13 × average nonland mana value − 0.28 × cheap draw/ramp count`. At average mana value 3 and no qualifying cheap cards, that is 40.81. The underlying sample is 95,143 successful 60-card event decks played from 2020-07-01 through 2022-07-01; it is not Commander performance data. The Commander adjustment is explicitly an imprecise extrapolation. Its MDFC weights (0.38 for nonmythics and 0.74 for mythics) come from that historical sample; they are not general weights for newer MDFCs. The supplied bibliography calls the article 2024; the publisher API reports publication on 2022-07-29 and an update on 2025-02-13. [Karsten, TCGplayer](https://www.tcgplayer.com/content/article/How-Many-Lands-Do-You-Need-in-Your-Deck-An-Updated-Analysis/cd1c1a24-d439-4a8e-b369-b936edb0b38a/) · [publisher metadata](https://infinite-api.tcgplayer.com/content/article/cd1c1a24-d439-4a8e-b369-b936edb0b38a/)

The 2017 Karsten paper likewise derives its figures from 110 successful 60-card Standard and Modern tournament lists and a specified mulligan/scry policy. Its example scales 25 lands by `99/60` to 41.25; that is a rough extrapolation, not Commander performance data. The available author PDF is hosted by a third party. [2017 paper](https://orkerhulen.dk/onewebmedia/How%20Many%20Lands%20Do%20You%20Need%20to%20Consistently%20Hit%20Your%20Land%20Drops.pdf)

## Current land guidance and saved targets

`analyseDeck` currently calculates a centre from `round(35 + 2 × (average mana value − 3) − (detected ramp − 10) / 3)`, clamps the centre to 32–40, then shows centre ±1 bounded by 30–42. The average includes commander cards; spell/land MDFCs count as lands and leave the spell curve. The ramp input treats all detected ramp alike, including burst mana. The calculation does not model ramp cost, draw, desired commander turn, strategy, mana-source reliability, or screw/flood preference. It is not a land-count probability.

`deckTargets` is part of the persisted deck state. New decks use `defaultDeckTargets`; loading a saved deck restores its edited values. `src/features/builder/BuilderView.tsx` offers **Use N** only when the saved/current land target is outside the range. Preserve that explicit acceptance step. A future range should explain its inputs and uncertainty beside the number instead of implying that a curve proves an ideal count.

### Exact simple-case probability checks

Commander construction is 100 cards including commanders: a complete single-commander deck has 99 library cards; a partner pair leaves 98. The opening hand is seven. In ordinary multiplayer, players draw on turn one. With no mulligan, extra draws, ramp, or extra land plays, and with every land immediately playable, the chance of making all land drops through turn `t` is exactly the chance that the first `7+t` cards contain at least `t` lands:

`P(drop through t) = Σ[C(L,k) × C(N−L, 7+t−k)] / C(N, 7+t)`, for `k = t … 7+t`.

Terms with impossible binomial arguments are zero. This is an exact hypergeometric check, not a sampled estimate. Under these assumptions, at least `t` lands among the first `7+t` cards is equivalent to making all `t` drops: an earlier prefix short by one cannot catch up with the remaining draws. This corrects the issue body's broader claim that the simple probability is not a check of consecutive on-time land drops: if any earlier prefix through turn `s` had fewer than `s` lands, the remaining `t−s` draws could not reach `t` lands by turn `t`. It still says nothing about mana available from a land played tapped, coloured-source access, or casting a particular spell. Rules: [Comprehensive Rules, effective 2026-09-25](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), 903.5a, 903.7, 103.8c, 305.1–305.2, 500.1, 501.1, and 504.1.

| Library | Lands | Turn 1 | Turn 2 | Turn 3 | Turn 4 |
| ------: | ----: | -----: | -----: | -----: | -----: |
|      99 |    35 | 97.41% | 89.46% | 75.94% | 59.22% |
|      99 |    36 | 97.74% | 90.58% | 78.05% | 62.09% |
|      99 |    40 | 98.70% | 94.15% | 85.27% | 72.63% |
|      99 |    43 | 99.17% | 96.03% | 89.45% | 79.33% |
|      98 |    35 | 97.54% | 89.88% | 76.72% | 60.27% |
|      98 |    36 | 97.85% | 90.98% | 78.81% | 63.14% |
|      98 |    40 | 98.78% | 94.45% | 85.91% | 73.62% |
|      98 |    43 | 99.23% | 96.27% | 89.99% | 80.24% |

These are land-drop probabilities under the stated simple case, not a target recommendation. For a 99-card library with 40 lands, four drops by turn four are 72.63% without a mulligan. Seeing at least four lands among 12 cards by turn five gives 79.94%. The current #128 simulator instead redraws once when its opening seven has fewer than two or more than five lands; it keeps the redraw even if it also falls outside that band. Exact enumeration under that app policy gives 80.10% for four drops by turn four at 40 lands. The enumeration uses a fresh independent 99-card order when the first seven is outside the 2–5 band, then keeps the redraw regardless of its land count, matching the simulator. The 2–5 keep band is a model policy, not the Commander mulligan rule. The video cited by #119 could not be transcribed, so its exact claim remains unverified. Do not report “about 80%” without naming the draw and mulligan assumptions.

Future tests should compute the hypergeometric references with exact integer combinations, include both `N=99` and `N=98`, and test the #128 redraw policy separately. Compare exact ratios before rounding percentages for display. The current simulator reports per-turn land-drop rates and sampled spell castability; those per-turn rates are not a cumulative “made every drop through turn four” result. Any such product claim needs its own defined output and regression check. Partial decks must remain explicitly provisional.

## Nonbasic land suggestions

`nonbasicLandSuggestions` filters the existing recommendation queue for nonbasic lands and takes its first `min(6, remaining land gap)` eligible cards. `useBuilderData` excludes main-deck/sideboard cards, ignored names, and cards with a recorded decision. The result is queue order, not a comparison against the current mana base: the helper receives no pip deficits, source conditions, or utility needs. The basic split does subtract existing colour sources and is recalculated when the deck changes. Preserve that behavior.

The queue includes EDHREC list entries; land-related list tags are `lands`, `utilitylands`, and `manafixing`. When EDHREC fails, the Scryfall fallback searches `(t:land or o:"add {")` and shuffles the pool. It does not add a dedicated land search alongside a working EDHREC pool; #134 owns that broader retrieval decision. Neither provider's ordering is a deck-specific evaluation of source timing.

Recommend a separate land-candidate score and explanation, limited to the remaining land gap:

1. Enforce the existing legality, colour-identity, singleton, exclusion, set, price, and player-decision filters.
2. Compare the candidate with current colour-source deficits, early coloured pips, and any stated commander-casting goal. Read the actual mana ability: Scryfall's `produced_mana` lists possible colours, not simultaneous sources, amounts, costs, or conditions. [Scryfall card objects](https://scryfall.com/docs/api/cards)
3. Credit basic land types only when they matter to an available search effect and a legal target remains. A typed dual may improve fetch access, but that does not make every typed dual untapped or free.
4. Compare colour fixing against entry delay, life or activation costs, colourless output, cycling, MDFC spell/land choice, and relevant utility. Do not impose a ten-tapped-land cap or a blanket preference for nonbasics.
5. Explain both the concrete benefit and drawback. For example, [Sacred Foundry](https://scryfall.com/card/grn/254/sacred-foundry) can provide red or white and has Mountain/Plains types, but enters tapped unless its controller pays 2 life; an untapped basic can be better for an early single-colour need. [Raffine's Tower](https://scryfall.com/card/snc/254/raffines-tower) provides three colours and can be cycled for `{3}`, but always enters tapped. [War Room](https://scryfall.com/card/cmr/361/war-room) is a colourless utility source whose draw ability costs mana, a tap, and life; it does not fix a coloured deficit.

Keep candidate choice manual; never replace a deck card or override an ignored decision. After an accepted main-deck addition, recalculate the remaining basic split from the new deck. The current modal copy, “Recommended for this commander,” should be replaced only when candidate-specific evidence exists; this review makes no UI change.

Candidate fixtures should compare concrete cases, not only land names:

| Deck state                                                          | Candidate and gain                                                                                                        | Cost or basic-land alternative                                                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Boros deck short on both red and white sources                      | Sacred Foundry can produce red or white, one colour at a time, and has Mountain/Plains types for matching search effects. | It enters tapped unless its controller pays 2 life. A basic is untapped and costs no life; prefer it when only one colour is needed early or no relevant search effect exists. |
| Esper deck with adequate early sources but weak late-game card flow | Raffine's Tower can produce white, blue, or black, one colour at a time, and can cycle for `{3}`.                         | It always enters tapped. A basic can be better if the deck still needs early untapped mana.                                                                                    |
| Coloured-source needs already met                                   | War Room offers a colourless source and repeatable draw.                                                                  | The ability costs `{3}`, tapping it, and life. It does not fix a coloured deficit and should lose to an on-colour basic when that is the deck's gap.                           |

## Acceptance fixtures for follow-up work

Use deterministic fixtures with named card features and current board state. Each fixture should test both its expected land/source benefit and one nearby negative case.

| Fixture                     | Required comparison or assertion                                                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low-curve deck              | Cheap spells and cantrips do not become mana sources. Check land-drop probability independently of cantrip role credit.                                                                                               |
| Expensive commander         | The commander is available in the command zone, not randomly drawn from the library. Do not let its mana value silently stand in for a chosen casting turn; include commander tax only if that later cast is modeled. |
| Green ramp                  | Distinguish land-ramp and repeatable sources from burst, fixing, and landcycling. Charge the mana and turns needed before crediting the source; land-to-hand access is not acceleration.                              |
| Non-green deck              | Test rocks/repeatable mana and one-shot burst separately; do not assume green land-search is present.                                                                                                                 |
| Multicolour, pip-heavy deck | Compare sources for early coloured pips and the commander's stated timing. A colourless utility land must not fix a coloured gap.                                                                                     |
| Landfall deck               | Test a player's landfall/extra-land strategy separately from ordinary curve needs; do not apply a universal landfall bonus.                                                                                           |
| MDFC-heavy deck             | Each MDFC is one card and one choice. Test land mode versus spell mode; never count both at once.                                                                                                                     |
| Utility/tapped-heavy deck   | Compare an unconditional tapland, a conditional tapland, an untapped basic, and a colourless utility land. Include a case where the basic is better.                                                                  |
| Partner pair                | Use 98 library cards and the combined colour identity; the full deck still contains 100 cards including both commanders.                                                                                              |
| Partial build               | Mark the result provisional and avoid presenting complete-deck probabilities or a final basic split as settled.                                                                                                       |

Acceptance should also cover a candidate already in the deck or sideboard, an ignored candidate, a previously decided candidate, an illegal-identity candidate, a price/set exclusion, and a candidate whose only value is a conditional or costly ability.

## Code and issue boundaries

- Classification remains in `src/deck-analysis.ts`; validate role/features on real lists in [#33](https://github.com/tomcorke/mtg-commander-deck-creator/issues/33). Keep its findings separate from a decision to change target values.
- The general recommendation score and retrieval are [#105](https://github.com/tomcorke/mtg-commander-deck-creator/issues/105) and [#134](https://github.com/tomcorke/mtg-commander-deck-creator/issues/134). A land-specific score should reuse those source and eligibility rules, not duplicate them.
- The simulation groundwork is [#128](https://github.com/tomcorke/mtg-commander-deck-creator/pull/128), which closed #104. Its remaining explicit deferral was seeded sampling of late land candidates. This review does not recommend that sampling yet.
- Figure placement is [#31](https://github.com/tomcorke/mtg-commander-deck-creator/issues/31); it does not decide target policy. The saved target is restored in `src/app/useDeckState.ts` and `src/app/deck-actions.ts`.

Implementation follow-ups from this proposal are tracked separately: [land-target guidance](https://github.com/tomcorke/mtg-commander-deck-creator/issues/142) and [deck-aware land suggestions](https://github.com/tomcorke/mtg-commander-deck-creator/issues/143). No default or behavioral policy changes in this review.

# Land guidance proposal for issue #142

Status: approach approved by the user in the issue research thread on 2026-10-28. Approval covers lightweight local land-drop calculations presented as broad likelihood labels/ranges, with exact calculations internal, no automatic target changes, and no complex deck-interaction analysis. Specific editorial band boundaries remain implementation details to review; they were not separately approved. The implementation below makes this approach concrete for PR review.

## Decision requested

Approve a land-drop context panel using broad likelihood bands and plain-language labels as the first scope, with no automatic recommendation or universal probability threshold. Keep all starting and saved role targets unchanged. Do not replace the existing curve heuristic with a probability-derived target until the user chooses a goal and explicitly accepts a target change.

## Proposed presentation

Example for a complete single-commander deck containing 40 lands:

> Likely to make every land drop through turn four.
>
> 99 library cards; 40 lands. Opening seven plus one draw each turn, including turn one. No mulligan, extra draws, ramp, or extra land plays. Every counted land is assumed available for a land play. This does not estimate untapped mana, colour access, or spell castability.

Show turns one through four as individual likelihood labels, with turn four the initial context horizon. It is a display horizon, not a recommended gameplay objective. Do not use success/failure colours, grade the deck, or label a count optimal. Keep the current editable target visibly separate from the actual library land count used in this calculation. A saved target of 35 in a deck containing 40 lands must not produce a result labelled as the current deck at 35 lands.

No goal is selected initially. A later optional goal may specify a turn and player-chosen probability; any resulting count is a hypothetical comparison, applied only with an explicit action naming the old and new target. No threshold is preselected by this proposal.

### Likelihood wording (proposed boundaries)

User feedback: exact displayed percentages are unnecessary; consider ranges and textual representations. Keep exact calculations internally for validation, but omit decimal percentages from the main presentation. Prefer “likely” over “high confidence”: the former describes the event, whereas the latter can imply confidence in the model itself.

Proposed editorial bands, not MTG rules or recommended targets: below 20% “Very unlikely”; 20% to below 40% “Unlikely”; 40% to below 60% “About even”; 60% to below 80% “Likely”; 80% to below 95% “Very likely”; 95% and above “Almost certain”. These boundaries are editorial implementation choices for PR review, not previously approved numerical thresholds. Explain bands in optional help using whole-number ranges; do not show an exact percentage by default. A likelihood label must always name the event and turn, and retain the baseline assumptions nearby. Band boundaries do not define an acceptable deck or trigger a target change.

## Model contract

- Complete decks use 99 library cards for one commander and 98 for two; exclude command-zone cards and sideboard cards. Commander cost never changes this probability.
- Calculate the exact hypergeometric tail for at least t lands in 7+t cards. With one draw and at most one land play per turn, this is also the probability of every drop through t: a deficient earlier prefix cannot recover enough lands in the remaining draws.
- Count ordinary lands as land-play opportunities regardless of tapped or colour restrictions; clearly state that these restrictions prevent interpreting the result as mana availability.
- For spell/land MDFCs, offer an explicitly labelled all-land-mode scenario only if every such card is identified reliably. Otherwise withhold the deck-specific likelihood headline and explain the unsupported classification. Never count a card as both spell and land. An optional all-spell-mode comparison can show the choice's sensitivity; neither is a play-policy prediction.
- For partial decks, withhold a complete-deck likelihood by default: say “Provisional: complete the library to calculate land-drop context.” Do not silently fill missing slots or divide by the partial library size. A future hypothetical completion requires an explicit assumed land count and completed size.
- Exclude ramp, repeatable mana, burst, fixing, landcycling, extra draws, extra land plays, and commander casting objectives from this baseline. Their presence does not reduce its land input. Future models must represent costs, timing, legal targets, and choices before crediting them.
- Keep #128's sampled per-turn results separate. Do not relabel them as cumulative exact probabilities.

## Optional mulligan comparison

Recommend leaving this collapsed or absent from the initial panel. If included, label it “One redraw: keep 2–5 opening lands; otherwise shuffle back and keep a fresh seven.” It is an app policy, not the actual multiplayer mulligan procedure. Show it beside, never in place of, the no-mulligan baseline. It must state that the second seven is kept regardless of land count. At 40/99 its separate turn-four reference is 80.10%.

## Validation contract for later implementation

Use independent integer-combination calculations for every 99/98 × 35/36/40/43 × turn 1–4 case in the existing review. Compare exact ratios before display rounding. Anchors: 40/99 gives 72.63% through turn four; at least four lands among 12 cards is 79.94%, which is a different event from five consecutive drops. Enumerate the one-redraw policy independently.

Retain the existing review's fixtures: low curve and expensive commander leave the baseline unchanged at equal N/L; green ramp and non-green burst receive no source credit; pip-heavy and tapped/utility-heavy decks retain explicit mana limitations; landfall receives no automatic bonus; MDFCs require a named mode scenario; partners use 98; partial decks withhold the complete-deck headline. Verify target persistence and that viewing/changing context never writes a target.

## Approval and implementation boundary

The user approved lightweight local calculation with likelihood labels/ranges in the [issue comment](https://github.com/tomcorke/mtg-commander-deck-creator/issues/142#issuecomment-6469052914). The implementation uses the proposed bands, places context beside existing deck targets, withholds incomplete/unresolved-library results, and labels the all-land MDFC scenario. These editorial and placement choices are presented for review, not claimed as prior user approval. There is no goal selector, numerical target recommendation, or mulligan comparison in this change. The one-redraw reference is validated separately in tests without exposing it as the baseline. The existing curve heuristic and manual Use action remain separate; defaults and persisted targets are unchanged. No simulation, ramp sequencing, colour analysis, or castability model is added.

## Evidence and limits

This is an app-policy proposal, not a Commander rule or an empirically calibrated land recommendation. Mathematical reference values, fixture details, and the derivation are in [the #119 review](role-target-and-land-suggestion-review.md#exact-simple-case-probability-checks). Rules support comes from the knowledge base's Commander rules topic (reviewed 2026-10-03), citing the [Comprehensive Rules effective 2026-09-25](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), especially 903.5a, 903.6, 103.5c, 103.8c, and 305.1–2. No new rules finding or current-policy revalidation is claimed here. [Issue #142](https://github.com/tomcorke/mtg-commander-deck-creator/issues/142) remains the source of truth for approval.

# App heuristics

Checked 2026-10-03. Exact weights, formulas, quotas, and timings belong in the owning code, not this reference. A detected match is a clue; no match does not prove no interaction. See [rules](commander-rules.md), [policy](format-policy.md), and [provider contracts](data-sources.md) for stronger claims.

## Roles and targets

`src/deck-analysis.ts` owns editable defaults and overlapping classifiers; wipe matches suppress targeted-removal matches. Builder counts include commanders, not sideboard cards. **No target is a construction minimum.**

| Default                | Detection and known limits                                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **35 lands**           | Front-face lands and spell/land MDFCs count as lands; transforming back faces do not. Spell/land MDFCs leave the spell curve to avoid double-counting. Never call this count available land drops or a required land count.                                                                                                                                             |
| **10 ramp**            | Nonland potential mana, land-search/placement, Treasure, or additional-production wording. Land Tax/Expedition Map need not accelerate mana; costs, conditions, and one-shot versus recurring output are ignored. Additional land plays, reducers, unusual Treasure wording, and spell/land cards can be missed. Never call it effective acceleration or required ramp. |
| **10 draw**            | Selected literal draw phrases. Opponent draw and cantrips can count without net advantage; impulse access, tutors, recursion, and unfamiliar wording are missed. Never call it total card advantage or required draw.                                                                                                                                                   |
| **8 targeted removal** | Targeted destruction, exile, bounce, negative stats, damage/fight, or countermagic. Self-blink/bounce can match; modal, overloaded, restricted, or unusual interaction can be missed. Bounce/countermagic count by convention. Never call it guaranteed opposing-threat removal or required interaction.                                                                |
| **3 wipes**            | Selected all/each destruction, exile, bounce, sacrifice, damage, or negative-stat phrases. Owners and conditions are ignored; X damage, asymmetric/modal effects, and unusual wording can be missed. Never call it guaranteed clearance or required wipes.                                                                                                              |

## Curve and mana estimates

`src/deck-analysis.ts` owns these calculations; `src/app/useBuilderData.ts` consumes them.

- **Curve/types:** land-classified cards, including spell/land MDFCs, leave the spell curve; transforming DFCs use their front face for land/type classification. Fractional values are floored into display buckets; types overlap and sections use display priority. Multiple options and alternative costs distort demand. Never call the curve actual casting costs or exhaustive playable options.
- **Land range:** uses spell average, including commanders, and detected ramp. Unlike ramp cards are treated equally; draw, fixing, reductions, land modes, and strategy are absent, so it can over- or under-prescribe lands. Never present it as an official recommendation or optimum.
- **Colour demand/supply:** counts coloured, `{C}`, and `{S}` symbols across nonland faces against reported colourless output and snow sources. Alternative faces and hybrid/Phyrexian symbols can overstate demand; conditional sources/commanders overstate early supply, while multi-mana producers/reducers can be understated. Never call these available mana, casting probabilities, or identity validation.
- **Basic-land plan:** fills the editable target within remaining slots, proportionally to pips, evenly without demand, using largest remainders. Empty identity selects Wastes. Existing fixing, activation costs, conditional demand, and missing chosen-colour state make the split unreliable. Never call it a solved mana base or proof of a colourless choice.

## Role urgency

`src/deck-analysis.ts` starts guidance at **70 cards** and strengthens it at **85**; mana-role deficits receive extra weight. `src/app/recommendation-context.ts` gates health weighting. Overlapping roles exaggerate slot pressure; early gaps and misclassified functions can be missed. Never call urgency a deadline, legality failure, or proof of unplayability. Separate Thematic health suggestions in `src/app/useBuilderData.ts` are alternatives, never mandatory picks.

## Themes and pair clues

`src/domain/recommendation-themes.ts` tags wording/types and maps EDHREC aliases. Unsupported mechanics/slugs remain unsupported; generic Tribal is not selectable. Words can describe opponents or costs: `each player` need not be helpful Group hug, and sacrifice wording need not be an engine. Implicit interactions and new wording are missed. Never present tags as executed abilities, complete strategy classification, or official themes.

Sub-theme inference uses **3 matches among the last 12** noncommander selections. `src/app/useBuilderData.ts` owns suggestions; dismissals wait for increased support. `src/domain/recommendation-queue.ts` owns active-selection limits. Recency exaggerates incidental packages or overlooks older ones. Never call the trigger sufficient support or a construction restriction.

`src/domain/commander-catalog.ts` and `src/app/recommendation-actions.ts` own curated commander/pair shortcuts and narrow theme searches. They omit valid commanders, pairs, and implicit themes. Scryfall theme search is one page ordered by EDHREC popularity, not commander synergy; its fallback uses a random comparator, which is not uniform. Never call these exhaustive eligibility, general pairing validation, or unbiased recommendations.

Pair clues match blink/ETB, tokens/payoffs, counters, sacrifice/death, graveyard/recursion, or artifact-token/payoff wording. They ignore ownership, targets, costs, timing, once-per-turn limits, and resources; setup may be missing or the beneficiary wrong. Other interactions are missed. Never present a pair as a proven interaction, infinite combo, or bracket-combo detector.

## Signature enrichment

`src/domain/signature-recommendations.ts` owns profiles and evidence thresholds. Families cover counters, ETB/blink, sacrifice, tokens/populate, enchantments, artifacts, lifegain, graveyard/recursion, spellslinger, landfall, and equipment.

Seeds need **two other noncommander, nonland participants**; repeated entries need not be distinct identities. Engine tests strip parentheticals and opponent-trigger sentences, and reject incidental equipped/enchanted triggers. Theme match, multiplier wording, then fit rank seeds. These profiles admit incidental matches and miss unsupported engines/wording; excluding Smothering Tithe or Skullclamp is not a claim they cannot power decks. Never call selection a complete engine inventory or synergy proof.

A pass selects **up to 3 seeds**, **24 names per seed**, hence **72 names**. Qualifying ETB seeds can use commander pages; others use card pages. Selected ordinary lists require minimum observed support and positive association: raw lift on card pages, synergy on commander pages. The owning module defines cutoffs; sorting favours deck count or synergy respectively. Truncated/omitted lists hide niche/new candidates; popularity admits irrelevant ones. Never call these cutoffs significance, relevance guarantees, or rules interactions.

Incoming Energy/token checks require tagged peers and can count commanders, unlike seed participation. Creature-type-choice and Angel/Zombie-support wording is rejected; other checks use participation, counter-pair clues, or narrow sacrifice fodder. Incoherent packages can pass and useful typal cards fail. Never present these screens as necessary or sufficient support.

`src/app/signature-actions.ts` and `src/app/useSignatureRecommendations.ts` own rolling budgets, retries, and idle/visibility/complete-deck gates. Cached, cancelled-before-dispatch, or foreground-promoted work does not add a background charge; actual retries do. Budgets defer useful work and do not coordinate tabs. Never present them as provider allowances, relevance thresholds, or game timing.

## Scores, learning, and batches

`src/domain/recommendation-scoring.ts` and `src/domain/recommendation-types.ts` own factor weights, penalties, and bands. Evidence labels, themes, collection, preferences, needs, and mana proxies form a fit score; **45** is the Recommended threshold for the best visible candidate. Taxonomy drift changes source-label weights; overlapping tags inflate scores, sparse tags under-rank useful cards, and aggregate sources misjudge castability, especially slash-symbol costs. Never present scores as win probability, card power, bracket, cEDH suitability, or fun.

`src/domain/recommendation-queue.ts` learns from Add/Ignore/like choices, not intrinsic quality. Generic shared tags spread preferences to unrelated cards; unexpressed reasons are missed. Never present learned values as verified intent or quality.

The queue balances creature/mana picks, novelty, reason variety, and theme coverage; Theme first preserves identity, while Deck needs first omits ordinary diversity quotas. Supply and fallbacks can relax quotas or restore mana-penalized creatures. Quotas displace higher scores and fail with sparse pools. Never present them as optimal composition or casting bans. `Land or mana` labels use root land type or literal mana-addition text, missing land faces/indirect output and admitting conditional production; they are neither ramp roles nor available mana.

The same module owns Later/undecided cooldowns and can advance to deferred cards when unseen cards run out. These are queue delays, never turns, elapsed-time waits, or usefulness judgments.

## Power and collection preferences

- **Power presets:** `src/app/useRecommendationState.ts` and `src/app/useAppActions.ts` set optional exclusions. Loose bracket mappings over-filter acceptable Upgraded decks and miss combos, land denial, loops, and intent. Never present settings as bracket compliance.
- **Fast mana:** Core-only `preconFastMana` in `src/domain/recommendation-scoring.ts` is incomplete: it omits Sol Ring, Ancient Tomb, and Lion's Eye Diamond and includes outright-banned cards. Never call it the ban list, Game Changers list, or a complete definition.
- **Tutor/turn filters:** `src/domain/recommendation-sources.ts` uses literal wording; Scryfall routes in `src/app/recommendation-actions.ts` use Tagger. Land-search ramp can be excluded; prevention of extra turns can match. Other wording, indirect engines, and loops escape. Never call these equivalent, exhaustive, or complete bracket checks.
- **Set selection:** curated/selected sets in `src/domain/recommendation-types.ts` are affinity, not inventory or complete franchise taxonomy. Broad membership admits off-theme cards; other sets and allowed alternate printings are missed, especially when only the hydrated printing is checked. Never present matches as ownership or exhaustive theme coverage.

## Deck Doctor and simulations

`src/deck-doctor.ts` flags scant theme support, absent detected connections, and costs/pips high relative to averages/reported sources. Broad matches protect unhelpful cards; missing tags flag useful ones. Its hybrid discount uses source counts, and simulation evidence uses mana-value-based turns and a draw-sample cutoff. Conditional sources hide problems; alternatives, reductions, and commanders cause misleading warnings. Never treat findings as automatic cuts, proof of no synergy/uncastability, mandatory casting turns, or confidence guarantees.

`src/deck-simulation.ts` samples the current library, favouring land plays that make held spells payable, then mana variety. It supports integer generic and ordinary coloured/colourless costs; spells are tested independently, never cast or removed. Payability is conditional on drawing; land-drop rate is per-turn, not cumulative.

No mulligans, ramp, tapped-land delays, activation costs, conditional output, reductions, hybrid/Phyrexian/snow/X costs, or opponents are modeled. Nonproducing lands count as generic sources; transforming back faces are not land choices, while spell/land MDFCs are. Omitted ramp/alternatives can understate access. Partial decks change denominators. The multiplayer simulation draws on turn one. Never present samples as complete games, actual casting probability, strength, or brackets.

`scripts/recommendation-audit.ts` owns synthetic acceptance policies, fixture selection, and stopping limits. “Useful pick rate” measures policy acceptance, overlap measures reference names, and signature novelty is not relevance. Narrow fixtures/fabricated choices reward irrelevant cards or reject useful departures. Never present these as player acceptance, win rate, or recommendation quality.

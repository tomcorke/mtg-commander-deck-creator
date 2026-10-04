# A6: Signature-card investigation

Investigated on 2026-09-30 against `917133f`; the user subsequently approved the bounded trial. The source comparisons below describe the baseline. The released trial (`47dab89`), expanded mechanics (`d18fc56`), and rolling-hour recovery (`f928509`) are recorded separately.

## Decision

**The bounded trial, expanded mechanics, and rolling-hour recovery are released.** Source comparisons and the offline proof supported the user's initial go-ahead for counters, blink/ETB, and sacrifice. Runtime checks cover request scheduling, cached hydration, eligibility, persisted evidence, and late queue integration. The expansion adds eight tested mechanic families and raises the approved ceilings. The user then approved rolling-hour budgets and backoff-based recovery, implemented below. Player acceptance remains unproven.

A6's requests serve the user's commander selection and subsequent deck-building choices, rather than an independent crawler. [EDHREC's terms][terms] restrict automated requests, copying, redistribution, and access to build similar or competitive sites. The investigation did not establish that those restrictions prohibit this user-driven integration. The initial report overstated that uncertainty as a permission blocker. Treat the terms as an integration risk, not a requirement to obtain permission before continuing A6. Keep requests bounded and respect provider responses.

The initial comparison exposed off-colour candidates, unrelated theme associations, and missed engine tags. The released trial used three tested mechanics; the expansion adds eight profiles. An unsupported mechanic never triggers a seed request. Selected main-deck support can establish a supported mechanic even when the declared theme is different, as in the supplied Anikthea deck.

## Implemented trial

This section describes the released `47dab89` baseline. The next section records the expanded implementation and its higher ceilings.

`src/domain/signature-recommendations.ts` selects up to two engines from main-deck metadata. Each needs two other mechanic participants. It strips reminder text, distinguishes landfall from ETB, excludes commanders and lands, and uses selected themes and the shared fit score for priority. Counter and sacrifice seeds use card pages; commander-eligible blink seeds can use their commander pages. Legendary status earns no bonus.

`src/app/useSignatureRecommendations.ts` waits two seconds while the builder is idle, below 100 main-deck cards, and displaying at least four recommendations. Its context includes deck identity, generation, selected cards, sideboard, exclusions, themes, eligibility settings, collection, and commander colours. Printing-only changes do not refetch. Cleanup aborts unused requests; a committed-context check rejects old responses, including switches between saved decks sharing a commander. Saving an unsaved deck retains its request allowance.

`src/app/signature-actions.ts` enforces four seed reservations and two background collection POSTs per deck session, with 12 reservations and six POSTs per tab. Reservations count cached, failed, and cancelled seed attempts. Each page contributes at most 24 names; one pass hydrates at most 48 unique names through A5's shared resolver. Background collection work has one attempt, no printing fetch, no fallback, and no automatic retry. A request joined and promoted by a foreground consumer becomes existing foreground work rather than consuming an extra background POST allowance.

The shared scheduler gives queued foreground work priority, spaces Scryfall dispatches by at least 500 ms, and serializes EDHREC dispatches with at least one-second spacing. Both providers enforce Retry-After cooldowns. EDHREC caches validated raw pages for 15 minutes, up to 32 entries per fetch client, keyed by page kind and slug. Rankings are never cached. Scryfall rejects malformed collection records before they can poison shared hydration; front names and single-/double-slash combined names share one normalized key.

Before merging, candidates must be explicitly Commander-legal, nonland, within colour identity, and pass the existing safety and collection filters plus a concrete engine connection. Unknown game-changer or release metadata is rejected when the corresponding exclusion is enabled. Energy, typal, token, and Zombie packages require suitable deck support. These narrow rules can miss useful cards; they are not a general combo detector. Collection-only mode conservatively accepts the hydrated printing, without extra lookups for other allowed printings.

The merge preserves the first four queue objects, decisions, likes, printing choices, and deferrals. Accepted, sideboard, ignored, deferred, and duplicate names stay excluded. New candidates enter normal goal-aware ranking on advancement without source-score inflation. Optional `seedEvidence` survives saving and conversion to deck cards. The visible provenance is `Seen with <seed>`, not commander synergy. Its shared card reference previews and opens the selected seed; native popovers keep those previews inside the viewport.

### Supplied Anikthea deck

[`scripts/fixtures/a6-anikthea.txt`](../scripts/fixtures/a6-anikthea.txt) preserves the user's 100-card main deck, including Anikthea, and eight-card sideboard. Printing IDs resolve the flavour-named S.H.I.E.L.D. Spy Satellite to Fellwar Stone. Double-face names exposed the shared name-key gap corrected above.

A live pass used the first 86 main-deck entries and all eight sideboard entries, with Balanced, Enchantments, default safety exclusions, and no collection restriction. It selected **Calix, Guided by Fate** and **Cathars' Crusade**. The pass made **two EDHREC GETs and one Scryfall collection POST**. A separate commander-page GET established novelty against Anikthea's complete EDHREC pool. Eligible additions absent from that pool were **Unbreakable Formation, Elspeth, Storm Slayer, Champion of Lambholt, and Hardened Scales**. The full 100-card deck pauses enrichment; this is a partial-build check, not a proposal to increase its main-deck size.

### Checks and remaining work

`pnpm test` runs the original offline proof and `src/app/signature-actions.test.ts`. Production checks cover fuller and partner decks, mechanical false positives, 24/48-name limits, overlapping/warm hydration, per-deck/tab ceilings, failures, cancellations, provider cooldowns, foreground priority, eligibility changes, evidence persistence, printing preservation, and all four queue goals. Malformed hydrated records do not enter the shared cache. Pacing tests use monotonic time and caught an early timer wake-up; the scheduler now rechecks before dispatch.

Rendered Chromium checks with mocked APIs confirmed late append and later-batch display, stable Add/Later/Ignore/like decisions, unchanged deferred eligibility, a delayed same-commander saved-deck switch, silent source failure without fallback, and no enrichment on the complete 100-card/eight-sideboard fixture. Light, dark, and 390-pixel layouts were inspected; seed-name keyboard preview and detail activation were exercised. Live responses, cached card data, browser harness, and screenshots remain outside Git.

Remaining work is player review across representative decks, especially weak source pools such as Shalai's. The user subsequently approved the expansion below without waiting for that review. Provider JSON and observed CORS remain undocumented integration risks. The separate 24-hour Scryfall cache-policy review remains open; A6 does not silently replace A5's 15-minute policy.

## Expanded mechanics and limits

This section records `d18fc56`, before the rolling-hour recovery described next. The user approved broader profiles and increased request ceilings after the baseline release. `src/domain/signature-mechanics.test.ts` uses labeled rules-text excerpts for eight additional families:

- Tokens/populate: Anointed Procession with token creation and token payoffs.
- Enchantments: Sythis with selected enchantments and enchantment-triggered payoffs.
- Artifacts: Etherium Sculptor with selected artifact spells.
- Lifegain: Heliod with Soul Warden and Ajani's Pridemate.
- Graveyard/recursion: Muldrotha with self-mill and recursion.
- Spellslinger: Young Pyromancer with instant and sorcery spells.
- Landfall: Lotus Cobra with other landfall engines; ordinary lands and generic ramp do not establish the package.
- Equipment: Puresteel Paladin with selected equipment and attachment support.

The two-other-participant rule remains. Declared family matches outrank incidental card tags, so Calix can be considered an enchantment engine rather than only a counter engine. Reminder text, one-shot populate, opponents-only triggers, removal that merely mentions a permanent type, mana rocks, and graveyard hate have negative controls. These are heuristic checks, not a general interaction solver or validation of every typal, Energy, or combo package.

The initial expansion ceilings were **three seeds/pages per pass**, **24 names per seed**, and **one collection POST of at most 72 unique names**. Session limits are **eight seed attempts/four background POSTs per deck** and **24/12 per tab**. At most 12 added JSON requests per deck session or 36 per tab can dispatch, excluding foreground work; cached attempts can reduce those totals. Saving, failures, cancellation, cache reuse, and foreground promotion retain the original accounting rules. Further increases still require explicit approval.

All foreground and background calls share **one active EDHREC request** and **two active Scryfall requests** per client/tab. Existing one-second/500-ms dispatch spacing, Retry-After cooldowns, queued cancellation, foreground priority, two-second settling delay, and no automatic background retries remain. Slots include full response-body transfer. Rejected EDHREC responses and Scryfall 429 bodies are cancelled before releasing their slot; other Scryfall bodies finish transferring first. Adapter checks hold responses and streaming bodies beyond the pacing interval to prove that slow providers cannot increase concurrency.

The same 86-card Anikthea partial deck and eight-card sideboard selected **Archon of Sun's Grace, Boon of the Spirit Realm, and Calix, Guided by Fate**, all for Enchantments. The live pass made **three source GETs and one 47-name collection POST**. It appended 37 eligible cards; **18 were absent from the complete commander pool**, established by a separate commander-page GET. Examples include Darksteel Mutation, Ajani's Chosen, Ghostly Dancers, and Kenrith's Transformation. Several additions are Aura-oriented; novelty and mechanical participation are not measured recommendation precision or player acceptance. The full 100-card deck still pauses enrichment.

Production checks cover three-seed overlap, 72 distinct cold names in one POST, warm hydration, revised deck/tab ceilings, malformed data, cancellations, cooldowns, eligibility, evidence, and all four queue goals. The original offline proof intentionally retains its historical two-seed/48-name scope. Rendered Chromium checks were repeated for late append, unchanged choices and deferrals, subsequent batches, saved-deck switches, silent 403 failures, complete-deck pause, light/dark/narrow layouts, and source-reference keyboard activation. Raw data, harnesses, and screenshots remain outside Git. Representative player review and broader mechanic relevance remain open.

## Rolling-hour recovery

This section records `f928509`, released together with the expanded mechanics. The user approved replenishing budgets rather than abandoning transient failures when a tab's lifetime allowance runs out. Limits are now **eight background source attempts/four collection POSTs per deck per rolling hour**, and **24/12 per tab per rolling hour**. Each actual dispatch receives a timestamp that expires after one hour. Deck and tab limits both apply at dispatch, including every retry. Failed or cancelled in-flight requests remain charged; cached work, cancellation while queued, provider-cooldown checks, and foreground promotion do not consume an extra background request. Saving aliases the same usage record rather than resetting it.

Network errors, HTTP 429, and 5xx responses remain pending. Backoff starts at **10 seconds**, doubles through 20/40/80/160 seconds, and is capped at **five minutes**, with up to 20% positive jitter within that cap. Usable, browser-exposed Retry-After can postpone work longer; an inaccessible or invalid 429 retry header retains the existing estimated 60-second cooldown. Both adapters expose transient status separately from malformed data and permanent HTTP errors; longer overlapping cooldowns cannot be shortened. HTTP 403/404, malformed JSON/schema, and missing or malformed individual card records are not automatically retried.

Source pages and hydration have separate checkpoints. Successful source data is reused while hydration waits, even across a rolling-hour budget pause; current exclusions are reapplied. This pending-work checkpoint is not a change to the ordinary 15-minute provider cache policy. A successful result is acknowledged only after the hook's committed-context merge. Cancellation or stale rejection therefore does not silently complete work that never reached the current queue. The active seed set is still capped at three, and each hydration run at 72 names in one POST.

One due-time timer resumes unfinished work, rather than polling throughout a cooldown or budget pause. The visible, idle partial-deck builder remains required. Hiding the tab aborts unused requests immediately; leaving the builder, switching decks, changing eligibility context, or reaching 100 main-deck cards stops that job. Pending checkpoints remain tab-local and resume only if their seeds are selected again. Existing one-EDHREC/two-Scryfall concurrency limits, dispatch spacing, foreground priority, neutral evidence, eligibility checks, visible choices, and queue deferrals remain unchanged.

`src/app/signature-retry.test.ts` checks exponential/capped jitter, provider cooldowns and 5xx Retry-After, terminal failures, source reuse, changed exclusions, cancellation, stale-result replay, spent retry allowance, and timer cancellation. The transport-cap check advances to one millisecond before and exactly at the rolling boundary to verify replenishment rather than resetting an entire hour. Recovery requires the provider to become available and the eligible builder to remain active; it is not guaranteed delivery and does not persist through reloads. No live rate-limit stress test is used.

Chromium checks with mocked providers confirmed 429 recovery, 503 hydration recovery without rereading sources, hidden-tab cancellation and visible-tab resumption, a saved-deck switch during cooldown, and automatic recovery at the rolling-hour boundary without another user edit. The header fixture explicitly exposes Retry-After through CORS; an unexposed-header probe confirmed the estimated 60-second fallback instead. The earlier light/dark/narrow queue and provenance checks also passed. Final validation passed 158 tests, lint, application typecheck, build, and standalone typechecks for the new retry check and original investigation script. Existing nonblocking React and bundle-size warnings remain.

## Engineering validation and player review packet (2026-10-04)

Inspected `bfc414d851d359ec0bebd1293348917811a80b24` on `chore/a6-validation`. No production A6 defect was demonstrated. One check-only gap was found: the blink negative control in `src/app/signature-actions.test.ts` omitted the required `toCard` reason argument. Supplying an empty reason makes that check typecheck without changing production behavior. Player relevance remains the acceptance gate; no player endorsement is recorded.

### Checked evidence and technical decisions

`pnpm test` passed all 220 tests; `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed. Existing React lint warnings and the large-bundle warning remain nonblocking. Application typecheck excludes tests, so the A6 checks were also checked separately:

```sh
pnpm exec tsc --ignoreConfig --noEmit --target es2023 --lib es2024,dom --types node --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --skipLibCheck --strict false --useDefineForClassFields false --jsx react-jsx scripts/a6-investigation.test.ts src/domain/signature-mechanics.test.ts src/app/signature-actions.test.ts src/app/signature-retry.test.ts src/adapters/request-scheduler.test.ts
```

The separate command uses Node 22's available APIs and type-stripping class-field semantics. It passes with the fixture argument corrected.

| Technical requirement                                                                  | Decision                 | Evidence checked                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select supported main-deck engines without selecting ordinary staples                  | GO for tested profiles   | `signature-mechanics.test.ts` covers eight expanded families and incidental wording; `signature-actions.test.ts` covers counters, blink, sacrifice, partner exclusions, and the supplied deck's structure. This is heuristic coverage, not useful-pick precision.                         |
| Produce eligible additions beyond the complete commander pool                          | GO for recorded examples | Historical Hamza/Roon/Meren comparisons and Anikthea live passes above. Counts and names were not refreshed; raw snapshots are outside Git.                                                                                                                                               |
| Preserve choices and use ordinary scoring in subsequent batches                        | GO                       | Merge/advancement checks in `signature-actions.test.ts` pass for all four goals, deferrals, ignored/selected/sideboard names, duplicate names, and chosen printings. The current price-cap and focused-batch checks also pass.                                                            |
| Retain neutral provenance and recheck eligibility                                      | GO                       | Same merge checks cover colour identity, legality, safety exclusions, set restrictions, persisted evidence, and multiple seed observations. No commander-synergy or source-score boost is invented.                                                                                       |
| Bound requests, rolling-hour usage, concurrency, pacing, and priority                  | GO                       | Source overlap/warm reuse and 3-GET/72-name/1-POST checks; actual deck/tab dispatch caps and exact rolling boundary; `request-scheduler.test.ts` holds slow requests/bodies and verifies priority and 500 ms Scryfall spacing. EDHREC remains serialized at the existing 1000 ms spacing. |
| Recover safely without retrying permanent failures                                     | GO                       | `signature-retry.test.ts` covers exponential/capped jitter, provider cooldowns, 5xx Retry-After, charged retries, source checkpoints, cancellation, foreground promotion, terminal failures, and one due-time timer. No live rate-limit stress test was made.                             |
| Stop hidden, complete, stale, or switched-deck jobs without disrupting foreground work | GO on existing evidence  | Current hook gates/context keys were inspected; cancellation, watcher, and stale-result replay checks pass. Rendered hidden-tab, same-commander switch, complete-deck pause, silent failure, and later-batch checks are the historical Chromium evidence above, not a new browser run.    |

Fetched `origin/publish` through SSH. Publish commit `ad541a26cb299cca284b27e1f930186a2b5ed031` records source `5829d809af37247bbc6dde46436b0f24bac88d35`. The deployed JavaScript `index-jauPgZWz.js` and CSS `index-C58_1Zxl.css` matched that commit byte-for-byte. This validates the published precision fix, not deployment of the newer inspected main commit. Nothing was merged or published.

No fresh Scryfall or EDHREC requests were needed. `scripts/recommendation-audit.ts` was inspected but not run: it makes direct provider calls with 100 ms collection pauses, is not an A6 check, and its pacing repair is already tracked under A15. Synthetic policy acceptance is not player acceptance.

### Representative-player packet

Use Balanced, the named theme, safety exclusions on, no set restriction, no price cap, and no role focus. Review the recorded candidates first; they are historical provider observations, not promises about today's queue or legality. Keep current eligibility filters if a player later reproduces a case through the app. Do not fetch raw pages outside the scheduler or raise allowances to fill a review list.

Only Anikthea is a supplied player deck. The other three cases are the named-card diagnostic partial decks above, not full decks submitted or endorsed by players. Sol Ring and Arcane Signet are staple controls in each diagnostic case. Source/seed associations below come from the recorded comparisons, not fabricated per-card evidence.

| Case and deck support                                                                                                                                                                                                | Seeds/source                                                       | Candidates to judge                                                           | Negative or limitation to discuss                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anikthea — Enchantments/tokens:** use the first 86 main-deck entries, including the commander, and all eight sideboard entries from `scripts/fixtures/a6-anikthea.txt`; keep the supplied 100-card original intact | Archon of Sun's Grace, Boon of the Spirit Realm, Calix; card pages | Darksteel Mutation, Ajani's Chosen, Ghostly Dancers, Kenrith's Transformation | The expanded pass used 3 GETs and one 47-name POST, with 37 eligible additions and 18 novel names. These examples are aggregate pass evidence, not a preserved candidate-to-seed mapping. Ask whether the Aura-oriented additions fit this player's plan. Full-deck enrichment stays paused. |
| **Hamza — counters:** Hardened Scales, Shalai, Abzan Falconer, Rishkar, Sol Ring, Arcane Signet                                                                                                                      | Hardened Scales; card page                                         | Hydra's Growth, Power Fist; also discuss Primal Vigor                         | Recorded counter connections warrant review, not approval. Primal Vigor also benefits opponents. Shalai's mostly Angel-oriented pool is the weak-source control; do not substitute an Angel package for the counter plan.                                                                    |
| **Roon — ETB/blink:** Panharmonicon, Brago, Mulldrifter, Soulherder, Sol Ring, Arcane Signet                                                                                                                         | Brago; commander page                                              | Cloud of Faeries, Helpful Hunter, Sea Gate Oracle, Circuit Mender             | Ask whether recurring entry/departure effects are useful here. Servant of the Conduit, Peema Aether-Seer, and Decoction Module are unsupported Energy controls, not useful merely because they mention ETB.                                                                                  |
| **Meren — sacrifice:** Pitiless Plunderer, Liliana, Viscera Seer, Blood Artist, Sol Ring, Arcane Signet                                                                                                              | Pitiless Plunderer; card page                                      | Mirkwood Bats, Marionette Apprentice, Ophiomancer                             | Ask whether token/death payoffs and recurring fodder help this plan. Liliana's Zombie/planeswalker associations and the reported Chatterfang combo are not automatic package or power-level approval.                                                                                        |

For each case, ask a representative player to identify which selected seeds express their intended engine. Then mark each candidate **would add**, **would consider**, **would reject**, or **cannot judge**, with a deck-specific reason and any missing support or power concern. Record player/date, deck/version, goal and exclusions, seed verdict, candidate verdicts, and overall **keep enrichment** or **prefer commander-first**. Leave those fields unfilled until a player answers. Novelty and a mechanical text match do not count as a useful verdict.

The remaining expanded families have labeled screening examples in `signature-mechanics.test.ts`: Etherium Sculptor/Thought Monitor (Artifacts), Heliod/Authority of the Consuls (Lifegain), Muldrotha/Victimize (Graveyard), Young Pyromancer/Opt (Spellslinger), Lotus Cobra/Felidar Retreat (Landfall), and Puresteel Paladin/Sigarda's Aid (Equipment). Anointed Procession/Call the Coppercoats and Sythis/Setessan Champion cover Tokens and Enchantments. These use abbreviated text and synthetic metadata; they are neither measured provider additions nor representative player decks. Broader relevance remains unvalidated rather than being inferred from these positive controls.

**Human decision: NO-GO for claiming improved relevance or closing player acceptance.** Ask representative players for the case verdicts above and decide which supported families merit keeping, further player review, or commander-first behavior. The technical GO results permit continued bounded use; they do not endorse every family or authorize more requests. If the user wants acceptance of all eleven families, the test-only families still need actual player decks and candidate review within the existing budget.

## What the sources provide

### EDHREC card pages exist, but differ from commander pages

The following first-party JSON pages returned HTTP 200:

- Commander pools: [Hamza][hamza], [Roon][roon], and [Meren][meren].
- Non-legendary engines: [Hardened Scales][scales], [Panharmonicon][panharmonicon], and [Pitiless Plunderer][plunderer].
- Legendary creatures: [Shalai][shalai] and [Brago][brago].
- Planeswalker: [Liliana, Dreadhorde General][liliana].
- Staple control: [Sol Ring][sol-ring].

The observed card-page route is `https://json.edhrec.com/pages/cards/<slug>.json`. Its `container.json_dict.cardlists` includes both `newcommanders`/`topcommanders` and ordinary card lists. **Do not pass every list to the current commander parser:** the first two lists describe commanders associated with the seed, not cards supporting the current deck. The pages also include a top-level `similar` array of card names. Similar cards can be alternatives rather than complementary engine pieces.

Ordinary card entries contain `name`, `slug`, `url`, `lift`, `num_decks`, and `potential_decks` in the sampled pages. They do not provide Oracle text, Commander legality, or colour identity. Scryfall hydration remains necessary. `highliftcards` is not the commander's `highsynergycards`, and `topcards` on a card page must not become `Commander favourite`.

[EDHREC's FAQ][faq] defines commander/theme synergy as the difference between inclusion percentages for that commander/theme and its colour identity. The follow-up found [EDHREC's explanation of lift][lift]: card-to-card lift compares observed co-occurrence with independent occurrence, accounting for colour-compatible decks and card availability dates. Raw lift is centred on 1; the UI displays `log10(lift)`, centred on 0. The article reports a median raw lift of 1.58 and warns about uncommon pairings and imperfect source decks. Do not treat raw lift as a probability, verified interaction, or interchangeable commander score.

An explicit-origin GET for Hardened Scales returned `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=1620, stale-while-revalidate=180`, and an ETag. This supports client-side GET access for that response, not a supported public API contract. The guessed `commanders/pitiless-plunderer.json` returned HTTP 403, not 404. Do not assume non-commanders have commander pages or interpret every unavailable response as a missing card.

### Scryfall imposes limits beyond A5's deduplication

[Scryfall's current rate-limit documentation][rates] specifies 500 ms spacing for `/cards/search`, `/cards/named`, `/cards/random`, and `/cards/collection`; other methods generally allow 100 ms spacing. The [collection endpoint][collection] accepts at most 75 identifiers and warns against matching results by array position when some names are missing. [API rules][api] require Accept and User-Agent headers; browser clients keep the browser's User-Agent.

The rate-limit page says a 429 limits access for 30 seconds, requires clients to reduce overages, and encourages caching for at least 24 hours. A5's 15-minute, tab-local cache is useful reuse, but is shorter than that recommendation and is not a request scheduler. Review that policy separately rather than silently changing it in A6.

## Bounded candidate comparison

Three hand-built partial decks exercise counters, ETB/blink, and sacrifice. These are small diagnostic fixtures, not complete player decks or evidence of improved deck performance:

- **Hamza:** Hardened Scales, Shalai, Abzan Falconer, Rishkar, Sol Ring, Arcane Signet; declared theme `+1/+1 counters`.
- **Roon:** Panharmonicon, Brago, Mulldrifter, Soulherder, Sol Ring, Arcane Signet; declared theme `ETB`.
- **Meren:** Pitiless Plunderer, Liliana, Viscera Seer, Blood Artist, Sol Ring, Arcane Signet; declared theme `Sacrifice`.

Counterspell is an additional non-engine control. Sol Ring and Arcane Signet serve as ordinary-staple controls in each fixture.

The raw commander pools contain 220, 234, and 256 unique names respectively. Candidate novelty is measured against **all** those names, not merely the visible batch. The comparison uses two shortlists per seed:

1. **Highest lift:** take at most 24 novel entries with finite lift and at least 100 observed decks, sorted by lift.
2. **Mixed:** start with novel `similar` names, then take up to two novel entries per remaining list, sorted by lift within each list with at least 100 decks. Fill spare slots from the highest-lift list and cap at 24. Preserve the source list order. Exclude `newcommanders`, `topcommanders`, `gamechangers`, `lands`, `utilitylands`, and `manaartifacts` from both methods.

Exclude commander-pool names, the commander, the current seed, and fixture peers before shortlisting. After hydration, exclude all fixture deck names again and require current Commander legality, the commander's colour identity, released status, no game changers, no library-search tutors, and no extra turns. These use the existing text-based exclusion conventions. The partial decks contain no sideboard, ignored cards, deferrals, or collection restriction; those behaviors are not tested by this comparison.

| Commander | Seed               | Highest lift: eligible / theme matches | Mixed: eligible / theme matches |
| --------- | ------------------ | -------------------------------------: | ------------------------------: |
| Hamza     | Hardened Scales    |                                  0 / 0 |                           6 / 4 |
| Hamza     | Shalai             |                                  2 / 0 |                           8 / 1 |
| Roon      | Panharmonicon      |                                  9 / 4 |                           9 / 3 |
| Roon      | Brago              |                                  5 / 0 |                          12 / 0 |
| Meren     | Pitiless Plunderer |                                  0 / 0 |                           4 / 4 |
| Meren     | Liliana            |                                  4 / 1 |                          10 / 3 |

Every shortlist contains 24 names. Eligible counts include legal cards without the declared theme tag. Theme-match counts use production `toCard()`/`tagsFor()`, followed by `buildRecommendationContext()` and `rankRecommendationCards()`. Scores use Balanced, deck-health priority off, no preferences, and a neutral `Seen with <seed>` reason rather than inventing commander evidence. Front-face names are matched to Scryfall's combined names before evaluation; the existing EDHREC builder's exact-name map does not perform that reconciliation.

Across the mixed shortlists, deduplicated theme matches total four for Hamza, three for Roon, and seven for Meren. Examples:

- Hardened Scales adds **Benevolent Hydra**, **Invasion of Gobakhan**, **Invasion of Moag**, and **Elspeth Resplendent** beyond Hamza's raw pool. Shalai's only theme match duplicates Invasion of Gobakhan.
- Panharmonicon adds **Servant of the Conduit**, **Peema Aether-Seer**, and **Decoction Module**. They have ETB text, but all concern Energy. Tag overlap alone is not evidence that Roon needs an Energy package.
- Pitiless Plunderer adds **Pawn of Ulamog**, **Sifter of Skulls**, **Ruthless Knave**, and **Revel in Riches**. These are plausible death/treasure connections, but the similar-card list supplies all four as possible alternatives. Liliana supplies three further planeswalker matches, not proof that a sacrifice deck benefits from a planeswalker package.

The mixed examples score 27–32 in Hamza/Roon and 29–32 in Meren, below the current 45-point `recommended` threshold in these contexts. No source-only boost was added. The result demonstrates additional eligible names, not validated useful recommendations.

### Requests used

The investigation made 12 EDHREC JSON requests: three commander pages, seven distinct card pages, one unavailable commander-path probe, and one repeat GET to inspect explicit-origin CORS. Eleven returned 200 and one returned 403. Requests were sequential; the multi-page probe used a one-second pause. Further EDHREC probing initially stopped after reviewing the terms; that pause reflected the unconfirmed interpretation corrected above. Three EDHREC HTML pages supplied the card presentation, FAQ, and terms.

Both shortlist methods, fixture cards, and controls needed 235 unique Scryfall identifiers in four collection POSTs of 75/75/75/10. Dispatches were sequential with a 650 ms pause after each completed POST. All identifiers resolved; no retries or printing requests were needed. This is the cost of comparing six seeds and two methods, not the proposed application budget below.

Raw provider responses and comparison scripts stayed outside Git. The table is a dated observation. To reproduce, use the linked pages, fixture names, shortlist rules, exclusions, and ranking context above, with sequential, paced requests rather than a broad crawl. Data and counts can change.

## Follow-up: co-occurrence and seed commander pages

### Better shortlists within the same 24-name cap

The follow-up reuses the three partial decks and initial card-page snapshots. A new shortlist uses only `creatures`, `instants`, `sorceries`, `utilityartifacts`, `enchantments`, `planeswalkers`, and `battles`. Exclude the complete current commander pool and all fixture deck names first. Require at least 100 observed decks and raw lift of at least 1.5, sort by `num_decks` descending, and take at most 24 names. Do not start with `similar` alternatives or the global highest-lift list. The 1.5 floor is experimental, not a claim of strong association.

For commander-eligible seeds, also compare their actual commander pages: [Shalai][shalai-commander] and [Brago][brago-commander] both returned 200. Use the same ordinary-card categories, require at least 100 decks and positive commander-page synergy, then sort by that synergy and cap at 24 novel names. This is evidence from decks led by the seed, not synergy with the user's current commander. Do not label it `Commander synergy` in the app.

Apply the initial legality, identity, release, game-changer, tutor, and extra-turn checks. The linked-card predicate is broader than the initial exact theme-tag count: counters match `+1/+1 counters`; ETB accepts ETB/blink/trigger-multiplier wording but rejects Energy without deck support; sacrifice accepts the existing Sacrifice tag or creation of creature-token fodder. These are screening counts, not measured precision:

| Seed               | Source / shortlist        | Eligible | Linked |
| ------------------ | ------------------------- | -------: | -----: |
| Hardened Scales    | Card page / co-occurrence |        5 |      4 |
| Shalai             | Card page / co-occurrence |       14 |      0 |
| Shalai             | Commander page / synergy  |       23 |      2 |
| Panharmonicon      | Card page / co-occurrence |       19 |      2 |
| Brago              | Card page / co-occurrence |       17 |      7 |
| Brago              | Commander page / synergy  |       21 |      9 |
| Pitiless Plunderer | Card page / co-occurrence |       13 |     10 |
| Liliana            | Card page / co-occurrence |       19 |     11 |

Rules-text review finds concrete gains beyond the complete current commander pools:

- **Hardened Scales:** Hydra's Growth repeatedly doubles counters; Power Fist puts counters on the equipped creature after combat damage. Both support the chosen counter engine. Primal Vigor also matches, but benefits opponents; it needs an honest explanation, not automatic approval.
- **Brago:** Cloud of Faeries untaps lands on entry; Helpful Hunter and Sea Gate Oracle supply repeatable card access; Circuit Mender rewards entry and departure. Brago's commander page finds these creature-based additions without using an unrelated Energy package. The card page also finds blink tools such as Planar Incision and Phelia.
- **Pitiless Plunderer:** Mirkwood Bats rewards token creation/sacrifice, Marionette Apprentice rewards creature/artifact deaths, and Ophiomancer supplies recurring creature fodder. These have direct connections to the selected death/treasure engine. The seed page also explicitly lists a [Chatterfang interaction][chatterfang-combo]; combo evidence must not imply a suitable power level for every deck.

Important negatives remain. Shalai's source pools largely favour Angels rather than Hamza's counter plan. Panharmonicon's linked additions include Kindred Discovery and Caretaker's Talent, which need typal/token support absent from this fixture. Liliana's pool includes Zombie-specific cards and opponent-sacrifice effects; neither should qualify solely because of a broad Sacrifice tag. Token reminder text also makes Tireless Provisioner appear connected. Require a concrete deck/seed connection after hydration rather than admitting every linked count above.

New examples still use the ordinary shared scorer and neutral `Seen with <seed>` evidence. Their low scores in the tiny, preference-free fixtures are not a source failure: the badge threshold is a fit heuristic, not an eligibility gate. Do not inflate source scores to make a trial look successful.

The comparison added two EDHREC JSON GETs and three Scryfall collection POSTs for 162 uncached names, in batches of 75/75/12 with the same 650 ms pauses. All names resolved. It compares eight shortlists; the released baseline admitted only two seeds and at most 48 hydration names.

### The deck-conditioned Recs endpoint is not a direct client-side alternative

The first-party [Recs page][recs] accepts a commander and deck list. Its [published page client][recs-client] calls `POST https://edhrec.com/api/recs`; the shared client also uses that route for clipboard recommendations. A public, unauthenticated request with `commanders: ["Hamza, Guardian of Arashin"]`, `cards: []`, and `options: { excludeLands: true, offset: 0 }` returned 100 recommendations. Commander objects instead of strings returned an `errors` body despite HTTP 200. Validate the payload shape, not just response status.

For `Origin: https://commander-creator.corke.dev`, neither the JSON POST nor the OPTIONS preflight exposed `Access-Control-Allow-Origin`. The OPTIONS response returned 200 but no cross-origin grant. This endpoint therefore cannot be called directly by the deployed app's browser under the observed CORS policy. That is a technical limitation of this alternative source, not a permission blocker for A6's working JSON-page sources. Do not add a proxy while those sources can support the bounded trial. The site's Load More control is patron-gated; no pagination or gated-access workaround was attempted.

Discovery used one HTML page, two published JavaScript assets, one invalid-payload POST, one successful POST, and one OPTIONS request. The lift article required one further HTML GET. These discovery requests are separate from the candidate-comparison budget.

### Runnable offline proof

Run `node --experimental-strip-types --test scripts/a6-investigation.test.ts`. The [investigation-only check](../scripts/a6-investigation.test.ts) makes no real provider requests and is not imported by application code.

- Narrow engine-wording profiles select Hardened Scales/Shalai, Panharmonicon/Brago, and Pitiless Plunderer/Liliana in the labeled fixtures. A seed needs two other mechanic participants. Ordinary mana rocks, Counterspell, lands, an off-theme legend, unsupported themes, and a lone engine do not generate seeds. Existing fit scores break ties; legendary/planeswalker status earns no bonus.
- `isCommanderCandidate()` identifies Brago but not Liliana as eligible for the commander-page route. Reuse this helper, not a blanket Legendary test. The check uses single-commander fixtures; partner handling is not proven here.
- A local pending-pool append preserves the current four cards, decisions, likes, and deferred records. It blocks accepted, ignored, sideboard, pending, deferred, and duplicate incoming names, including a front-face/combined-name duplicate. Generation mismatches discard old work, including a switch between decks with the same commander name.
- Production queue advancement accepts the appended candidates for all four goals and preserves the tested Later, undecided, and existing-deferred eligibility batches. The proof does not add an asynchronous React hook, revalidate incoming legality/collection rules, merge persisted source evidence, or test browser races.
- A5's production resolver makes one mocked POST for 48 cold identifiers and zero additional POSTs on a warm repeat with overlapping identifiers. This proves the hydration calculation, not global request scheduling or retry ceilings.

## Seed selection needs more than legendary status

A cheap shortlist should use existing main-deck metadata before making any seed request. Exclude commanders, sideboard cards, lands, and ordinary fixing/ramp staples. Prefer a card that supports an explicit theme or a demonstrated interaction with other selected main-deck cards. Use current fit scores as a tie-break, not the sole seed criterion: those scores reward role gaps and mana fit, not engine influence.

At the investigation baseline, the shared helpers had these limits:

- Panharmonicon receives only `Artifacts`, not `ETB`, despite multiplying ETB triggers. Its Oracle wording is “If an artifact or creature entering causes a triggered ability…”, outside the current ETB matcher.
- Brago receives `Blink`, not `ETB`. Direct equality with a single selected theme misses a relevant supporting mechanic.
- `findSynergyPair()` does not detect Pitiless Plunderer or Liliana with Viscera Seer in these fixtures. The sacrifice-outlet pattern accepts “sacrifice creature” or “sacrifice another creature”, not Viscera Seer's “Sacrifice a creature”. Its existing blink/ETB coverage also cannot validate the Roon seeds.
- Sol Ring receives `Artifacts` and `Big mana`; Arcane Signet receives `Artifacts`. Theme tags alone would select ordinary mana rocks for an Artifacts deck. Shalai's legendary status does not rescue its largely off-theme results.

Reuse and narrowly improve supported interaction/tag rules as the investigation continues. Do not add a blanket legendary/planeswalker bonus, select every card with `Artifacts`, or infer a signature from generic popularity. A seed must name its relevant deck connection. The trial narrowly improves the shared ETB and sacrifice matchers rather than copying the investigation's selection profiles.

## Request budget used for the trial

These historical ceilings describe the released baseline, not published EDHREC limits. The approved expansion and rolling-hour recovery above replace them:

- Select at most **two seeds per pass**, after deck choices settle for two seconds. Require two other main-deck cards supporting the intended mechanic. Do not force a second seed to fill the allowance; Shalai demonstrates that a relevant in-deck engine can still yield a weak source shortlist. Rerun only when the selected seed set or eligibility context changes, not on printing changes or every render.
- Permit at most **four distinct seed attempts per deck per tab session**, and at most **12 across the tab**. Record dispatched attempts even after failure or cancellation. Returning to a deck, removing/readding a seed, refreshing options, or changing goals must not reset its allowance.
- Read at most **two EDHREC seed pages per pass**, with one request in flight and at least one second between dispatches, subject to stricter provider guidance. Choose only one source page per seed attempt: card-page co-occurrence, or a commander page for a suitable commander-eligible seed. A missing page is skipped without a second source request. Reuse successful raw pages and in-flight work by page kind plus card slug, so card and commander JSON cannot collide; do not cache ranked results. Missing, forbidden, and malformed pages are skipped without automatic background retry.
- Select at most **24 novel hydration names per seed**, deduplicate them across both seeds, then use A5's shared resolver. At most 48 names require **one collection POST per pass**, or zero when warm. Do not fetch printings or extra search pages for background results.
- Cap background collection dispatches at **two per deck session** and **six per tab**. This yields at most six added JSON requests per deck session and 18 per tab, excluding existing foreground work. Count actual transport attempts, including retries, against those ceilings. Disable automatic background retries if the shared transport cannot account for them.
- Route foreground and background dispatch through the same provider scheduling point. Give queued foreground work priority; use at least 500 ms between Scryfall dispatches as a simple safe starting policy. A background job cannot bypass the existing shared 429 cooldown. EDHREC 429 responses also need a provider-wide cooldown, respecting usable Retry-After advice; no background retry occurs automatically.

The one-pass budget is two source GETs plus at most one hydration POST. Debouncing alone is insufficient: attempts, concurrency, retry accounting, and session ceilings must all be enforced before dispatch. The user subsequently approved the expanded ceilings above. Future increases still require explicit approval and evidence of useful additions.

## Baseline integration gaps and release checks

These gaps describe `917133f`, before the trial. The implementation above closes the scheduling, evidence, and queue-integration gaps; player acceptance remains open. Relevant baseline modules:

- [`src/adapters/edhrec.ts`](../src/adapters/edhrec.ts) only fetches commander pages. It has no AbortSignal, page validation, session deduplication, dispatch pacing, or provider cooldown.
- [`src/adapters/scryfall.ts`](../src/adapters/scryfall.ts) supplies A5's raw cache, identifier deduplication, shared cancellation, 75-name batches, and 429 cooldown. Separate resolver calls can still dispatch concurrently, and sequential batches have no explicit rate pacing. Its retrying collection transport can issue up to three attempts.
- [`src/app/recommendation-actions.ts`](../src/app/recommendation-actions.ts) hydrates commander lists and updates commander sub-themes as a side effect. Do not reuse `edhrecRecommendations()` unchanged for card seeds. Card-page lists need their own validation, identity check, and evidence interpretation; `buildEdhrecRecommendations()` does not check colour identity.
- [`src/domain/recommendation-queue.ts`](../src/domain/recommendation-queue.ts) owns batching and deferrals. [`src/features/builder/interactions.ts`](../src/features/builder/interactions.ts) advances it locally. Keep the current `queue.slice(0, 4)` untouched when late results arrive; merge only into pending candidates, then rank on normal advancement with the latest shared context. Do not reset decisions, likes, batch number, or deferred eligibility.
- [`src/domain/recommendation-types.ts`](../src/domain/recommendation-types.ts) stores only a broad source label. Add optional per-seed/list/page evidence if implemented, and extend [`src/deck-state.ts`](../src/deck-state.ts) so saved candidates retain it. Keep multiple source observations when deduplicating; never convert card-page popularity into commander synergy.
- [`src/app/deck-actions.ts`](../src/app/deck-actions.ts) changes and loads decks. Invalidate background jobs on deck switch, start over, commander changes, and relevant context changes. Abort unused work and reject late results with a generation check; checking only commander name would mix two saved decks using the same commander.

Before merging late results, recheck current legality, identity, exclusions, collection mode, main deck, sideboard, ignored names, visible batch, pending pool, and deferred names. Match front-face/combined names consistently. Deferred cards keep their existing cooldown; accepted or ignored cards cannot return. Background failure must not set the foreground recommendation state to error, clear the queue, or trigger fallback requests.

At baseline, the source comparison and local proof left these checks outstanding. Runtime transport, queue, and browser checks are now covered above; player acceptance remains open:

1. Reuse or narrowly improve the shared tag/interaction helpers rather than copying the investigation's regex profiles into production. Expand labeled checks to fuller decks, partner decks, other mechanics, false-positive text, and source availability failures.
2. Player review confirms useful additions in representative decks within the pass budget. Reject Energy, typal, Zombie, and planeswalker packages when the deck has no reason to support them. The investigation's rules-text review is not player acceptance.
3. Mocked adapter-boundary checks measure cold/warm requests, overlapping seeds, repeated edits, failures, Retry-After, hidden headers, retry ceilings, cancellation, and same-commander deck switches. No live rate-limit stress test is needed.
4. Queue checks prove late arrivals leave all current choices stable, preserve Later/undecided cooldowns, keep ignored and selected cards out, merge source evidence, and use the same goal-aware ranking for later batches. Browser checks confirm foreground responsiveness and silent background failure.

[recs]: https://edhrec.com/recs
[recs-client]: https://cloudflare.edhrec.com/_next/static/chunks/pages/recs-d87dc4ad181f70ac.js
[lift]: https://edhrec.com/articles/from-synergy-to-lift-the-math-behind-edhrecs-new-era
[shalai-commander]: https://json.edhrec.com/pages/commanders/shalai-voice-of-plenty.json
[brago-commander]: https://json.edhrec.com/pages/commanders/brago-king-eternal.json
[chatterfang-combo]: https://edhrec.com/combos/golgari/3000-4871
[terms]: https://edhrec.com/terms
[faq]: https://edhrec.com/faq
[hamza]: https://json.edhrec.com/pages/commanders/hamza-guardian-of-arashin.json
[roon]: https://json.edhrec.com/pages/commanders/roon-of-the-hidden-realm.json
[meren]: https://json.edhrec.com/pages/commanders/meren-of-clan-nel-toth.json
[scales]: https://json.edhrec.com/pages/cards/hardened-scales.json
[panharmonicon]: https://json.edhrec.com/pages/cards/panharmonicon.json
[plunderer]: https://json.edhrec.com/pages/cards/pitiless-plunderer.json
[shalai]: https://json.edhrec.com/pages/cards/shalai-voice-of-plenty.json
[brago]: https://json.edhrec.com/pages/cards/brago-king-eternal.json
[liliana]: https://json.edhrec.com/pages/cards/liliana-dreadhorde-general.json
[sol-ring]: https://json.edhrec.com/pages/cards/sol-ring.json
[rates]: https://scryfall.com/docs/api/rate-limits
[collection]: https://scryfall.com/docs/api/cards/collection
[api]: https://scryfall.com/docs/api

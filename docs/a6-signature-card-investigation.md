# A6: Signature-card investigation

Investigated on 2026-09-30 against `917133f`; the user subsequently approved the bounded trial. The source comparisons below describe the baseline. The implemented trial and its validation are recorded separately.

## Decision

**The bounded trial is implemented.** Source comparisons and the offline proof supported the user's go-ahead for counters, blink/ETB, and sacrifice. Runtime checks now cover request scheduling, cached hydration, eligibility, persisted evidence, and late queue integration. Player acceptance and broader mechanic coverage remain unproven.

A6's requests serve the user's commander selection and subsequent deck-building choices, rather than an independent crawler. [EDHREC's terms][terms] restrict automated requests, copying, redistribution, and access to build similar or competitive sites. The investigation did not establish that those restrictions prohibit this user-driven integration. The initial report overstated that uncertainty as a permission blocker. Treat the terms as an integration risk, not a requirement to obtain permission before continuing A6. Keep requests bounded and respect provider responses.

The initial comparison exposed off-colour candidates, unrelated theme associations, and missed engine tags. The trial uses only the three tested mechanics; an unsupported mechanic never triggers a seed request. Selected main-deck support can establish one of those mechanics even when the declared theme is different, as in the supplied Anikthea deck.

## Implemented trial

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

Remaining work is player review across representative decks, especially weak source pools such as Shalai's, before broader mechanics or higher limits. Provider JSON and observed CORS remain undocumented integration risks. The separate 24-hour Scryfall cache-policy review remains open; A6 does not silently replace A5's 15-minute policy.

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

The comparison added two EDHREC JSON GETs and three Scryfall collection POSTs for 162 uncached names, in batches of 75/75/12 with the same 650 ms pauses. All names resolved. It compares eight shortlists; an application pass still admits only two seeds and at most 48 hydration names.

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

These are application ceilings for evaluation, not published EDHREC limits:

- Select at most **two seeds per pass**, after deck choices settle for two seconds. Require two other main-deck cards supporting the intended mechanic. Do not force a second seed to fill the allowance; Shalai demonstrates that a relevant in-deck engine can still yield a weak source shortlist. Rerun only when the selected seed set or eligibility context changes, not on printing changes or every render.
- Permit at most **four distinct seed attempts per deck per tab session**, and at most **12 across the tab**. Record dispatched attempts even after failure or cancellation. Returning to a deck, removing/readding a seed, refreshing options, or changing goals must not reset its allowance.
- Read at most **two EDHREC seed pages per pass**, with one request in flight and at least one second between dispatches, subject to stricter provider guidance. Choose only one source page per seed attempt: card-page co-occurrence, or a commander page for a suitable commander-eligible seed. A missing page is skipped without a second source request. Reuse successful raw pages and in-flight work by page kind plus card slug, so card and commander JSON cannot collide; do not cache ranked results. Missing, forbidden, and malformed pages are skipped without automatic background retry.
- Select at most **24 novel hydration names per seed**, deduplicate them across both seeds, then use A5's shared resolver. At most 48 names require **one collection POST per pass**, or zero when warm. Do not fetch printings or extra search pages for background results.
- Cap background collection dispatches at **two per deck session** and **six per tab**. This yields at most six added JSON requests per deck session and 18 per tab, excluding existing foreground work. Count actual transport attempts, including retries, against those ceilings. Disable automatic background retries if the shared transport cannot account for them.
- Route foreground and background dispatch through the same provider scheduling point. Give queued foreground work priority; use at least 500 ms between Scryfall dispatches as a simple safe starting policy. A background job cannot bypass the existing shared 429 cooldown. EDHREC 429 responses also need a provider-wide cooldown, respecting usable Retry-After advice; no background retry occurs automatically.

The one-pass budget is two source GETs plus at most one hydration POST. Debouncing alone is insufficient: attempts, concurrency, retry accounting, and session ceilings must all be enforced before dispatch. A later broader scan needs measured gains before increasing these limits.

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

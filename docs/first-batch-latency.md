# First-batch critical path (#207)

Measured on base `b675c0d01417f4613797e7851c7b1980efbcd497` plus this change, with the synthetic records in `scripts/fixtures/b10-browser.ts`, theme Tokens, high power, no exclusions, no collection restriction, and the optional local index held indefinitely.

Run `node --experimental-strip-types scripts/measure-first-batch.ts`. It uses production recommendation actions, provider adapters, caches and dispatch pacing with immediate synthetic responses. It reports each dispatch and stage duration. It measures pool readiness, not browser rendering or real network latency.

A sequential cold/warm run measured:

- Cold: 2,090 ms, six requests (five Scryfall, one EDHREC). Scryfall dispatches occurred at 22, 547, 1,063, 1,576 and 2,081 ms. EDHREC dispatched at 549 ms.
- Warm provider caches in the same process: 11 ms, zero requests. The optional index remained held in both runs.
- Commander resolution, commander printings, EDHREC page and candidate hydration, theme, mechanic (when applicable), and uncovered role searches remain before initial ranking. The fixture needs no separate mechanic search. All these stages supply current data or ranking evidence; none was removed or moved into background transport.
- Optional local loading/coverage is deferrable. Ready local data joins the pool; late local data is prepared with the same exclusions and construction checks, buffered, and merged after a settled next-batch boundary. It cannot replace the visible batch. New pool builds retain stale-index release searches; index completion does not launch new live searches outside a pool boundary.

Target for this bounded immediate-response fixture: cold pool ready within 4 seconds, warm within 250 ms when run alone. These are diagnostic budgets allowing scheduling/CPU overhead above the observed ~2-second pacing floor, not production network promises. The browser gate retains a 60-second functional timeout rather than enforcing this performance target. Startup hydration and automatic printing lookups also share pacing and can make navigation-to-visible-batch substantially slower; the browser gate logs its separate timings and dispatch list.

Before: #204's held-artifact probe produced no first batch within 60 seconds on the old head. After: the progressive browser gate renders four live cards while the index remains unloaded, then verifies delayed enrichment or missing/failed fallback without changing those cards or a Later decision. `pnpm check:planned-fetches:browser` also passes, preserving idle silence, held signature boundaries and one settled advancement.

This resolves the production blocker reported by #204 and restores #151's progressive behavior. It does not claim recommendation-quality improvement or resolve #151's broader corpus/mobile evaluation.

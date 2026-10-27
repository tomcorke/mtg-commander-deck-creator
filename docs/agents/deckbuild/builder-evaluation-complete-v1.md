# Completed candidate evaluation, prompt v1

One Codex `gpt-6.1-sol` builder with `reasoningEffort: low` progressed the [first partial evaluation](builder-evaluation-v1.md) to a 100-card candidate using the unchanged [builder prompt v1](builder.md). A separate fresh session reviewed the completed deck with best-effort isolation. This is one candidate and one desk review, not the repeated baseline round required by [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Assignment and evidence

The fixed Krenko, Mob Boss brief, bracket-2 intent, Goblin combat idea, settings, seed and initial prepared pool are unchanged from slice 15. Total budget/per-card cap remain null; allowed sets and required/excluded names remain empty. The original low-mana Goblin pool is deliberately narrow. Settings and targets are app heuristics, not bracket certification.

The prior 24-command run had exhausted its pinned bounds. A separately identified recording at the SHA below carried those 24 choices forward verbatim with fresh provider outcomes, then selected new commands after inspecting each report. Only the input recommender SHA, snapshot identity and source description changed; `provenance.json` retains the exact pin differences. The initial prepared pool still comes from slice 15: this is not a wholly refreshed provider snapshot or an independent builder repeat.

The new assignment allowed 500 commands, 100 batches, 60 extensions, 120 seconds per invocation and 20 minutes overall. The confirmed prefix contains 91 commands (24 carried forward, 67 new), six extensions, eight batches and 19 HTTP occurrences. It reached 100 cards with no sideboard. The builder deliberately cleared land focus, developed nonland roles through offered decisions and recorded searches/lookups, then added 32 further Mountains through separate `addRetrieved` actions referencing existing recorded evidence. It authored no replacement card payloads.

| Identity                         | Recorded value                                                     |
| -------------------------------- | ------------------------------------------------------------------ |
| Clean evaluation HEAD            | `2806f47ce9bde02cd847f01f9b2206f9716c1a9e`                         |
| Prompt v1 SHA-256                | `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b` |
| Knowledge-base commit            | `5b1412c6b304cff9369b393b42d2197aca622a12`                         |
| Final builder manifest           | `fa6436730e9a402ad64ca1e281095544c0d3fbf8d1427e6a482da92c819dee43` |
| Final report/replay file SHA-256 | `71983a342b6ecdc039e04692af95fd875c0e984e48fe5bc7e6ead279b293d300` |
| Review bundle hash               | `5545797c22e2aff88867aa0997b9e2c3b7a4f745b68a0df589ee6047aefe3715` |

Evidence lives outside Git at `E:/working/agent-sandbox/research/deckbuild/issue-98-slice-16-completion/`. The hash inventory is `manifest.json`; provenance, assignments, original/new pins, every append/combined log/report, provider responses, commands/actions, deck, feedback and knowledge gaps are retained. `completed-review-input.json` and `completed-review-output.json` retain the construction input and ready result. `oracle-provenance.json` maps raw card evidence and printing differences. `review-session/` retains staged-input hashes, operator configuration, actual task receipt and validated `result.json`. The initial setup-only failure is separately preserved at `issue-98-slice-16/`; installing frozen dependencies repaired the missing `zod` environment before the fresh session.

## Completed prefix and construction

The candidate contains 33 Mountains and three utility lands: 36 lands, 64 nonlands including the commander, 68 distinct names. Shared role analysis reports 11 ramp, 11 draw, 13 removal and three wipes; these overlapping heuristic counts do not measure spell quality. The builder's choice of 36 lands is a desk estimate.

The final replay replaced `globalThis.fetch` with a throwing function and matched the entire completed report. The completed-review preparation gate returned `ready`, using retained raw Oracle objects for all 100 entries, including repeated basics. A final joined-name Fable lookup was partial; its Oracle evidence instead comes from the original retained slice-15 response, with source/hash recorded. Gate lookup printings can differ from selected builder printings; this spec has no printing or price constraints. The gate supports construction under supplied metadata and shared checks, not universal legality, current-policy certification or bracket placement.

The operator checked every file hash in the builder inventory, independently reran the network-disabled replay and construction gate, and validated the returned review against the unchanged staged bundle. These checks establish artifact consistency, not provider authenticity or judgement quality.

All 19 manifest transport outcomes were HTTP 200; two card lookups were partial. Provider success and command completion are separate. The final manifest excludes any unconfirmed later work. Replay requires the recorded evaluation HEAD; later documentation commits correctly fail its version check. Reproduce from a clean checkout at that SHA with the retained store and command log.

## Desk review

The existing review-session runner staged only the projected deck/spec, Oracle evidence, unchanged reviewer/rubric/session contracts and approved rules/policy copies. A fresh Codex `gpt-6.1-sol`/low task returned a review validated by `finishReview`. It reported no observed contamination and generic ambient host instructions, skill catalog, workspace/branch, repository instructions and routing metadata. Restrictions were instructions, not enforced access controls; this does not satisfy enforced-isolation acceptance.

| Criterion     | Score / 5     | Confidence |
| ------------- | ------------- | ---------- |
| Bracket fit   | 3; unresolved | Low        |
| Effectiveness | 4             | Medium     |
| Theme fit     | 5             | High       |
| Idea fit      | 5             | High       |
| Fun           | 4             | Medium     |
| Synergy       | 4             | Medium     |

The reviewer identified Krenko, Goblin Chieftain, Idol of Oblivion and Goblin Trashmaster as strongest, and Goblin Replica, Goblin Researcher and Battle-Scarred Goblin as weakest. These are relative desk judgements backed by Oracle citations in the retained review, not independent ranking labels or gameplay evidence. No swaps were proposed because outside-deck replacement evidence was absent.

Bracket fit remains unresolved: the reviewer found no intentional two-card infinite-combo, extra-turn or mass land-denial package in supplied text, but haste-enabled Krenko growth could pressure the intended pace. This is not an exhaustive interaction audit. Policy references were checked on 2026-10-03 and were not freshly verified. The review requests representative multiplayer pacing/rebuilding evidence, a policy-currency check and separately recorded replacement-card evidence. No new rules or policy fact was established here.

## Failures and triage

- **Overall bound breached:** report 6 completed at `2026-10-27T21:08:01.405Z`, 245.925 seconds after setup. Extension 7 submitted one additional lookup at `21:08:08.446Z`; output collection failed with `write_stdin failed: Unknown process id 83066`, recorded at `23:13:56.326Z`. The roughly two-hour gap has no established cause. Finalization occurred after 7859.357 seconds, outside the 20-minute assignment. This session is not evidence of overall bound compliance.
- **Unconfirmed work:** 92 commands/seven extensions were submitted; only 91/six are confirmed. No report 7 was available when the authoritative prefix was selected. Its attempted append/choice is retained separately; no new recording or extension followed the detected error. The replay claim covers report 6 only. Session supervision/output collection needs further work in #98; the completed prefix does not excuse the bound breach.
- **Retrieval and steering:** clearing prior land focus restored offers. Recorded lookup/search filled roles missing from the deliberately narrow pool; one search retained `hasMore=true`, so no exhaustive-retrieval claim follows. Artifact/Treasure suggestions were deferred when they distracted from Goblin combat. This is offer composition evidence, not proof of a ranking defect.
- **Ranking research:** explain results and source states remain available for [#105](https://github.com/tomcorke/mtg-commander-deck-creator/issues/105). An explain after selection does not establish the earlier ranking cause. No recommender mechanism changed, and no keep/reject quality conclusion follows from one review.

Complete suites/holdouts, independent repeated builds, reviewer-noise measurement, labelled ranking benchmarks, policy/pacing follow-ups, workflow supervision and remaining acceptance stay in #98. Keep that issue open. No live app behavior or publishing changes are part of this evaluation.

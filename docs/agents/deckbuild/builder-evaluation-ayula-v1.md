# Ayula candidate evaluation, prompt v1

A Codex `gpt-6.1-sol` builder with `reasoningEffort: low` completed a 100-card Ayula, Queen Among Bears candidate using unchanged [builder prompt v1](builder.md). A fresh best-effort desk review was collected and validated. This supplies a third fixed brief with different bracket intent and strategy alongside the Goblin and Tatyova candidates. It does not complete the repeated baseline required by [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Brief and retained evidence

The fixed bracket-1 brief asks for a woodland gathering of Bears, theme before power, visible development and telegraphed combat wins, with games intended to last at least nine turns. These are assignment goals; no gameplay establishes that pace. The recipe selects balanced style and `precon` (the contract enum for the Core preset), then a recorded command steers style to `thematic`. Targets of 38 lands, 10 ramp, nine draw, eight removal and two wipes are heuristics. Game Changers, tutors, extra turns and unreleased cards are excluded in settings; direct retrieved additions do not certify those preferences.

Total budget and per-card cap are null; allowed sets, must-include and must-exclude are empty. These impose no additional restrictions and do not test nonempty constraint enforcement. The explicit provider query is `id<=g legal:commander (t:bear or o:bear or t:land or o:"draw a card" or o:"destroy target" or o:"add {G}") mv<=6`, ordered by name with eight pages maximum. Preparation completed seven pages with 1,203 raw results and a prepared queue of 1,160 cards. That establishes completion of this query, not strategic coverage.

| Identity                   | Recorded value                                                     |
| -------------------------- | ------------------------------------------------------------------ |
| Evaluation HEAD            | `7fd8b8af2b575abae0757ba59ab64dc4be7ea95a`                         |
| Builder prompt SHA-256     | `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b` |
| Knowledge-base commit      | `5b1412c6b304cff9369b393b42d2197aca622a12`                         |
| Preparation manifest       | `ed8496de658cd2d93bef6cde1cda8173ca5a5dfe51f8f365cdc2508c296ea6bc` |
| Build manifest             | `aa48b11bd664aec11fc55a7b766eb4102ab55e45dc6c1d4f3cf3eaf65a893cf0` |
| Final report SHA-256       | `1fb99bbfbbbfd13ad5f6f6193404357ec42cdc0ce85c0c8f9fddef3cbb0532ae` |
| Original inventory SHA-256 | `0067345bbc5ec8d125830c82953eeb1e7f87287e400c79ba3061b25beef19d31` |
| Review bundle hash         | `dd7c7c5090ed3fda7e0266252a11f5e499e782eb52b64238c42f7622a73fd6c1` |

Raw evidence stays outside Git under `E:/working/agent-sandbox/research/deckbuild/issue-98-slice-18-attempt-5/`. Its inventory covers 64 original artifacts; `operator/` separately retains independent replay/integrity proof, staged review configuration, actual task receipt and validated review. Reproduction requires the evaluation HEAD, exact logs and retained store. Later documentation commits fail the pinned version check as expected. No images were downloaded.

## Attempts and bounds

Four earlier attempts remain separately retained under `issue-98-slice-18/` and `issue-98-slice-18-attempt-{2,3,4}/`. They are failures and setup continuations, not independent baseline repeats:

- Attempt 1 stopped on an incorrect optional documentation path before setup.
- Attempt 2 passed the file-URL preload smoke but tried to import absent `tsx`; no preparation ran.
- Attempt 3 prepared successfully, then supplied inline limits JSON where the CLI required a file path. No build command executed.
- The operator installed frozen-lockfile dependencies, copied the exact preparation store/pins to attempt 4 and successfully recorded a one-command inspection prefix using native Node stripping and `limits.json`. The builder then used invalid style `theme` instead of `thematic`; the append was rejected before execution. Its successful prefix and preparation replayed exactly.

Under recorded routine scope authority, attempt 5 copied that exact preparation and successful prefix, retained the attempt-4 deadlines unchanged, and allowed explicit corrections to pre-execution invocation/schema errors within the remaining budget. Actual stopped reports, provider/runtime failures and exhaustion still required stopping. Historical assignment/provenance copies are distinguished from `assignment-current.txt`; the first inspection command was operator-authored. No earlier deck choices were carried forward and no preparation was refetched.

The retained clock starts at `2026-10-27T23:43:41.8438383Z`, with execution cutoff `23:55:41.8438383Z` and finalization deadline `23:59:41.8438383Z`. Limits were 300 commands, 60 batches, 14 extensions and 90 seconds per CLI call. A `spawnSync` supervisor refused starts after the relevant phase deadline and capped each child at the smaller of 90 seconds and remaining phase time. Finalization calls used a throwing `globalThis.fetch` preload, imported through `pathToFileURL(...).href` and separate Node arguments, followed by `--experimental-strip-types`. This avoids both unsupported Windows drive-letter imports and an undeclared `tsx` dependency.

The completed log has 43 commands and three extensions, with final batch number one. Execution ended at `23:48:43.466Z`; result writing ended at `23:49:47.230Z`, and the original inventory timestamp is `23:49:47.316Z`. All are before the deadlines. The artifact writer records whether it finished late; the supervisor enforces CLI process bounds. Neither controls every agent activity or arbitrary filesystem write, and the fetch preload is not an OS network sandbox. These limits do not retroactively make the earlier attempts successful or enforce an overall budget covering all five attempts and later review/delivery.

Independent operator verification checked all 64 inventory hashes, unchanged prompt, three append concatenations, exact spec equality and name multiplicities between deck state and all 100 raw Oracle entries. It reproduced the entire preparation and build reports with fetch disabled and obtained construction status `ready`. Its separate four-minute verification bound ran from `23:50:16.921Z` to `23:50:34.027Z`. No deck choices changed during verification.

## Candidate and review

The candidate has 100 cards and no sideboard: 40 lands, including 34 Forests. Shared role heuristics count nine ramp, 14 draw, four removal and one wipe, below the requested interaction targets. Counts overlap and do not establish quality. Two offered decisions retain ranks/scores; grouped additions and repeated basics reference recorded lookup command 3, which returned all 66 requested names. The Grizzly Bears explanation reports zero-based rank 39 and total score 18: present in the pool, not a retrieval miss. This observation alone does not establish a production ranking defect.

The existing runner staged only projected spec/deck, Oracle evidence, unchanged reviewer/rubric/session contracts and dated rules/policy references. A fresh Codex `gpt-6.1-sol`/low review was accepted by `finishReview`, including staged-hash and bundle rechecks. It reported no observed contamination and categories of generic host instructions, skill catalog, workspace/branch, repository and runtime metadata. Restrictions were instructions, not enforced isolation.

| Criterion     | Score / 5               | Confidence |
| ------------- | ----------------------- | ---------- |
| Bracket fit   | 4; appropriate estimate | Medium     |
| Effectiveness | 4                       | Medium     |
| Theme fit     | 5                       | High       |
| Idea fit      | 5                       | High       |
| Fun           | 4                       | Medium     |
| Synergy       | 4                       | Medium     |

The reviewer chose Ayula, Ruxa and Caller of the Claw as strongest; Gladewalker Ritualist, Spectral Bears and Fade from History as weakest, citing supplied Oracle evidence. It identified unsupported same-name draw, conditional combat reliability and destruction of the deck's own support. It also noted commander dependence, graveyard-resource competition and tension between Ruxa's no-abilities benefits and trample effects. These are desk judgements, not gameplay measurements or rank-benchmark labels. No swaps were proposed because outside-deck Oracle evidence was absent.

The reviewer estimated apparent bracket fit but did not establish nine-turn pace, exhaustive combo coverage or enjoyment. Policy copies were reviewed on 2026-10-03 and were not freshly verified. Its statement that spec compliance is strongly supported does not resolve operator-observed release preferences: the selected Forest (`mdd`, 2027-04-09) and Path of Ancestry (`trc`, 2026-11-13) printings are future-dated against pinned 2026-10-27 despite `excludeUnreleased: true`. The run preserves them. Construction readiness from supplied metadata is separate from printing availability, full preference compliance and bracket certification.

## Triage and remaining acceptance

- **Tooling:** native Node invocation, limits-file arguments, contract enums and narrow error boundaries prevented further setup churn. Failed calls remain evidence; the frozen builder prompt was not changed. [Windows invocation guidance](builder-cli.md#windows-replay-and-session-bounds) records the working form.
- **Preferences/provider data:** direct retrieved additions bypass recommendation filtering, exposing future selected printings. This is a concrete workflow observation within #98; a live-app fix requires separately scoped work and full-stop delivery. No production defect or universal filter bypass is inferred beyond this path.
- **Ranking:** Grizzly Bears' retained state can inform [#105](https://github.com/tomcorke/mtg-commander-deck-creator/issues/105). Independent labels and nearby negative cases are needed before changing ranking.
- **Knowledge/gameplay:** policy currency, actual pace, recovery under commander removal and table experience remain unresolved. No new shared rules or policy fact was established.

Keep #98 open for repeated builds, reviewer-noise measurement, independent rank labels/benchmarks, suites/holdouts, summaries, full constraints, remaining provider workflows and original enforced-isolation acceptance. This slice changes documentation only; no publishing, baseline-completion claim or bracket certification is included.

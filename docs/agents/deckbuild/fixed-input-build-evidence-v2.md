# Fixed-input build evidence v2

This DEVELOPMENT1 attempt resumed the same unexecuted v2 setup under explicit clarification that filenames alone are not holdout contents or tuning evidence. The original stopped handoff and v1 ENOBUFS evidence remain unchanged. No holdout contents were used.

The first command used direct stdout/stderr file descriptors and replayed with exact whole-JSON equality. Offline preparation at `aa3f7bf1bc9b2903dd073d089aa2c7bae929fd6a` verified that only `recommenderVersion` differed from original pins. The frozen spec, recipe and version 1 builder prompt were retained.

## Assignment failure

This is **not a compliant bounded build result**. Extensions 1-2 have zero provider entries. Extension 3 recorded three blocked provider attempts; extension 4 increased that to six and extension 5 to eight. All eight occurrences reference response `52f7ff1231f92299bc69b72b2c94f4dcc6051846fd22be41a14e9077a1b33e43`: `{"detail":"Transport unavailable","kind":"network","status":"failure"}`. The throwing fetch preload prevented live requests, but provider attempts and repeated failures violated the zero-provider/no-retry assignment. The operator checked process and report status `complete` without inspecting settled provider outcomes, then incorrectly continued. It should have stopped at extension 3. Extensions 4-12 are retained noncompliant diagnostic continuation, not accepted build evidence.

The captured run reached 60 commands, 12 extensions and 12 batches. Every initial/extended report replayed exactly, including the recorded failures. Equality proves reproduction of these outputs, not procedural compliance. Final diagnostic state has 21 cards and one land, including Goblin Trashmaster with pending preference feedback. Construction is not checked; no complete deck, legality, bracket fit, quality or baseline claim is made. Separate budget/cap/set/include/exclude constraints are unset in the fixed brief.

Both `Mountain` and `Snow-Covered Mountain` explanations report `not-in-pool`. Repeated deferred offers were observed without a ranking-quality conclusion. No labels, tuning, app changes or publishing occurred.

## Bounds and retained corrections

Predeclared bounds were 60 commands, 12 batches/extensions, 60 seconds per subprocess, 10 minutes execution and 12 minutes finalization, 32 MiB per stdout/stderr and 256 MiB across top-level continuation files. A 10 ms monitor checked byte/runtime limits; this permits polling overshoot and excludes nested manifests, so it is not a hard OS quota or whole-agent bound. No byte/runtime crossing was reported, and summary finalization was timely. Provider/no-retry bounds failed as described above.

Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-independent-build-dev1-v2/`. `continuation-inventory.json` initially verified 167 entries. Later `continuation/correction.md` corrects the feedback's 20-card count to 21. `continuation/provider-audit-correction.md` corrects its false zero-provider/no-retry statements. Original inventoried files remain unchanged; `summary.json` already records eight entries. These separate corrections must accompany the earlier feedback.

Initial manifest: `393fb185869218c93d9ad66f7297aa52e8b61646dbefcb5e7ee5246ea6d97def`. Final diagnostic manifest: `25a69ee6003183e96f611e007bf3c65c36cf61ae6481f75fdf7a07218d31ee64`. Prior truncated v1 recording still cannot establish exact equality; see [v1 evidence](fixed-input-build-evidence-v1.md). No automatic restart follows this failed attempt. #98 remains open for its remaining acceptance work.

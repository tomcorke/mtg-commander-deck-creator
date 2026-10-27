# Bounded builder evaluation, prompt v1

On 2026-10-27, one fresh Codex `gpt-6.1-sol` session with `reasoningEffort: low` used the unchanged [builder prompt](builder.md). This is a workflow evaluation on one partial deck, not the baseline round required by [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).

## Assignment and provenance

The fixed brief was Krenko, Mob Boss, bracket 2, Goblins, casual creature combat with incremental, telegraphed development and no early-combo goal. Total budget and per-card cap were null; allowed sets, must-include and must-exclude were empty. Explicit settings came from one shared constructor invocation and were retained before execution: Balanced, Core, creatures included, Game Changers/tutors/extra turns/unreleased excluded, role targets 35/10/10/8/3. These are app heuristics, not bracket certification. The builder recorded its pace/idea interpretation through action reasons and land-role focus.

Provider preparation used the existing recorded commander lookup and a deliberately narrow Scryfall pool search: `id<=r legal:commander t:goblin mv<=3`, name order, at most three pages. This choice made the session bounded and inspectable; it did not provide a balanced whole-deck candidate pool. Provider responses, including later signature work and Oracle lookups, remain in immutable research storage. No card images were downloaded.

The assignment capped execution at 24 commands, 12 batches, six extensions, ten minutes overall and 120 seconds per CLI invocation. The builder started with `record`/`view`, inspected reports, selected six append logs and invoked the actual `extend` CLI after each selection. It used offered decisions, `nextBatch`, `explain`, recorded `lookup`, `addRetrieved`, and deliberate `focus` steering. It authored no replacement card payloads.

| Identity                         | Recorded value                                                     |
| -------------------------------- | ------------------------------------------------------------------ |
| Clean evaluation HEAD            | `28d5738783f51dfc0c19c163279a5a7c8c9a85ea`                         |
| Prompt v1 SHA-256                | `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b` |
| Knowledge-base commit            | `5b1412c6b304cff9369b393b42d2197aca622a12`                         |
| Preparation manifest             | `e3614402cae0352a62affe4a58d7e491a14da0090809114966f40b4cd5be1ec6` |
| Final builder manifest           | `29e6b0a026f29a6746dbbe32ca29f4ff95a5ddbe10a452fe7e9cb9a1ecd8675e` |
| Final report/replay file SHA-256 | `0aeb16e07aa918094500987e24e86b4015c9ed789df5e05dbd829b5efb02cf3e` |

Raw evidence is outside Git at `E:/working/agent-sandbox/research/deckbuild/issue-98-slice-15/`. `manifest.json` binds eleven artifact hashes; `provenance.json` records model/options, bounds and knowledge topic hashes. Retained files include the assignment and prompt copy, recipe/settings/pins, preparation and replay, every append and combined command log, reports 0–6, immutable manifests/responses, `commands.jsonl`, `actions.jsonl`, `deck.txt`, `builder-feedback.md` and structured `knowledge-gaps.json`. File-byte hashes and the CLI's canonical parsed-input hashes are separate identities.

## Results and operator checks

The session stopped at both the 24-command and six-extension bounds, after four batches and about 174 seconds. Final main-deck size was 12 including the commander, with no sideboard. All command reports completed; the deck remained partial with four lands and unresolved role deficits. No complete-deck construction gate or reviewer scoring was run. Legality, bracket fit and gameplay quality remain unverified. The separate unconstrained budget/set/name fields impose no ceilings or required names in this brief; this says nothing about constrained-spec enforcement.

Preparation replay matched the original report. The final CLI replay, run with `globalThis.fetch` replaced by a throwing function, matched the entire final report. The operator independently reran that network-disabled replay, checked all eleven artifact hashes and the prompt hash, and verified that each combined log exactly concatenated its predecessor and append. This proves this session's replay and artifact consistency, not the authenticity of provider data or the quality of choices. Replay requires the recorded evaluation HEAD; later documentation commits change HEAD and the CLI correctly rejects them as a version mismatch. Use a clean checkout at the recorded SHA when reproducing.

## Feedback triage

- **Workflow evidence:** the fixed prompt produced reasoned inspect/choose/extend decisions, retained offered scores, used Oracle lookup evidence for additions and preserved an explicit partial outcome. `actions.jsonl` is derived from final CLI entries; the original report remains authoritative. The single session supplies no builder-noise estimate.
- **Ranking hypothesis, not a defect finding:** command 6 explained Goblin Chieftain as present/ranked at zero-based position 235, total 24, including a -10 mana-fit penalty. The builder obtained it through lookup command 7 and selected it with command 8. Empty-mana-base scoring may matter, but this observation has no independent labels, comparison, ablation or quality estimate. Ranking experiments belong with [#105](https://github.com/tomcorke/mtg-commander-deck-creator/issues/105); this run just preserves a candidate state for investigation.
- **Retrieval limitation:** command 19 focused lands and produced an empty visible batch while the narrow pool still had candidates. Command 20 retrieved land Oracle evidence; command 21 selected four lands. This follows a pool deliberately lacking a mana base, so it is not evidence that the recommender lost available lands. Full pool/basics workflows and complete sessions remain in [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98).
- **Tool friction:** setup needed file-URL imports on Windows, projection of strict settings-schema keys, Node-written UTF-8 files instead of PowerShell redirection, and a larger `execFileSync` output buffer for large reports. Errors happened before the initial builder record; the successful recording was retained. Future operators should use UTF-8 JSON-aware file writes and file output or a sufficient buffer. Dedicated session orchestration/export and supported/unsupported sub-theme views remain #98 work; this prompt does not implement them.
- **Knowledge uncertainty:** the builder retained a structured request to assess complete-deck pacing before asserting bracket fit. Its policy reference was dated 2026-10-03 and was not freshly reverified. No new rules/policy fact was established, so there is no knowledge-base update from this run.

Keep prompt v1 unchanged for comparable future runs. This evaluation changes no recommender mechanism and makes no keep/reject quality decision. Complete builds, fixed suites/holdouts, repeats, reviewer-noise measurement, labelled rank benchmarks and remaining acceptance stay in #98, which must remain open. Best-effort reviewer restrictions are unchanged; this session makes no enforced-isolation claim.

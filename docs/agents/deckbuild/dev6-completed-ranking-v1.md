# Development-6 completed repeats and three-spec ranking

Part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98). Raw evidence: `E:/working/agent-sandbox/research/deckbuild/issue-98-dev6-23d3529/`. Executing SHA: `23d3529c067c0ca3740eab455a8e29ad0201cb5d`; scoring version 3. No app changes or publishing.

## Independent builds

Two fresh T3 Codex gpt-6.1-sol sessions, reasoning low, built development-6 independently from identical prepared inputs. Neither saw sibling jobs or previous builds. Frozen prompt and KB references are hashed in `queue/round.json`; KB commit is `0bb5c7ee52ff5e9b5ee4f4774d8801433a1f1877`. Preparation reused the retained recipe and zero-entry preparation manifest; the executing recommender pin changed. Initial setup lacked dependencies and failed before preparation/build; locked dependency installation corrected setup. No build was retried.

Predeclared per-session bounds: 45 minutes execution, five minutes finalization, 260 commands, 60 batches, 25 extensions, ten provider attempts per extension, 120 seconds per subprocess, zero retries. Session timestamp records and supervisor assignments remain in each job. Each builder tightened the assignment deadline before starting to 18:37:46/47Z on 2026-11-06 (per-job `assignment.json`), within the original queue deadline of 05:52Z the next day. Output caps were 64 MiB stdout and 1 MiB stderr.

| Repeat | Cards | Commands | Extensions | Gate  | Replay | Final manifest                                                     |
| ------ | ----: | -------: | ---------: | ----- | ------ | ------------------------------------------------------------------ |
| 1      |   100 |        7 |          4 | ready | exact  | `f0ae2f7cd78ebe1633723682b7a100c9c4708bb5e10b33b7dd6683fe65d91141` |
| 2      |   100 |        7 |          4 | ready | exact  | `d9953e288c599a332b5634645df76eacc1fb2f935db80d9f1c29d4cf25382383` |

Each retained accepted 71-card checkpoint points to `extend-2.json`; all accepted extensions have exact supervisor offline replay. Final reports are `extend-4.json`, combined logs `commands-4.jsonl`, and replay proofs `replay-4.json` under `queue/development-6-1/` and `queue/development-6-2/`. Both stopped voluntarily after completion, without settled failures. Recorded Scryfall name lookups and `addRetrieved` supplied selections; no live EDHREC requests occurred. Partial lookup responses were accepted without retrying missing names. These builds bypassed recommendation advancement, so completion does not establish recommendation quality. Both builders flag ramp density and commander strength as bracket-fit uncertainties; no blind deck review or gameplay occurred.

These use the same builder model/settings as the four independent dev1/dev2 builds in [the Codex round](baseline-round-codex-v1.md). The newer execution SHA and provider recordings prevent a claim of identical cross-spec data/version conditions. Construction readiness is not bracket certification. Full end-to-end baseline acceptance remains pending dev6 blind reviews.

## Frozen suite

`ranking/suite.json` adds repeat 1's accepted 71-card state to the existing dev1/dev2 suite. Queue/deferred merging and strict schema projection reuse the prior extraction pattern. The current batch matches the retained report. The single-version union is the 2,176-card queue (no deferred cards). Dev1/dev2 cases, grades and human notes are unchanged. `ranking/provenance.json`, `commands.md` and `verify.json` retain hashes, commands and equality/coverage checks.

Claude Sonnet 5.5, high effort, labelled all 2,176 dev6 candidates alphabetically from Oracle text, the partial deck and brief, before evaluation and without production scores as labels. Grades 0/1/2/3: 1438/472/210/56. Every new label is pending human review. The labeller had seen visible batch names and introductory final-builder prose; this is disclosed context exposure, not a blind labelling claim. Labels are one agent's heuristic judgements. No human endorsement, legality or bracket certification follows from them.

Evaluation report: `ranking/report-main-23d3529c067c0ca3740eab455a8e29ad0201cb5d.json`. Suite file SHA-256: `57093948c141d785c16d82cc4886bcbdca77b3978a0d3a89ad50d10a09a2f01c`; report SHA-256: `613a8080cf7036bdb67f24b9405f05861f8010e8a370751bd6797f9a8ef52a9c`.

| Case     | Recall | nDCG@4 | Precision@4 | Good-option coverage | Redundant | Violations |
| -------- | -----: | -----: | ----------: | -------------------: | --------: | ---------: |
| dev1-b71 |  1.000 |  0.254 |        0.25 |                    1 |         0 |          0 |
| dev2-b71 |  0.968 |  0.317 |        0.75 |                    1 |         0 |          0 |
| dev6-b71 |  1.000 |  0.189 |        0.25 |                    1 |         1 |          0 |

No case errors. Dev1/dev2 metrics and batches match the prior human-reviewed report. Dev6 offers Volatile Rig (1), Snow-Covered Wastes (2), Golden Argosy (1), Wirefly Hive (0). Snow-Covered Wastes appeared earlier. Recall is uninformative for dev6: no absent relevant candidates were labelled. Sol Ring, Mind Stone, Thought Vessel and Arcane Signet are absent from the pool and checkpoint deck; those absences were not investigated. The artifact/creature-heavy prepared pool gives little coverage of other roles. No causal ranking defect was investigated; these metrics do not establish gameplay quality or an improvement.

## Acceptance and remaining work

Independent repeat builds now exist across dev1/dev2/dev6 on one fixed builder model, and the three-spec ranking results exist. The real-suite evidence remains qualified: one roughly 71-card state per spec, no early/late or deliberate missing-role/misleading-match cases, and no dev6 human spot-check. Leave that acceptance box unchecked. Full baseline remains unchecked pending dev6 blind reviews. Specs/holdout acceptance stays unchecked for the owner decision about eight development plus six holdout briefs. No holdout directory or contents were accessed.

Remaining work stays in #98; runtime sandboxing is tracked separately in #267 and live EDHREC permission in #309. No challenger, tuning, new shared KB findings or provider-policy freshness claim.

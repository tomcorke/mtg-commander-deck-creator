# Fixed-input build evidence v1

## Finding

This was one bounded, fetch-forbidden attempt from the fixed `dev-1` input. The first and only builder command was an initial `view`. Its process output capture failed with `spawnSync ... ENOBUFS`; the original `record.json` is truncated and cannot be parsed. The feedback identifies the cause as exceeding `spawnSync`'s default output buffer. This is an output-capture failure, not evidence that the app lacks a capability to build or return a report.

The one-command offline replay completed with `status: complete` against manifest `8b2cafb274b5b73222294ba578736b1cf3411ebf54779d919634aaabbb82543e`. However, `replay-process.json` explicitly records equality as impossible because the original stdout was truncated. Exact record/replay JSON equality is **unproven**, despite successful replay.

The only deck state was the prepared, pinned Krenko state: `deck.txt` contains one card, `Krenko, Mob Boss`. No builder decisions were made, no extensions were run, no provider requests were made, and no retries occurred. `actions.jsonl` is empty. This is not a completed deck or build, a baseline result, or evidence of provider completeness. Completed-deck legality and bracket fit remain unresolved. Holdout inputs were not used or changed.

## Fixed inputs and bounds

- Execution HEAD / recorded recommender version: `48b5289abac375b5fb4ed89440c6299aae671285`.
- Spec: `Krenko, Mob Boss`; bracket 2; Goblins; casual creature combat; incremental telegraphed development with no early-combo goal. Budget and card/set include/exclude constraints are unset.
- Prompt: version 1, unchanged; SHA-256 `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b`.
- Prepared inputs identify date `2026-10-28`, seed `issue-98-common-input-evidence-v1`, snapshot `issue-98-common-input-evidence-2026-10-28`, source version `4f0b792b484f5c4880983b7a140b49280f93acc2ad4b41629aae95b4d91f407b`, and policy version `9a3bf1c574b246b4c38449411ab482bf655604b3da851eeec5a2bd82079085cd`. The pin verification reports only `recommenderVersion` differs from the original pins; the original is retained.
- Assignment bounds: 60 commands, 12 batches, 12 maximum extensions, 60,000 ms runtime, zero automatic retries, zero provider requests; mode `fetch-forbidden partial`. Actual use: one command, zero extensions, zero decisions, zero provider requests, zero retries. The provider manifest has zero entries.

## Raw evidence and hashes

Raw files remain in `E:/working/agent-sandbox/research/deckbuild/issue-98-independent-build-dev1-v1`; no raw evidence was changed. SHA-256 values below were computed from the files in that directory while preparing this note. The manifest ID is its content hash.

| Raw file                                                                          | SHA-256                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `assignment.json`                                                                 | `81b997601c8402bdf3beb5c9d919e36bf9ca16f7ef48d5786d5592e832976ddb` |
| `spec.json`                                                                       | `3b90d46927868ea26653c14279eb5377aa5a90c742be88e47e49109d5e3eec13` |
| `builder.md`                                                                      | `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b` |
| `inputs.json`                                                                     | `016209135bad0f94690dba50abe574ac0409b2a66804cf65bcc9d9e35c8e701f` |
| `original-pins.json`                                                              | `dbf0d926f4b4bc5a3be029d4aeeda6591184f3363263eb64119299de1ee2ead8` |
| `pins-verification.json`                                                          | `dd9cbd8bcbc67ad25488692c9330fe3bffe0b71db1eca1a0faa972bce2fe8171` |
| `recipe.json`                                                                     | `44a321a498b93548440ffd51c0ad4b4bccd5558ef9e65432df841d6037b58296` |
| `limits.json`                                                                     | `2e3348ddb94bf2891cfc65dc754ecaf57ce3dbe53377979ad70c28d96032f1db` |
| `commands.jsonl`                                                                  | `c80350fde40b59643628cddb33ff4b2262f3b0f10bac2e2077e5d6645c3dd7e2` |
| `actions.jsonl`                                                                   | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `deck.txt`                                                                        | `0d402dd95ac5e252250c433734aea45a4c701f9d3cdf6d36a7a1fb683e5efbec` |
| `manifests/8b2cafb274b5b73222294ba578736b1cf3411ebf54779d919634aaabbb82543e.json` | `8b2cafb274b5b73222294ba578736b1cf3411ebf54779d919634aaabbb82543e` |
| `record-process.json`                                                             | `1b3ab6b326013520c1bede8915dc0ad7637087b57d362f58ad360f38cbba1513` |
| `record.json` (truncated)                                                         | `9c85ef9b4f4957dd14c076123398b9e84d78b361936ae82a119924ed5003915e` |
| `replay-process.json`                                                             | `dadec224a7a736f3a3795e8409f902eb07af19231b9369edcdbfe8fc080c4718` |
| `replay.json`                                                                     | `0551bda0d1658b6377c4e0cc3bc747434a742445f9d6d52e3f7aefa8e4082ff3` |
| `builder-feedback.md`                                                             | `87d0855cbe8bc85e07bd33faea824550559008f4a4ba345abd16b2116019cc3d` |

`final-inventory.json` is only a timestamped file listing; it is **not** a verified hash inventory. Its own SHA-256 is `e21c5dab0b764000968e295d924a4f13c508e3502e76b9255f1b498919177f3e`.

## Next attempt

Only if separately selected, start a new attempt in a separate output directory and direct stdout and stderr to files from process launch, with finite byte and wall-clock bounds. Preserve this attempt and its raw files unchanged. No retry or new attempt was run for this note.

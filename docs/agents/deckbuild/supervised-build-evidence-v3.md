# Supervised build evidence v3: dev-1 repeats and reviews

## Finding

Two new DEVELOPMENT1 (`dev-1`, Krenko, Mob Boss) builds ran under `supervise.ts` at `2a7ecddc0c5bcd00a1271a4cffd1f32021e7e30b` with a clean tree. They used the same provider-allowed bounds as [v2](supervised-build-evidence-v2.md), and each had its own new raw directory and assignment. Both reached a **complete 100-card candidate** with no bound breach, no settled provider failure and no retry. Every supervised call replayed offline with exactly equal reports. Both decks passed the construction gate.

Three blind desk reviews by Claude Opus 5.5 then scored the v2 deck and the two new decks, one review per deck, all with the unchanged reviewer prompt and rubric. Bracket fit, effectiveness and fun were identical across the three. Theme fit, idea fit and synergy differed by at most one point. Because each deck had only one review, these differences mix deck variation with reviewer variation and cannot separate the two.

| Run      | Status   | Extensions | Commands | Provider outcomes  | Gate    | Bundle hash      |
| -------- | -------- | ---------- | -------- | ------------------ | ------- | ---------------- |
| v2       | complete | 19         | 131      | 12, all successful | `ready` | `5a6d460f…c1012` |
| repeat-1 | complete | 24         | 154      | 13, all successful | `ready` | `a10d9c63…89fe7` |
| repeat-2 | complete | 24         | 156      | 13, all successful | `ready` | `bcb5907f…5cbb`  |

## Predeclared bounds

Each run directory had its own `assignment.json`, written before any builder command and before offline `prepare.ts`. The bounds match v2: 260 commands, 60 batches, 25 extensions, 10 provider attempts per record/extend call, 120,000 ms per subprocess (not raised), 67,108,864 stdout bytes and 1,048,576 stderr bytes per process. The execution deadline was setup plus 90 minutes and the finalization deadline setup plus 110 minutes. Retries were zero. The stop rule was the supervisor's: the first breach, nonzero exit, non-`complete` status, settled provider failure, provider cap breach or replay mismatch ends the run permanently. Neither run stopped, and neither directory has a `stop.json`.

| Bound or use            | repeat-1                 | repeat-2                 |
| ----------------------- | ------------------------ | ------------------------ |
| Setup                   | `07:55:30.469Z`          | `08:19:52.147Z`          |
| Execution deadline      | `09:25:30.469Z`          | `09:49:52.147Z`          |
| Finalization deadline   | `09:45:30.469Z`          | `10:09:52.147Z`          |
| Last supervised call    | `08:18:24.753Z`          | `08:41:27.008Z`          |
| Final run inventory     | `08:42:02.576Z`          | `08:42:02.345Z`          |
| Extensions / batch      | 24 of 25 / 25            | 24 of 25 / 25            |
| Commands                | 154 of 260               | 156 of 260               |
| Provider per call (max) | 0,1,0,3,3,4,2 then 0 (4) | 0,1,0,3,3,3,3 then 0 (3) |
| Longest extend / replay | 68.7 s / 35.1 s          | 66.3 s / 34.0 s          |
| Largest stdout / stderr | 5.5 MB / 0               | 5.5 MB / 0               |

All times are 2026-10-29 UTC. All 26 provider outcomes were HTTP 200: Scryfall collection POSTs and EDHREC card pages. No provider lookup ran outside a supervised call. Both runs used 24 of the 25 allowed extensions. Late batches offered mostly low-scored filler, so the extension cap shaped the last quarter of both decks.

## Inputs

Both runs copied `recipe.json` and `original-pins.json` from the exact path `E:/working/agent-sandbox/research/deckbuild/issue-98-independent-build-dev1-v1`. Their hashes equal v2's (`44a321a4…58296` and `dbf0d926…2ead8`). Offline `prepare.ts` produced byte-identical `inputs.json` files for the two runs (`8a341a8c…a7bfe2`). A key-sorted comparison with `original-pins.json` differs only in `recommenderVersion`. Gate Oracle objects came from the exact path `issue-98-common-input-evidence/dev-1-preparation.json` and each run's own recorded responses. No holdout input was read and no holdout directory was listed. PR #256 was not used.

Because the pins are the same, both `record` calls produced the same manifest (`399d1b22…8ac10`), with the same first offer as v2. The builds diverge only through builder decisions.

## Builder

The builder was this operator session (`claude-opus-5-5`, no helper builders) following unchanged `builder.md` v1 (SHA-256 `69d9e825…fb8b`). The same session built both repeats in sequence, so they are **not independent builder sessions**: repeat 2 was made with knowledge of repeat 1. v2's builder was `claude-sonnet-5-5`, so model and builder differ between v2 and the repeats. Knowledge-base commit `5d2a986c597a71a81fe8aaccc8a639082db35eb7`.

Both repeats took plain Mountains from one recorded `lookup` plus one `addRetrieved` per copy, as v2 did; each also has one offered Snow-Covered Mountain. Repeat-1 has 33 lands, repeat-2 has 35 to match the app's role target. Repeat-2 added Krark-Clan Stoker in batch 2; every later offer then differed from repeat-1, and the deck leaned towards Treasure and artifact sacrifice. Neither repeat took the Unfinity sticker cards, so v2's unresolved legality question about them does not apply. No card in any of the three decks has `game_changer` true.

Deck overlap by distinct card name:

| Pair                 | Shared | Distinct names | Jaccard |
| -------------------- | ------ | -------------- | ------- |
| v2 vs repeat-1       | 47     | 67 / 69        | 0.528   |
| v2 vs repeat-2       | 47     | 67 / 67        | 0.540   |
| repeat-1 vs repeat-2 | 50     | 69 / 67        | 0.581   |

40 names are in all three decks, and 99 names appear across the union.

## Reviews

Each deck was staged with unchanged `review-session.ts stage`. Every stage had identical prompt, rubric, session, schema and reference review-session digests (SHA-256 of the canonical JSON string, not file-byte hashes) (`reviewer.md` `c8cf990e…4138`, `rubric.md` `f108ee9f…ed1`, `session.md` `b0e61b2b…fe92`). Each reviewer was launched with T3 `delegate_task` using the runner's unchanged task text. The runner's Codex `gpt-6.1-sol`/low target was replaced by `claudeAgent` `claude-opus-5-5`, with options left empty (provider default), as the parent scope required. Reviewers saw only the staged bundle, prompt, rubric, session instructions, schema and two references. They saw no provenance, builder feedback or other review. `review-session.ts finish` accepts only Codex `gpt-6.1-sol` receipts, so `collect.ts` in the raw root repeats its checks with the Claude receipt: staged file set and hashes, private input binding, the envelope schema and `validateReview`. App code was not changed. The operator transcribed receipt summaries from the `task_status` output.

| Criterion     | A: v2 | B: repeat-1 | C: repeat-2 | Range | Absolute differences A–B, A–C, B–C |
| ------------- | ----- | ----------- | ----------- | ----- | ---------------------------------- |
| Bracket fit   | 3     | 3           | 3           | 0     | 0, 0, 0                            |
| Effectiveness | 3     | 3           | 3           | 0     | 0, 0, 0                            |
| Theme fit     | 4     | 5           | 5           | 1     | 1, 1, 0                            |
| Idea fit      | 3     | 4           | 4           | 1     | 1, 1, 0                            |
| Fun           | 4     | 4           | 4           | 0     | 0, 0, 0                            |
| Synergy       | 3     | 4           | 3           | 1     | 1, 0, 1                            |

All three rate bracket fit `appropriate` with medium confidence and flag hasty-Krenko pace as an unresolved risk against the Bracket 2 turn expectation. Theme fit confidence is high in every review; all other criteria are medium. All three name Krenko, Mob Boss and Howlsquad Heavy among the strongest cards. The weakest-card picks do not overlap, which is expected because they are different decks. None proposed swaps, because the bundle has no Oracle evidence for outside cards. All three requested Goblin anthem candidates and playtest pace evidence as knowledge gaps.

Reviewer A's v2 score is lower on theme and idea fit. It cited the sticker card Goblin Airbrusher and lone-attacker cards (Akki Ronin, Goblin Grenadiers) that v2 kept and the repeats declined. This is an attributed judgement, not proof that the repeats are better decks.

### Review outcomes and failures

- **A (v2 deck):** this is a recorded failure followed by a host resume, not a clean completion. Run 1 started at `03:10:19Z`, read only the seven staged files, then hit the Claude 5-hour usage limit and failed at `03:10:27Z`. At `07:54:54Z` the host automatically resumed the same session ("Continue where you left off", server-created). Run 2 returned a completed envelope at `07:56:22Z`. Run 2 also contains a recovered-provider notice reporting a Claude API authentication failure. The operator did not retry or relaunch. The task-level receipt is `failed` with the rate-limit summary and is kept as `result-task-receipt.json` (status `failed`). The resumed run's envelope validates as `result-run2.json`; the scores above come from it. `thread-record.md` records the sequence.
- **B (repeat-1 deck):** completed in one run (`08:42:15Z`–`08:43:37Z`). It also ran one shell command, a read-only `sed`/`grep` count of Mountain lines inside the staged `bundle.json`. It read nothing outside the stage, but the session asks reviewers to use read tools only.
- **C (repeat-2 deck):** completed in one run (`08:42:19Z`–`08:43:48Z`), reading only staged files.

The B and C timings, B shell use and C staged-only reading above are operator transcriptions of thread activity; their activity traces were not archived in the raw root. These details therefore lack independently archived trace support.

All three reported `none-observed` contamination. Their ambient context included host and project instructions, the skill catalog, account identity, and **the workspace branch name (`research/98-dev1-review-repeats`) and recent commit subjects**. These name the dev-1 review workflow in general terms. The reviewers judged this to be generic routing metadata, but it is weaker isolation than a neutral workspace would give. Isolation is best-effort and self-reported, not enforced.

## Raw evidence

Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-dev1-review-repeats/`. `final-inventory.json` lists 533 files with bytes, SHA-256 and mtime, generated `08:46:13.520Z`; each build directory also has its own inventory. Staged inputs are archived under each review's `approved/`. The exact temporary stage directories were removed after archiving.

| File                                               | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `build-repeat-1/assignment.json`                   | `4d6d984a13e5831538455727d9be037ee899c1722747e0eea3f4d48f88e3b7b0` |
| `build-repeat-1/commands-final-replayed.jsonl`     | `0eae792385dcb1ce65405cc6eec51af493433983b84998012ff3d5b964afb913` |
| `build-repeat-1/extend-24.json` = `replay-24.json` | `f591a33026fcae81eea8909e928054f1fe3babeb880d55a888d984fb439e8f09` |
| `build-repeat-1/deck.txt`                          | `8b2801d3189b0e12bb3a93c8f5b6d2c6c2d066ebb332f7c7edf748fb6d4b4f28` |
| `build-repeat-1/completed-review.stdout.json`      | `3d37ab84ce889038de5afc01bf60669c9122fb66b64672ca84d3f2f47f82f53b` |
| `build-repeat-2/assignment.json`                   | `3f71ca6ae836dfbad6ad88795b0640fce251e88228acc0760ae6cbf673b71162` |
| `build-repeat-2/commands-final-replayed.jsonl`     | `3a043ea55c859b41693395c8ba9aab347c400e8766667fc6e0cc40a19b8ae9f8` |
| `build-repeat-2/extend-24.json` = `replay-24.json` | `443f3672c4e7f4861027067c46afe0bde6744db3faa4eb59ac412a12b1692f71` |
| `build-repeat-2/deck.txt`                          | `44faeb8044240accab10f588cf00a31bff3d71da069131c26a68d79eb698fe9a` |
| `build-repeat-2/completed-review.stdout.json`      | `bf9e48ba5c5272bda1f30a0a614f9d5b923e1c20a498d10f6884fd07936c8a63` |
| `inputs.json` (both runs)                          | `8a341a8c66e778e368ea753802583dcc9d062472b0098bb0c78785489067bfe2` |
| `review-v2-deck/session/result-run2.json`          | `8f5cf4b59d9daed7beaed9e3a4b8491d0d09637b05c3dbcf1791398020bd20aa` |
| `review-v2-deck/session/result-task-receipt.json`  | `360ab605124dedffd4e21b830566ba8ee2c7a33ec6471ee8096f4f72952cd82a` |
| `review-repeat-1-deck/session/result.json`         | `830e21383a8e8aed4b48f5f55680b016c5dd5622cba0a2d50c211a9d4b32840b` |
| `review-repeat-2-deck/session/result.json`         | `e01d779389cd6015e19760ea451d514aa55cfb3bf48061124ab33cc10b0d607b` |
| `measurement.json`                                 | `04ce269e59fe10f03a70e148803ebd674327259aed0bc450194b8bd66b8a7b03` |
| `collect.ts`                                       | `6f1492bf426e7499be4a76c648621b6171ebaf4c4a78a7cbf817e8932cf64b36` |

Final manifests: repeat-1 `d1c92be5cf103da66e79ff4ee0d3c337029071807cf3fd80ceb0ae1cb7dde32b`, repeat-2 `23e52e15971f8ee2dd78ed6cf5c638cc260b971363459a8300b542527f137748`. The v2 raw directory was only read. All 195 files still match its inventory.

The operator made several scripting mistakes. None was a builder or supervised command. Two construction-gate attempts in repeat-1 ran before the export helper had written their input; their empty outputs are kept as `gate-attempt-{0,1}-missing-input.*`. One path-form error stopped the first assignment write before any file was created.

## Limits

This is development evidence on one brief: two repeat builds and one desk review per deck. It is not a baseline or quality evidence. The repeats share a builder session, and v2 used a different builder model. With one review per deck, score spread cannot separate reviewer noise from deck differences. A five-point ordinal scale with identical scores does not show reviewer agreement in general. Supervisor bounds cover each CLI process, not the builder agent or aggregate storage. Replay equality covers the CLI reports, not the truth of provider data. Bracket fit, pace and policy currency remain desk estimates. See [v2](supervised-build-evidence-v2.md) and [builder-cli.md](builder-cli.md).

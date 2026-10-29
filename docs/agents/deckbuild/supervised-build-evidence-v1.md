# Supervised build evidence v1

## Finding

One real DEVELOPMENT1 (`dev-1`, Krenko, Mob Boss) builder session ran under `supervise.ts` from PR #257 at `9c9c687019cc61cfc59a1f539ae7c92337dd5a0d`. The supervisor stopped it at **extension 3** with `provider attempts 2 exceed 0`, as designed for this fetch-forbidden partial assignment. It did not continue, retry or change a bound. The supervisor fixed the earlier v1 `ENOBUFS` and v2 continue-after-failure problems: output capture and the stop ledger worked. This is a **partial, stopped** result.

- Accepted evidence: initial `record` and extensions 1-2, each with zero provider occurrences and whole-report offline replay equality (`replay-2.json` is byte-identical to `extend-2.json`).
- Final accepted manifest: `3bf367ee2f838ede7535b5aebee69d3fbd57c0dbca523942c56c64534a38e13b`; combined replayed log: 11 commands. The accepted main deck has 7 cards (Krenko, Fable of the Mirror-Breaker, Snow-Covered Mountain, Reckless Lackey, Krark-Clan Shaman, Lightning Crafter, Krark-Clan Stoker); sideboard is empty; construction is `not-checked`.
- Stopped extension 3 (5 appended commands, 16 in the combined log) reported `complete` with an 11-card deck and batch 4, but recorded two provider occurrences: EDHREC card pages for `fable-of-the-mirror-breaker` and `howlsquad-heavy`. Both are `Transport unavailable` network failures produced by the fetch cap of 0, so no request reached a provider. Its offline replay was never run (the supervisor stopped first), so exact equality for extension 3 is **unproven**; its outputs are retained as diagnostic only.
- Not claimed: a complete or legal deck, bracket fit (2, unresolved), quality, baseline, provider completeness or reviewer results. The brief has no budget, cap, set, include or exclude constraints.

Likely cause (hypothesis): extension 3's `nextBatch` triggered EDHREC signature-card lookups for Fable (added in extension 1) and Howlsquad Heavy. The zero cap failed them; the CLI finished `complete`, then the supervisor stopped on the attempt count. A deeper build needs a separately chosen provider-allowed assignment.

## Predeclared bounds and execution

Bounds were written to `assignment.json` in a new raw directory before any builder command: 60 commands, 12 batches, 12 extensions, 0 provider attempts per extension, 60,000 ms per subprocess, 33,554,432 stdout bytes, 1,048,576 stderr bytes, execution deadline 10 minutes after setup (`2026-10-29T02:03:18.482Z`), finalization deadline 12 minutes after setup (`2026-10-29T02:05:18.482Z`), zero retries. Actual use: 4 supervised record/extend calls (record, extend-1..3) and 3 replays; 16 distinct builder commands (1 view, 10 in accepted extensions, 5 in the stopped extension); 3 extensions started; zero provider requests reaching a network; zero retries. No subprocess approached a byte or time bound; the stop ledger shows every call about 4 s or less and 2.4 MB stdout, zero stderr. Stop time `01:54:33.963Z`; final inventory generated `01:55:55.709Z`, both before the deadlines.

The model was `claude-sonnet-5-5` (the builder session's model, no helper agents). Builder prompt `builder.md` v1 is unchanged, SHA-256 `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b`. Execution HEAD and recorded recommender version were `9c9c687019cc61cfc59a1f539ae7c92337dd5a0d` with a clean tree (`git status --porcelain` empty before and after). PR #256 was not used.

## Inputs

Inputs are the prior v1 root's `recipe.json` and `original-pins.json` (copied, originals untouched): `E:/working/agent-sandbox/research/deckbuild/issue-98-independent-build-dev1-v1`. Offline `prepare.ts` at this HEAD produced `inputs.json`; a key-sorted comparison against `original-pins.json` shows only `recommenderVersion` differs. (A first, order-sensitive comparison falsely flagged `spec`, `resolvedOptions` and `initialState`; it was a key-order artefact, and the start command was not gated on it. The sorted comparison ran after start.) No holdout input was read or used. While looking at this checkout I listed `scripts/deckbuild/specs`, which showed holdout filenames; I read no contents and used none.

Setup note: this worktree had no `node_modules`; `pnpm install --frozen-lockfile` ran after `assignment.json` was written and before any builder command, with no tracked-file change. No live provider lookup ran outside the supervisor.

## Decisions

Reasons are in `actions.jsonl`. Extension 1 added Fable of the Mirror-Breaker (rank 1) and Snow-Covered Mountain (rank 3) and ignored `Wastes` and `Snow-Covered Wastes` as colourless sources for a red commander. Extension 2 added four on-theme Goblins. The stopped extension 3 added four more (Howlsquad Heavy, Gempalm Incinerator, Ib Halfheart, Skirk Prospector). No `explain`, lookup, search or steering command was used. No KB claim beyond the rule/bracket facts in `CONTEXT.md` was needed; `knowledge-gaps.json` is empty.

## Raw evidence

Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-supervised-build-dev1-v1/` (46 inventoried files plus the inventory). `final-inventory.json` lists every other file with bytes, SHA-256 and mtime; it cannot hash itself. Key SHA-256 values:

| File                                  | SHA-256                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `assignment.json`                     | `f4b4d3602944ca7abb7d007ada2bb8cf86993f395011a8070972f4ffb2ddca6a` |
| `inputs.json`                         | `a4da6e78a16cf17e1562e154cd8ed1536c691c567c10d01eb47e9aae1feb01d1` |
| `recipe.json`                         | `44a321a498b93548440ffd51c0ad4b4bccd5558ef9e65432df841d6037b58296` |
| `original-pins.json`                  | `dbf0d926f4b4bc5a3be029d4aeeda6591184f3363263eb64119299de1ee2ead8` |
| `commands-final-replayed.jsonl`       | `597b8114943e9cd4211acb5f89cf98e6f58d2ac9040db5b288c141c5b06d235a` |
| `commands-3.jsonl` (stopped)          | `ac3a73603b2b3aa4666ea92a1f97ee4ae93323df73fc66188693f9a5fa7d2004` |
| `extend-2.json` = `replay-2.json`     | `46b95a92c792c017bbce1b9fa9cf64b529917b4ad6937eb914c9c69bf87f9d88` |
| `extend-3.json` (stopped, unreplayed) | `22b9fd40ee419aa4cac6d311a6deaf256a1deba34fd7297d2369434efb70e6fc` |
| `ledger.jsonl`                        | `7f3f40462e0dc63a37da70b752bce00ebd2cf060d429b4f26d6c2da585a7c4ef` |
| `stop.json`                           | `9e4f1b5d35e6477c142e4c7ab42596f60c4c1e9fc5583c2b2f83eb38eb55c680` |
| `actions.jsonl`                       | `1ade7e073fadd6f58eb684683b5e58f034a17e6b76f4f459a63878c16377517c` |
| `deck.txt`                            | `bd422e3a75aab4f3cecdc3a57b740166496d7b03d0dc4e18f34fcf3557e319b7` |
| `builder-feedback.md`                 | `023b79778dbb9e217a5c33e481292dfd02a73dc089c0ec03407afb3268e59fb7` |

`record.json` SHA-256 is `5fa512057c819d8cb1081f01e8c09f467146e47f0fdbbc1ec501e4b1e56a3a6e`; `extend-1.json` is `b34b6c6eac400c6fbb972787f3cf5dff6785b0da6329bb923a7b7de2fd917a65`. The manifests are in the inventory. The stopped extension's diagnostic exports are `deck-extend-3-diagnostic.txt` and `actions-extend-3-diagnostic.jsonl`.

Limits: per-process bounds only; they do not bound the builder agent's own activity or aggregate storage. This is single-session development evidence, not a repeated-build or quality baseline. Any further attempt needs a new run directory and a separately selected assignment. See [builder-cli.md](builder-cli.md) and earlier [v1](fixed-input-build-evidence-v1.md) and [v2](fixed-input-build-evidence-v2.md).

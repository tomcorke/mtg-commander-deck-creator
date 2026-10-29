# Supervised build evidence v2

## Finding

A second DEVELOPMENT1 (`dev-1`, Krenko, Mob Boss) builder session ran under `supervise.ts` with a provider-allowed assignment, at `2266bf9a64f95d42a4b3048a66771fd01ed1138a` with a clean tree. It reached a **complete 100-card candidate** with an empty sideboard in 19 extensions, no bound breach, no settled provider failure and no retry. [v1](supervised-build-evidence-v1.md) stopped at 7 accepted cards under a zero-provider cap; its raw directory is untouched.

- **Final manifest:** `0b43931d1408ca6b85a3cebb8f82c33e9f7fba88fa011b2df8d9739402789689`; combined log of 131 reasoned commands (`commands-final-replayed.jsonl`).
- **Replay:** every one of the 20 supervised calls (record plus 19 extensions) was replayed offline with a fetch cap of 0 and equalled its recorded report. `replay-19.json` is byte-identical to `extend-19.json` (SHA-256 `53d7854cb0314c69f5724c5164fa253f8d11e679b2339351454b554593786acb`).
- **Legality gate:** `completed-review.ts prepare` on the 100 exact printings, matched by name, set and collector number to retained raw Oracle objects, returned `ready` with no errors or unresolved items (bundle hash `5a6d460fc1fee7cc3d726ec96e4c97a3d5a227b6feaf64e177a6d0c1c27c1012`). This is a construction gate, not a quality score. Two Unfinity cards (Goblin Airbrusher, "Name Sticker" Goblin) pass only on Scryfall's `legalities.commander` field; the knowledge base has no topic on their legality (see `knowledge-gaps.json`).
- **Deck:** 100 cards; 35 lands (34 Mountain, 1 Snow-Covered Mountain) and 65 other cards, mostly Goblins and Treasure/token engines. No card has `game_changer` true. Bracket 2 fit is an unresolved desk estimate; the brief has no budget, cap, set, include or exclude constraints.

## Predeclared bounds and actual use

`assignment.json` was written in the new raw directory before any builder command (`pnpm install --frozen-lockfile` and offline `prepare.ts` followed it; no tracked file changed). Zero retries. The run stopped at the first breach or settled failure by design; none occurred.

| Bound                           | Assigned                                  | Actually used                              |
| ------------------------------- | ----------------------------------------- | ------------------------------------------ |
| Commands (combined log)         | 260                                       | 131                                        |
| Batches (including initial)     | 60                                        | batch 20                                   |
| Extensions                      | 25                                        | 19                                         |
| Provider attempts per extension | 10                                        | max 4 (extensions 2-5: 1, 4, 4, 3)         |
| Provider outcomes               | any settled failure stops                 | 12, all success (4 Scryfall, 8 EDHREC)     |
| Subprocess time                 | 120,000 ms                                | longest 77 s (`extend-17`); replays ≤ 42 s |
| stdout / stderr per process     | 67,108,864 / 1,048,576 bytes              | largest 5.3 MB / 0                         |
| Execution deadline              | `2026-10-29T03:44:34.380Z` (setup + 90 m) | last supervised call ended `02:39:29Z`     |
| Finalization deadline           | `2026-10-29T04:04:34.380Z`                | final inventory generated `02:46:06Z`      |

Setup was `2026-10-29T02:14:34.380Z`. The 12 outcomes were one `Mountain` lookup (extension 2) plus signature EDHREC pages and Scryfall collection lookups (extensions 3-5). The Mountain lookup supplied 34 `addRetrieved` basics because the provider pool only offers Snow-Covered basics and Wastes. Runtime per call grows with the combined log (the extend design replays the prefix): 1 s early, 77 s by extension 17, so a longer build would approach the 120 s bound.

The model was `claude-sonnet-5-5`, with no helper agents. `builder.md` v1 is unchanged (SHA-256 `69d9e82582e244765bae4543ea089fba537a6421adfc345f48b6887c2b19fb8b`); knowledge-base commit `5d2a986c597a71a81fe8aaccc8a639082db35eb7`. PR #256 and holdout inputs were not used or read.

## Inputs

Inputs are the v1 independent-build root's `recipe.json` and `original-pins.json`, copied: `E:/working/agent-sandbox/research/deckbuild/issue-98-independent-build-dev1-v1`. The recipe hash equals `dev-1-recipe.json` in the common-input evidence. Offline `prepare.ts` at this HEAD produced `inputs.json`; a key-sorted comparison with `original-pins.json` differs only in `recommenderVersion`. The 386-card pool and the Oracle objects used for the gate come from the exact path `issue-98-common-input-evidence/dev-1-preparation.json` and the run's own recorded Scryfall responses.

## Decisions

Every command carries its reason in `actions.jsonl` with offered rank and score. All 19 batches were decided in one pass (four decisions then `nextBatch`), and no `explain`, `search` or steering command was used. Ignored cards: Wastes, Snow-Covered Wastes, Krark-Clan Shaman, Gemcutter Buccaneer, Ragavan, Sensation Gorger, Curse of Opulence, Helm of the Host, Molten Duplication, Twinflame and Goblin Razerunners. Late batches were thin, and some filler Goblins (for example Goblin Airbrusher, Akki Ember-Keeper) were accepted as cheap bodies for Krenko's X; that is a judgement, not evidence they help. By the app's heuristic role analysis the deck has ramp 15, draw 13 and removal 16 against targets of 10, 10 and 8.

## Raw evidence

Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-supervised-build-dev1-v2/` (195 files listed in `final-inventory.json` with bytes, SHA-256 and mtime; the inventory cannot hash itself). Key SHA-256 values:

| File                                | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `assignment.json`                   | `7d54d88fc129a043ffceea31b6c4cefc3c286732c9d8278b4cdd38bf5023b38e` |
| `inputs.json`                       | `8e1fecfb7f40cd085352a4f1b9b21fd483ccdd11fd72a77b117b12157b15ead7` |
| `recipe.json`                       | `44a321a498b93548440ffd51c0ad4b4bccd5558ef9e65432df841d6037b58296` |
| `original-pins.json`                | `dbf0d926f4b4bc5a3be029d4aeeda6591184f3363263eb64119299de1ee2ead8` |
| `commands-final-replayed.jsonl`     | `cdf090b0f2f9ae9e3be4ab5c55efd9f0804caec94414b1698618cc930cc81249` |
| `extend-19.json` = `replay-19.json` | `53d7854cb0314c69f5724c5164fa253f8d11e679b2339351454b554593786acb` |
| `ledger.jsonl`                      | `46969250aefd9f13695f3617f2fb2a95bfa5cbf7bceeda6172261b111d56dcb4` |
| `actions.jsonl`                     | `164d918dad87e9ac99fe43b743bccb96ce633f57ebf0b74d6ab9bec22cd9ff1b` |
| `deck.txt`                          | `3517b91e58e1b8bffd9cb93141e72b6b76d19c7034d0ec2743a20377fc223637` |
| `completed-review-input.json`       | `dea3f4d1c3bef360fac7515131b522d56229fb792597ffa9c787610a4d327874` |
| `completed-review.stdout.json`      | `b05295de92a011d62845004f5ecbe9e414e3ed53f59a20984debbd1451e5e8fb` |
| `builder-feedback.md`               | `fbd7f6769403c90eff6f8d829b9b507b1398520bb866a689b6c1ffe641f2d39f` |
| `knowledge-gaps.json`               | `361af74a95d53745c3bdd1cff4d2485666b735475857ec41292120d17d204e5d` |

`state.json` has no `stop.json` beside it. Before the final documentation edit, `pnpm test` (953 pass, 0 fail), `pnpm lint`, `pnpm typecheck` and `pnpm build` all passed; their logs are in `checks/`. The independent auditor verified that the final file passes `prettier --check`. The helper scripts `show.mjs` (read-only report summary), `export.mjs` (offline deck, actions and gate-input export) and `inventory.mjs` are retained in the root.

## Limits

This is one development session on one brief, not a repeat, baseline, or quality evidence, and no reviewer was run. The supervisor bounds each CLI process; it does not bound the builder agent's own activity or aggregate storage. Replay equality covers the CLI reports, not the truth of provider data. Bracket fit, pace, policy currency and the legality of the two Unfinity cards are unresolved. See [builder-cli.md](builder-cli.md) and [v1](supervised-build-evidence-v1.md).

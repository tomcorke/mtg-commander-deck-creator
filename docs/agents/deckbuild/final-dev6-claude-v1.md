# Development-6 Claude builds and dev-1 repeat-2 review

Part of [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98). This slice does not complete acceptance; leave the issue open.

Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-final-dev6-0c62222/`. Executing checkout and origin/main: `0c6222233ac21136a2149b77000b2c264d1ccc29`, which includes the #269 fix ([#272](https://github.com/tomcorke/mtg-commander-deck-creator/pull/272)). Knowledge-base commit `0bb5c7ee52ff5e9b5ee4f4774d8801433a1f1877`. Codex's 5-hour window was exhausted, so every session in this slice used Claude.

## Setup

`prepare.mjs` reran the retained development-6 recipe with `prepare.ts`. It then planned two repeats with `run-round.ts plan`. The prepared inputs equal the [Codex round's](baseline-round-codex-v1.md) except for `recommenderVersion`. The manifest identity is the same retained zero-entry identity (`2000ae23…`). The bounds were declared before launch and match the Codex round: 260 commands, 60 batches, 25 extensions, 10 provider attempts per extension, 120000 ms per subprocess, a 45-minute execution and 5-minute finalization budget per session, and zero retries. The builder prompt hash is unchanged (`69d9e825…`).

Builder model: Claude Sonnet 5.5 (`claude-sonnet-5-5`). Each repeat was a fresh Claude Code subagent session with default effort, and both ran in parallel in separate job directories. Builders executed only through `run-round.ts start/extend`.

## Build outcomes

| Job             | Cards (accepted) | Commands | Extensions | Outcome                                                                                                 |
| --------------- | ---------------: | -------: | ---------: | ------------------------------------------------------------------------------------------------------- |
| development-6-1 |                1 |        1 |          0 | Stopped: `EEXIST` copying a submitted append onto the builder's own `append-1.jsonl` scratch file       |
| development-6-2 |               57 |        8 |          2 | Stopped: extend-3 `invalid`, "Card is not verified legal in Commander" on an `addBasics` Wastes payload |

Both runs stopped at their first settled failure. Neither was retried. The executed prefixes replayed exactly under the supervisor (`replay-0` for job 1, `replay-1` and `replay-2` for job 2).

- In job 1, preflight first refused a 76-name lookup that exceeded the limit of 75. The #269 change worked as intended: the refused payload and its diagnostic were kept as `rejected-1.*`, and the run continued. The builder then wrote a scratch file under a supervisor-owned name, and the supervisor's exclusive copy stopped the run. Tracked in [#273](https://github.com/tomcorke/mtg-commander-deck-creator/issues/273).
- Job 2 copied the `addBasics` example that #272 added to `builder-cli.md`. That example passed the schema but had no `commanderLegality` or `colorIdentity`, so the reducer rejected it. This is a documentation defect introduced by #272. This PR corrects the example and adds a test that runs the documented line through both `parseCommands` and `applyBuilderAction`.

Neither build produced a 100-card deck, a construction gate result or a review. The closest accepted state to 71 cards is job 2's extend-2 at 57 cards. The stopped extend-3 report shows 79 cards, but it is a diagnostic `invalid` report, not an accepted state. No ~71-card development-6 state exists, so no development-6 labels were made and the rank bench was not rerun.

## Dev-1 repeat-2 review

The Codex round's review b1 of the dev-1 repeat-2 deck produced no files. This slice reviewed the same `review-bundle-b`, unchanged, with session instructions version 2 staged in a neutral temporary directory. The reviewer was a fresh Claude Sonnet 5.5 subagent with a 15-minute bound and zero retries. Staged file hashes were unchanged after the review, and `run-round.ts validate` accepted it against `development-1-2/completed-input.json`.

| Review                 | Bracket | Effectiveness | Theme | Idea | Fun | Synergy | Fit         |
| ---------------------- | ------: | ------------: | ----: | ---: | --: | ------: | ----------- |
| dev1 repeat-2 (Claude) |       4 |             3 |     5 |    4 |   4 |       4 | appropriate |

The reviewer reported generic host instructions, a skill catalog, workspace metadata and project agent instructions as ambient context, and no contamination. Isolation is best-effort at bundle level (#265). This is a different reviewer model from the Codex reviews of the other bundles, so its scores are not directly comparable to them. Its main criticisms are 38 Mountains on a very low curve, thin draw and ramp, and a few off-plan artifact-hate Goblins. Scores are desk estimates, not gameplay evidence.

## Specs and holdout box

I did not tick this box. The issue requires holdouts "kept separate by mechanic family". The README states that family assignments are "a declared heuristic, not proof of mechanic independence", and no merged evidence establishes that separation. I could not check it without opening holdout contents, which this slice must not do. Whether the eight development and six holdout briefs validated by `fixed-suite.ts` are enough for the component box is a decision for the issue owner.

## Acceptance effect

- Independent repeats: not met. Development-6 still has no completed build.
- Real labelled suite: not met. There is no ~71-card development-6 state.
- Rank-bench results: not met for the full three-spec suite.
- Specs including holdouts: not met (see above).

No app changes, holdout access, PR #256 use or publishing.

# Supervised build evidence v5: dev-2 reviewer noise and dev-3 stop

Issue [#98](https://github.com/tomcorke/mtg-commander-deck-creator/issues/98), 2026-10-29. This slice adds the missing items from [v4](supervised-build-evidence-v4.md). It gave the v4 dev-2 deck three blind Claude Opus 5.5 reviews in separate fresh sessions, and it ran one new dev-3 build. Three reviews of one identical deck now measure reviewer variation separately from deck variation. The dev-3 build stopped at a settled failure with 83 of 100 cards, so it has no construction gate and no review. Earlier evidence is unchanged.

Raw root: `E:/working/agent-sandbox/research/deckbuild/issue-98-reviews-noise-dev3-v5/`. `final-inventory.sha256` lists 184 files (file SHA-256 `e0bfd180…5546e`).

## Cause of the v4 dev-3 failure

The v4 dev-3 session receipt (`issue-98-v4-audit/dev3-task-receipt.json`) has a host notice: "Claude usage limit reached. This turn is paused until the 5-hour limit resets in 2h 59m". It also has an assistant line, "You've hit your 5-hour limit · resets 12:50pm (Europe/London)", and the error "Claude API rate limit reached". The thread was snoozed until `12:50:00Z`. The cause was the Claude subscription's rolling **5-hour window**. It was not the weekly allowance, which still had headroom, and it was not a T3 host limit. The provider reported the 5-hour cap through its rate-limit error text. Notes are in `dev3-prior-failure-cause.md`.

No session in this slice hit a quota or rate limit.

## Provider usage

`ai-usage` ran before the builder launch and again before the reviewer launches. It reported remaining Claude 5-hour 92% then 90%, Claude weekly 77%, Codex 5-hour 100%, Codex weekly 68%. Codex had more weekly headroom. All sessions still used Claude: the builder model is fixed at Sonnet 5.5 for comparability with v4 dev-2, and the reviewer model is fixed at Opus 5.5 by scope.

| Session         | Provider      | Model               | Options       | Run (UTC)               |
| --------------- | ------------- | ------------------- | ------------- | ----------------------- |
| dev-3 builder   | `claudeAgent` | `claude-sonnet-5-5` | effort `high` | `18:09:04Z`–`18:20:31Z` |
| dev-2 review r1 | `claudeAgent` | `claude-opus-5-5`   | `[]` default  | `18:09:15Z`–`18:11:01Z` |
| dev-2 review r2 | `claudeAgent` | `claude-opus-5-5`   | `[]` default  | `18:09:19Z`–`18:10:42Z` |
| dev-2 review r3 | `claudeAgent` | `claude-opus-5-5`   | `[]` default  | `18:09:23Z`–`18:10:28Z` |

Times come from each session's Claude Code transcript, which is archived in the raw root.

## Dev-2 reviewer noise

All three reviews scored the v4 dev-2 Tatyova deck (bracket 3). Its bundle hash is `ca7b94ff…7e23`, the same as v4. Each review had its own `review-session.ts stage` directory, with byte-identical staged-file digests across the three. Each was launched with T3 `delegate_task` using the runner's unchanged task text, with the Codex target replaced by Claude Opus 5.5 as in [v3](supervised-build-evidence-v3.md). The sessions ran concurrently, and none saw another's output. Review r1 is the blind review of the dev-2 deck that v4 skipped. `collect.ts`, adapted from v3 with only the checkout path changed, repeated `finishReview`'s checks: staged file set and hashes, private input binding, envelope schema and `validateReview`. All three passed.

| Criterion     | r1  | r2  | r3  | Range |
| ------------- | --- | --- | --- | ----- |
| Bracket fit   | 4   | 4   | 4   | 0     |
| Effectiveness | 4   | 4   | 4   | 0     |
| Theme fit     | 4   | 5   | 5   | 1     |
| Idea fit      | 4   | 5   | 4   | 1     |
| Fun           | 4   | 4   | 4   | 0     |
| Synergy       | 4   | 4   | 4   | 0     |

Scores on this identical deck differ by at most one point, and only on theme and idea fit. Reviewer variation alone therefore produced one-point differences on this deck. Comparable one-point differences between decks, such as those v3 saw across three dev-1 decks, cannot confidently be attributed to deck quality alone. All three rated bracket fit `appropriate` with medium confidence. All three flagged the same unresolved pace risk: dense ramp plus Craterhoof Behemoth might win before Bracket 3's six-turn expectation. All three named Tatyova, Avenger of Zendikar and Craterhoof Behemoth among the strongest cards, and Evacuation and Crush of Tentacles among the weakest. They proposed no swaps, because the bundle has no Oracle evidence for cards outside the deck. Their knowledge-gap requests (sourced replacement candidates, goldfish pace data and a definition of earthbend) are untested triage input.

Three reviews of one deck by one model are a small sample on a five-point ordinal scale. They give a spread, not a variance estimate. They do not measure variation between reviewer models.

### Isolation

Each transcript shows only `Read` calls inside the session's own staged directory: the seven staged files, plus a second, offset read of `bundle.json`. None used a shell, other paths, helpers, skills or network tools. All reported `none-observed` contamination.

The isolation is best-effort, not enforced. T3 `delegate_task` with `shared` isolation ran each reviewer in the operator worktree. The reviewers' ambient context therefore included host and project instructions, the skill catalog, account identity, the branch name `research/98-reviews-noise-dev3` and recent commit subjects. Those name #98 review work in general terms but disclose no deck, decision or judgement. Review r3's envelope was transcribed from `task_status` and matches its transcript's final message exactly. The r1 and r2 envelopes were extracted from their transcripts.

## Dev-3 build

The spec is DEVELOPMENT3 (`dev-3`): Ayula, Queen Among Bears, **bracket 1**, from the exact inputs `issue-98-common-input-evidence-batch-2/dev-3-recipe.json` and `dev-3-preparation.json`, as named in v4. The builder was one fresh session with the same model and configuration as v4 dev-2 (Sonnet 5.5, effort high), using unchanged `builder.md` v1, no helpers, and no access to prior builds or reviews. It ran `supervise.ts` from the root checkout at clean main `5c47e9b2ad067dfe05d33a41f74bc8d0f423ed14`. It read the docs in the operator worktree at the same commit. Its tool calls show no holdout path and no listing of `research/deckbuild`.

The operator wrote `build-dev3/assignment.json` (`f96840d0…22a4`) before launching the builder. Its bounds match v4: 260 commands, 60 batches, 25 extensions, 10 provider attempts per extension, 120000 ms per subprocess, 67108864 stdout and 1048576 stderr bytes, zero retries. Setup was `18:08:29Z`, with an execution deadline of `19:38:29Z` and a finalization deadline of `19:58:29Z`. The stop rule also lists quota and rate limits.

| Measure                   | Value                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| Outcome                   | **stopped**: `extend-14` exited 1, status `invalid`                |
| Stop time                 | `18:17:36.661Z` (`stop.json` `038cafac…bcc`)                       |
| Commands                  | 101 verified, 106 including the stopped append                     |
| Extensions / batches      | 13 verified plus 1 stopped / 14 verified                           |
| Provider outcomes         | 14, all HTTP 200; at most 4 per extension; no quota events         |
| Replays                   | record and extensions 1–13 byte-identical to replays 0–13          |
| Last verified manifest    | `c20034d53a0000b0eb2d9b9f830f2a907dc8551606fd29a714479cc25ffd1d2b` |
| Deck at last verified run | 83 of 100 cards: 36 lands, 47 nonland, 42 with the Bear type       |

The failure is settled and was not retried. The builder had decided every remaining card in the 49-card prepared pool, and then it called `nextBatch` with an empty queue. `recommend` returns `Too few recommendation cards` when fewer than four legal undecided candidates remain (`src/domain/recommender.ts`). The stopped call made no provider requests. The builder disclosed that it called `nextBatch` on purpose, to see what lay past the pool, before adding support cards with `lookup`/`addRetrieved`. Under the stop rule, that probe ended the run.

A narrow prepared pool cannot fill a 100-card deck on its own. v4 dev-2 added 79 cards from lookups for the same reason. Whether an exhausted pool should end in an `invalid` stop rather than an empty batch is a triage candidate for the recommender or supervisor, not an established defect. The builder's feedback and six knowledge gaps are kept verbatim under `build-dev3/final/`. Final-folder inventory: 147 files, `inventory.sha256` `ffb10e26…eff2`.

## Acceptance status

None of #98's acceptance boxes is fully met by this slice:

- Reviewer-noise measurement: one identical deck received three fresh, separate reviews, but isolation was best-effort and the reviewers shared the operator worktree. The checklist says qualified evidence does not tick a box, so this box stays unticked until enforced isolation exists.
- Independent repeat builds and three-bracket baseline: dev-2 still has one fresh build, and dev-3 has a stopped, incomplete build. Neither qualifies.
- Enforced reviewer isolation: not addressed.

No application changes, labels, holdout-content access, live provider requests outside supervised calls, PR #256 use, or publishing occurred.

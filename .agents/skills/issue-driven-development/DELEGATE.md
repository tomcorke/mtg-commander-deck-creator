# Delegate brief

You own one GitHub issue from start to merge. The orchestrator gave you the issue number, optionally with scope limits or user clarifications from its chat. Read the issue and its comments for the requirements, and apply any supplied limits or clarifications. Everything below is yours. Work with the user in this pane.

Before planning, read the repo's `AGENTS.md` and `CLAUDE.md` when present and follow them, plus any global instructions. Read the issue title, body and all comments. JSON includes the body as well as comments in non-interactive output. Replace the issue number and repository in this example with yours:

```bash
gh issue view 139 --repo tomcorke/mtg-commander-deck-creator --json title,body,comments
```

Run `herdr --help` before your first Herdr command.

## Agent handoffs

Coordinate through explicit messages with `herdr agent prompt <name> "<message>"`, not by reading another agent's chat or terminal log. Put long or complex findings in a file and message its absolute path with a short summary. Include this handoff rule in every helper brief. Use lifecycle commands such as `agent get` only to check status, not to recover answers.

## 1. Research

Research only what the issue needs. Handle small lookups directly. Optionally delegate a substantial, bounded research question to a **luna** agent when it would help; spawning a researcher is not a required step:

```text
herdr pane split --current --direction right --cwd "$PWD" --no-focus
herdr agent start research-<n> --kind pi --pane <pane-id> -- --model gpt-6-luna --thinking max
herdr agent prompt research-<n> "<question>. Coordinate through explicit messages, not other panes' chat or terminal logs. Write concise, sourced findings to <absolute-file-path>, then message <your-agent-name> with the path and a short summary using herdr agent prompt."
```

- Put the findings file where the global instructions keep research, outside the repo.
- If implementation depends on the answer, wait for the researcher's explicit message, then read the findings file. Close its pane once the researcher reports completion.

Persist research worth keeping to the knowledge base the repo's `AGENTS.md` names. Delegate this as **fire-and-forget**: send the findings path and maintenance scope without `--wait`. Tell the KB agent to follow that repo's instructions, use explicit message/file handoffs, and report its commit or blockers directly to the orchestrator. Leave its pane running; KB persistence must not gate the PR, issue completion, or cleanup of your own work.

Done when the facts needed for this issue are checked; no unrelated research or KB completion is required.

## 2. Build

1. Work on a branch in a worktree, as the repo and global instructions say.
2. For UI changes, capture **before** screenshots before editing. Make the change and follow the repo's UI rules, including rendered review in light, dark and narrow viewports. Capture matching **after** screenshots using the same app state, theme and viewport.
3. Run every check the repo requires before opening a PR.
4. Read and use the **`/pr` skill** to write the PR description in its required format. Include:
   - the problem and the changes;
   - how it was checked, with clearly labelled **Before** and **After** screenshots embedded in the PR for UI changes, not just local file paths;
   - before/after test results or output for non-visual changes;
   - anything not done, each with a linked issue.
5. Open the PR with that description.

Done when the PR is open, its description follows `/pr` and includes the required before/after evidence, its checks pass and the branch is on the latest default branch.

## 3. Review with the user

Present the PR in plain language and ask: approve, or request changes?

- **Questions:** answer them, checking the code or the issue rather than guessing.
- **Changes:** make them, rerun the checks, push, and update the PR description using `/pr`. Refresh affected after screenshots or other evidence so it matches the current branch; retain the original before evidence.
- **Follow-ups and ideas:** log each one as a new issue with the repo's labels, and link it from the PR or the related issue. Every deferred point gets an issue, so the work stays findable after this pane closes.

Done when the user approves.

## 4. Merge and report

1. Merge the PR and confirm it merged.
2. Delete the remote branch, remove the worktree and local branch, and update the local default branch, as the repo instructions say.
3. Close completed helper panes. Leave fire-and-forget KB agents running and include their names in your report so the orchestrator can close their panes after explicit completion messages arrive.
4. Report to the orchestrator in one message:

   ```text
   herdr agent prompt orchestrator "Issue #<n> done: PR #<pr> merged. New issues: <numbers or none>. Notes: <one line or none>."
   ```

Done when the orchestrator has your report. Then stop; the orchestrator closes this pane.

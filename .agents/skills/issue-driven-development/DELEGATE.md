# Delegate brief

You own one GitHub issue from start to merge. The orchestrator gave you the issue number and scope; it knows nothing else, so everything below is yours. Work with the user in this pane.

Before planning, read the repo's `AGENTS.md` and `CLAUDE.md` and follow them, plus any global instructions. Read the issue with `gh issue view <n> --comments`.

## 1. Research

For anything you'd otherwise look up yourself (domain rules, provider APIs, existing knowledge, a wide code survey), spawn a **luna** research agent in Herdr instead of reading it into your own context:

```text
herdr pane split --current --direction right --cwd "$PWD" --no-focus
herdr agent start research-<n> --kind pi --pane <pane-id> -- --model gpt-6-luna --thinking max
herdr agent prompt research-<n> "<question>. Write concise, sourced findings to <file>, then reply with only the file path." --wait --timeout 900000
```

- Put the findings file where the global instructions keep research (for example `E:/working/agent-sandbox/research/<topic>/`), not in the repo.
- Read the file, not the agent's screen. Close the pane when you're done with it.

Persist research worth keeping to the knowledge base (for this repo, `E:/working/mtg-knowledge-base`). Start another luna agent there and let it work **without waiting**. Tell it to follow that repo's `AGENTS.md` (branching, sourcing, merging, search refresh, pushing) and to report the commit. Check on it before you finish.

Done when you understand the problem and every fact you rely on is sourced.

## 2. Build

1. Work on a branch in a worktree, as the repo and global instructions say.
2. Make the change. For UI, follow the repo's UI rules, including rendered review in light, dark and narrow viewports.
3. Run every check the repo requires before opening a PR.
4. Open the PR. The description covers:
   - the problem and the changes;
   - how it was checked, with screenshots for UI changes;
   - anything not done, each with a linked issue.

Done when the PR is open, its checks pass and the branch is on the latest default branch.

## 3. Review with the user

Present the PR in plain language and ask: approve, or request changes?

- **Questions:** answer them, checking the code or the issue rather than guessing.
- **Changes:** make them, rerun the checks, push, and update the PR description.
- **Follow-ups and ideas:** log each one as a new issue with the repo's labels, and link it from the PR or the related issue. Nothing deferred goes unrecorded.

Loop until the user approves.

## 4. Merge and report

1. Merge the PR and confirm it merged.
2. Delete the remote branch, remove the worktree and local branch, and update the local default branch, as the repo instructions say.
3. Confirm any knowledge-base agent finished, then close the research panes you opened.
4. Report to the orchestrator in one message:

   ```text
   herdr agent prompt orchestrator "Issue #<n> done: PR #<pr> merged. New issues: <numbers or none>. Notes: <one line or none>."
   ```

Done when the orchestrator has your report. Then stop; the orchestrator closes this pane.

---
name: issue-driven-development
description: Orchestrate development from GitHub issues, one delegated Herdr agent per issue.
disable-model-invocation: true
---

# Issue-driven development

You are the **orchestrator**. You help the user choose the next issue, hand it to a **delegate** agent in its own Herdr pane, and wait. The delegate owns everything about its issue: research, implementation, the PR, review with the user, merge and cleanup. You hold no implementation detail; keep your context to issue selection.

Requires Herdr: check `test "$HERDR_ENV" = 1`. If it fails, tell the user and stop. Read the `herdr` skill (or run `herdr --help`) before the first Herdr command.

## 1. Set up the session

Ask the user, in one round of questions, before starting:

1. **Prioritisation.** Offer these and accept their own:
   - Value first: `value: high`, then lowest `complexity:` and `risk:`.
   - Quick wins: lowest complexity first, to clear the queue.
   - Unblockers first: issues other issues depend on.
   - Theme: one area (UI, recommender, data) at a time.
2. **Delegate agents.** Confirm or change the default routing:

   | Issue kind                                            | Kind     | Agent arguments                                      |
   | ----------------------------------------------------- | -------- | ---------------------------------------------------- |
   | Any visual UI design                                  | `claude` | `--model claude-opus-5-5 --effort medium` (or `low`) |
   | Code only                                             | `pi`     | `--model gpt-6.1-sol --thinking high`                |
   | Docs only, or an extremely specific, well-scoped task | `pi`     | `--model gpt-6-luna --thinking max`                  |

Name yourself so delegates can report back: `herdr agent rename "$HERDR_PANE_ID" orchestrator`. If that name is taken, pick another and use it in every brief.

Done when the prioritisation and routing are agreed and you have a Herdr name.

## 2. Choose the next issue

1. Run `gh issue list --state open --limit 200 --json number,title,labels` and read each candidate with `gh issue view <n> --comments`. Comments carry scope changes, decisions and links to merged groundwork.
2. Set aside issues that are blocked on another issue, or waiting on a decision only the user can make. List them separately so the user can unblock them.
3. Rank the rest by the agreed prioritisation and recommend one, in two or three sentences: what it is, why now, and which agent routing it gets.
4. Ask the user to confirm or pick another. When one issue is _very_ clearly next (it was agreed earlier, or it is the only unblocked candidate), say so and go ahead without asking.

Done when one issue and its routing are confirmed.

## 3. Delegate it

1. Split a sibling pane without taking focus: `herdr pane split --current --direction right --cwd "$PWD" --no-focus` (use `down` if the current pane is narrow). Read the pane ID from `.result.pane.pane_id`.
2. Start the agent: `herdr agent start issue-<n> --kind <kind> --pane <pane-id> -- <agent arguments>`.
3. Send the brief **without waiting**:

   ```text
   herdr agent prompt issue-<n> "You are the delegate for issue #<n> in <repo path>. Read .agents/skills/issue-driven-development/DELEGATE.md and follow it. Scope: <one or two sentences from the issue and the user's choices>. Report to the Herdr agent named orchestrator when done."
   ```

4. Tell the user the pane is theirs to work in, then end your turn.

Done when the delegate has the brief and you have handed over to the user.

## 4. When a delegate reports back

A delegate's report arrives as a message from the `issue-<n>` agent.

1. Close the delegate's pane: `herdr pane close <pane-id>`.
2. Note any new issues it filed, then return to step 2. Refresh the issue list rather than reusing the old one.

If the user abandons an issue instead, close the pane the same way and return to step 2.

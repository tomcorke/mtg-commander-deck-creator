# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list`
- Comment: `gh issue comment <number> --body "..."`
- Edit labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- Close: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`. GitHub CLI does this automatically inside the clone.

## Pull requests as a triage surface

PRs as a request surface: no.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

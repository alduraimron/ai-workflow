---
profile: <solo|team>
project_root: <absolute project root>
state: local-only
artifact_language: English
chat_language: Indonesian
web_research: official-public-docs-only
protected_branches:
  - main
checks:
  lint: pending
  typecheck: pending
---

# Workflow Configuration

## Profile

- Profile: `<solo|team>`
- State is local-only under `.pi/workflow/`.
- Never modify `AGENTS.md`, `CLAUDE.md`, `.gitignore`, or shared workflow files.

## Git policy

- The workflow never creates or switches branches.
- Implementation and commit refuse a protected branch or a dirty worktree outside `.pi/workflow/`.
- The workflow never pushes, merges, rebases, resets, stashes, or deploys.
- Only `/skill:workflow-commit approve` may create a commit.

## Verification policy

- Lint: `<configured command>`
- Typecheck: `<configured command>`
- Manual QA is performed by the user. The model creates the checklist and records user-reported results only.

## Research policy

- Public documentation may be researched automatically when needed.
- Never include private source, secrets, internal URLs, or user data in a web query.

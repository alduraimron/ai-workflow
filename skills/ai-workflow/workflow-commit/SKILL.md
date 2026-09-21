---
name: workflow-commit
description: Prepare and, only after a separate explicit approval, create one scoped final Git commit for the active workflow work item. Use /skill:workflow-commit to show the packet and /skill:workflow-commit approve to commit. It never pushes, merges, creates branches, or commits unapproved paths.
disable-model-invocation: true
---

# Final Commit Gate

Usage:

```text
/skill:workflow-commit
/skill:workflow-commit approve
```

## Review packet

Without `approve`:

1. Require `status: ready_for_commit` and `Manual QA: passed`.
2. Validate the work and rerun the scope gate:

```bash
node ../scripts/validate-work.mjs .pi/workflow/current-work.md
node ../scripts/check-workflow-scope.mjs scope .pi/workflow/current-work.md
```

3. Rerun the configured lint and typecheck commands. A missing command blocks the commit.
4. Read the final diff and show a concise Indonesian packet: allowed changed files, scope result, checks, QA result, proposed English commit message, and known limitations.
5. Set `status: awaiting_commit_approval` and `Commit review: shown`. Do not run any Git mutation.

## Explicit commit

With `approve`:

1. Require `status: awaiting_commit_approval`.
2. Record `Commit approval: confirmed` in `current-work.md`.
3. Run exactly:

```bash
node ../scripts/commit-approved-work.mjs .pi/workflow/current-work.md --approve
```

The script rechecks branch, HEAD, ignored paths, scope, and staged paths. It stages only the exact approved changed source paths, creates one commit, archives the work under `.pi/workflow/history/`, and resets `current-work.md` to idle.

Never use `/commit`, `git add -A`, `git push`, merge, rebase, reset, stash, checkout, or branch-changing commands.

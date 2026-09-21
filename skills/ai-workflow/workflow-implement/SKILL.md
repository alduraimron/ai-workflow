---
name: workflow-implement
description: Implement one fully approved workflow spec from .pi/workflow/current-work.md through final lint, typecheck, and a user manual-QA checklist. Use only when the user explicitly runs /skill:workflow-implement approve. It never commits, merges, pushes, or changes branches.
disable-model-invocation: true
---

# Implement Approved Work

Usage:

```text
/skill:workflow-implement approve
```

No `approve` argument means inspect and report the current state only. Do not edit source.

## Normal work preflight

For feature, bugfix, and refactor work:

1. Read and validate `current-work.md`:

```bash
node ../scripts/validate-work.mjs .pi/workflow/current-work.md
```

2. Require `status: awaiting_spec_approval` and the explicit `approve` argument.
3. Run preflight:

```bash
node ../scripts/check-workflow-scope.mjs preflight .pi/workflow/current-work.md
```

4. If preflight reports `main`, another protected branch, a dirty path outside `.pi/workflow`, no named branch, or no Git commit, stop. Do not edit source.
5. Record the returned branch, commit, and ignored digest in `current-work.md`; set `status: implementing` and `Spec approval: confirmed`.

## Bootstrap exception

For `type: bootstrap`, require the explicit approval but do not require Git. Verify that the target directory is empty, then run only the exact scaffold command recorded in the approved spec. The command must disable automatic Git initialization. Do not initialize Git, create or switch a branch, commit, push, deploy, or do post-scaffold feature work. On success, generate `project-overview.md`, archive the bootstrap record under `.pi/workflow/history/bootstrap/`, and reset `current-work.md` to `idle`. Report the result and instruct the user to prepare a clean non-protected branch before feature implementation.

## Implementation rules

- Implement all approved steps without pausing for per-step approval or progress reports.
- Modify only source, tests, or migrations explicitly listed in the approved allowed paths. `.pi/workflow/**` is always allowed for state.
- Never add a dependency, edit a manifest, lockfile, config, CI, documentation, instructions, or a new path unless a new spec is approved.
- If a user preference, behavior, path, contract, or architecture choice is unresolved, set status `blocked`, explain the exact issue in Indonesian, and return to the relevant planning skill.
- Never run `git add`, `git commit`, `git push`, merge, rebase, reset, stash, checkout, or branch-changing commands.

## Final verification and QA handoff

After all implementation steps:

1. Run the scope gate:

```bash
node ../scripts/check-workflow-scope.mjs scope .pi/workflow/current-work.md
```

2. Run the user-confirmed lint and typecheck commands from the work state. If either remains `pending`, stop and ask the user. Never invent a command or silently skip it.
3. Record exact command, exit status, and concise result in `current-work.md`.
4. Create an English manual QA checklist based on acceptance criteria. Set `status: qa_pending` and `Manual QA: pending`.
5. Give only a concise Indonesian final packet: changed paths, checks, QA steps, and next command `/skill:workflow-qa`.

Never claim manual QA passed without the user's report.

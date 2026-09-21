---
name: workflow-setup
description: Initialize the explicit local-only Pi workflow for a project. Use only when the user runs /skill:workflow-setup solo or /skill:workflow-setup team. Creates workflow state under .pi/workflow, never modifies AGENTS.md or shared repository workflow files.
disable-model-invocation: true
---

# Workflow Setup

Usage:

```text
/skill:workflow-setup solo
/skill:workflow-setup team
```

This is an explicit setup command. Reject any profile other than `solo` or `team`.

## Non-negotiable boundary

- Never edit `AGENTS.md`, `CLAUDE.md`, `.gitignore`, README, CI, source, tests, dependency manifests, lockfiles, or team documentation.
- The only project writes are `.pi/workflow/**` and one idempotent `/.pi/` entry in `.git/info/exclude` when Git exists.
- Read existing instructions such as `AGENTS.md`; obey them without copying or changing them.
- Workflow artifacts are English. Chat summaries are Indonesian.

## Preflight

1. Resolve the project root. For `team`, require a Git worktree. For `solo`, an empty or already scaffolded directory is allowed.
2. If `.pi/workflow/config.md` already exists, do not overwrite it. Report the existing profile and direct the user to the relevant next command.
3. If `current-work.md` exists with a status other than `idle` or `archived`, stop. One active work item is allowed.
4. Inspect `git status --porcelain=v1 -z --untracked-files=all` when Git exists. If any change outside `.pi/workflow/**` exists, stop before writing state and show the exact paths.
5. Read project instructions, package manifests, lockfiles, and existing commands only as needed to detect stack, package manager, lint, and typecheck candidates.
6. Do not assume a detected command is desired. Ask the user to confirm the lint and typecheck command when either is unclear or absent.

## Create local state

1. Create `.pi/workflow/` and its `history/features`, `history/bugfixes`, and `history/refactors` directories.
2. If `.git/` exists, add exactly `/.pi/` to `.git/info/exclude` if it is not already present. Do not modify `.gitignore`.
3. Create `config.md` from [`../shared/CONFIG-TEMPLATE.md`](../shared/CONFIG-TEMPLATE.md), filling the profile, absolute root, detected and user-confirmed checks, and policy values.

## Team profile

1. If `.pi/workflow/project-overview.md` already exists, do not rescan the repository. Report that it exists and point to `/skill:workflow-refresh-context` for an explicit refresh.
2. Otherwise perform one bounded read-only survey of the repository: structure, runtime, framework, package manager, lint/typecheck commands, entry points, feature conventions, and applicable project instructions.
3. Write `project-overview.md` from [`../shared/PROJECT-OVERVIEW-TEMPLATE.md`](../shared/PROJECT-OVERVIEW-TEMPLATE.md). Cite source paths for observed facts and label anything else as user-confirmed.
4. A protected branch may be surveyed, but implementation and commit will refuse it.

## Solo profile

1. If an app already exists, create `project-overview.md` from the observed stack and tell the user to start `/skill:workflow-discovery` for product planning.
2. If no app exists, initialize configuration only, then ask for a short idea and direct the user to `/skill:workflow-discovery "<idea>"`.
3. Do not run a scaffold command in setup. Discovery creates a reviewed bootstrap spec first.

## Completion response

State the profile, state path, detected checks and their confirmation status, whether the overview was generated, and the exact next command. Keep it concise.

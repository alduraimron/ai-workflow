---
name: workflow-refresh-context
description: Explicitly refresh the private one-time project overview for a team workflow after the repository changes materially. Use only when the user runs /skill:workflow-refresh-context. It writes only .pi/workflow/project-overview.md and never edits shared files.
disable-model-invocation: true
---

# Refresh Team Context

## Preconditions

- Read `.pi/workflow/config.md`; stop unless `profile: team`.
- Require a clean Git worktree outside `.pi/workflow/**`. If it is dirty, list paths and stop.
- Read `AGENTS.md` and other applicable instructions without modifying them.

## Refresh

1. Survey only stack, project structure, relevant entry points, package commands, conventions, and project instructions.
2. Replace `.pi/workflow/project-overview.md` using [`../shared/PROJECT-OVERVIEW-TEMPLATE.md`](../shared/PROJECT-OVERVIEW-TEMPLATE.md).
3. Cite source paths for observed facts. Keep user preferences in work specs, not in the overview.
4. Do not modify source, tests, config, docs, dependencies, CI, Git state, or any file outside `.pi/workflow/**`.

Respond concisely in Indonesian with what context changed and the next command.

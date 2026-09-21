---
name: workflow-discovery
description: Interview a user with a short product idea and create reviewed solo-project plans plus an optional bootstrap spec under .pi/workflow. Use only when the user explicitly runs /skill:workflow-discovery for a solo profile.
disable-model-invocation: true
---

# Solo Discovery

Usage:

```text
/skill:workflow-discovery "short product idea"
```

## Preconditions

- Read `.pi/workflow/config.md`; stop unless `profile: solo`.
- Read any existing `project-plan.md`, `build-plan.md`, and `project-overview.md` before asking repeated questions.
- If `current-work.md` has a status other than `idle` or `archived`, stop. One active work item is allowed.
- Write only under `.pi/workflow/**`. Never modify source, Git state, project instructions, or shared files.

## Preference-first interview

The user should not need a long prompt. Start from the short idea and ask concise batches of one to three questions. Ask about preferences, not just blockers:

- target user and desired outcome;
- behavior and UX preference;
- scope and deliberate exclusions;
- stack, package manager, and scaffold preference;
- important tradeoffs, data, privacy, or deployment constraints.

Do not ask for facts that can be discovered locally. Do not silently choose product behavior. When a technical convention is clear from an existing scaffold, cite it. When a product choice is unclear, ask.

Use this while clarification remains:

```md
## What I understand
- ...

## Open questions
1. ...

No source code or shared files changed.
```

## Draft plans

Once material questions are resolved:

1. Draft `project-plan.md` from [`../shared/PROJECT-PLAN-TEMPLATE.md`](../shared/PROJECT-PLAN-TEMPLATE.md).
2. Draft `build-plan.md` from [`../shared/BUILD-PLAN-TEMPLATE.md`](../shared/BUILD-PLAN-TEMPLATE.md).
3. Show both plans in chat and wait for explicit user approval before writing or replacing them.
4. If a scaffold is needed, create `current-work.md` from [`../shared/BOOTSTRAP-WORK-TEMPLATE.md`](../shared/BOOTSTRAP-WORK-TEMPLATE.md) with the exact scaffold command, target directory, and user-confirmed choices. Set `status: awaiting_spec_approval` and stop.

The bootstrap command must run only later through `/skill:workflow-implement approve`. It must disable automatic Git initialization and may not create a branch, commit, push, or deploy.

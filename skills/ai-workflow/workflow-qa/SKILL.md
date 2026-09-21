---
name: workflow-qa
description: Present and record user-performed manual QA for the active workflow work item. Use only when the user explicitly runs /skill:workflow-qa, /skill:workflow-qa pass, or /skill:workflow-qa fail <details>. It never drives a browser or claims QA passed without user evidence.
disable-model-invocation: true
---

# Manual QA

Usage:

```text
/skill:workflow-qa
/skill:workflow-qa pass
/skill:workflow-qa fail <what failed>
```

## Rules

- Read `.pi/workflow/current-work.md`.
- This skill never edits source code, starts an application, uses browser automation, or runs external QA.
- Workflow artifacts remain English. Explain the requested user action in concise Indonesian.

## No result argument

When status is `qa_pending`, show the exact English checklist stored in `## Manual QA`, summarize it in Indonesian, and wait. Do not change lifecycle state.

## Pass

Only accept `pass` when the user explicitly reports every checklist item passed. Record the user result in `current-work.md`, set `Manual QA: passed`, and set `status: ready_for_commit`. Tell the user to run `/skill:workflow-commit`.

## Fail

Record the reported failure, set `Manual QA: failed`, and set `status: qa_failed`. Do not repair it here. Tell the user to run `/skill:workflow-implement` after confirming the fix remains in the approved scope. Any new scope or preference requires replanning and a new spec approval.

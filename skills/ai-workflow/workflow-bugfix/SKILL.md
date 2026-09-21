---
name: workflow-bugfix
description: Turn a short bugfix request into a reviewed, scoped workflow spec under .pi/workflow/current-work.md. Use only when the user explicitly runs /skill:workflow-bugfix. It discovers and plans but never edits source code.
disable-model-invocation: true
---

# Bugfix Discovery and Spec

Usage:

```text
/skill:workflow-bugfix "short bug description"
```

## Rules

Follow the same discovery, privacy, path-boundary, and approval rules as [`../workflow-feature/SKILL.md`](../workflow-feature/SKILL.md), with these differences:

- Set `type: bugfix`.
- Ask for the observed symptom, desired behavior, affected user path, urgency, and user preferences before deciding the fix.
- Reproduction is useful but is not mandatory. Do not claim the bug was reproduced unless evidence exists.
- Do not add a test by default. A test is allowed only when the user approves its path in the spec.
- Clearly distinguish observed code facts from a proposed root cause.

Write an English `current-work.md` with `status: awaiting_spec_approval`, show the Indonesian summary, and stop for `/skill:workflow-implement approve`.

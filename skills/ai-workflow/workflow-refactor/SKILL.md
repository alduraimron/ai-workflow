---
name: workflow-refactor
description: Turn a short refactor request into a reviewed, scoped workflow spec under .pi/workflow/current-work.md. Use only when the user explicitly runs /skill:workflow-refactor. It discovers and plans but never edits source code.
disable-model-invocation: true
---

# Refactor Discovery and Spec

Usage:

```text
/skill:workflow-refactor "short refactor goal"
```

## Rules

Follow the same discovery, privacy, path-boundary, and approval rules as [`../workflow-feature/SKILL.md`](../workflow-feature/SKILL.md), with these differences:

- Set `type: refactor`.
- Ask the user what outcome, risk tolerance, behavior change policy, and cleanup boundary they prefer. Do not assume the refactor is behavior-preserving.
- Inspect relevant callers and contracts before proposing paths.
- State expected behavior changes, if any, in scope and QA criteria.
- Do not add tests, documentation, dependencies, or config changes unless explicitly approved in the spec.

Write an English `current-work.md` with `status: awaiting_spec_approval`, show the Indonesian summary, and stop for `/skill:workflow-implement approve`.

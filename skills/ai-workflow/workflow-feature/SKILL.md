---
name: workflow-feature
description: Turn a short feature request into a preference-first, reviewed workflow spec under .pi/workflow/current-work.md. Use only when the user explicitly runs /skill:workflow-feature. It performs discovery but never edits source code.
disable-model-invocation: true
---

# Feature Discovery and Spec

Usage:

```text
/skill:workflow-feature "short feature idea"
```

For a solo project with no argument, select the first unchecked item in `build-plan.md`.

## Boundary

- Read project instructions, relevant source, and `.pi/workflow` context. Never modify them except workflow state under `.pi/workflow/**`.
- Never edit `AGENTS.md`, `CLAUDE.md`, `.gitignore`, documentation, dependencies, configuration, CI, or source code during this skill.
- Public documentation research is allowed when technical facts require it. Never include private code, internal URLs, secrets, or user data in a web query.

## Discovery

1. Read `config.md` and `project-overview.md`. In solo mode, also read project and build plans.
2. If `current-work.md` has a status other than `idle` or `archived`, stop. One active work item is allowed.
3. When Git exists, inspect `git status --porcelain=v1 -z --untracked-files=all`. If any path outside `.pi/workflow/**` is dirty, stop before creating a spec and report the exact paths.
4. Inspect only the feature-relevant source paths and existing project instructions.
5. Separate observed facts, user decisions, and inferences.
6. Ask concise batches of one to three questions until user-facing behavior, UX preferences, scope, exclusions, acceptance criteria, and allowed paths are explicit. Do not reduce the interview to blockers.
7. Propose narrow allowed paths. Tests and migrations are included only when explicitly approved. A dependency, lockfile, config, docs, CI, or shared file requires a scope amendment and new spec approval.

## Write the spec

Create `current-work.md` from [`../shared/CURRENT-WORK-TEMPLATE.md`](../shared/CURRENT-WORK-TEMPLATE.md):

- use `type: feature` and `status: awaiting_spec_approval`;
- keep base branch, commit, and ignored digest as `pending` until implementation preflight;
- in solo mode, record the selected build-plan checkbox ID as `build_plan_item`; use `pending` when the request is not yet a plan item;
- write every artifact section in English;
- include the exact user preferences, narrow allowed paths, forbidden paths, steps, checks, manual QA criteria, and a proposed English commit message;
- set `Open questions` to `None` only when every material preference is resolved.

Present a concise Indonesian spec summary, including allowed and forbidden paths, then stop. Do not implement. The next action is `/skill:workflow-implement approve`.

## Solo build plan

Do not check an item merely because a spec exists. The final commit path checks the recorded `build_plan_item` only after a successful commit.

---
id: <kebab-case-id>
title: <work title>
profile: <solo|team>
type: <feature|bugfix|refactor>
status: draft
build_plan_item: pending
project_root: <absolute project root>
base:
  branch: pending
  commit: pending
  ignored_digest: pending
allowed_paths:
  - .pi/workflow/**
  - <narrow approved implementation path>
forbidden_paths:
  - AGENTS.md
  - CLAUDE.md
  - .gitignore
  - README.md
  - docs/**
  - .github/**
  - package.json
  - package-lock.json
  - pnpm-lock.yaml
  - yarn.lock
  - bun.lockb
checks:
  lint: pending
  typecheck: pending
commit:
  message: pending
---

# Current Work: <work title>

## Objective

<The user-confirmed outcome.>

## User preferences

- <Behavior, UX, tradeoff, or constraint explicitly confirmed by the user.>

## Scope

- <Included behavior.>

## Out of scope

- <Explicit exclusions.>

## Discovery findings

- `<path>`: <Observed fact.>

## Open questions

- <Unresolved material question, or None.>

## Confirmed decisions

- <Explicit user decision.>

## Allowed changes

- `<exact source path covered by allowed_paths>`

## Implementation steps

1. <Smallest implementation sequence.>

## Acceptance criteria

- <Observable behavior.>

## Verification

- Lint: `<command>`
- Typecheck: `<command>`
- Scope: run the AI Workflow scope check for this current-work specification before implementation or commit (see the `workflow-implement` and `workflow-commit` skills for the exact command).

## Manual QA

1. <User-performed reproducible action.>
2. <Expected result.>

## Commit proposal

- `<type>: <short English subject>`

## Research references

- None

## Approval record

Spec approval: pending
Manual QA: pending
Commit review: pending
Commit approval: pending

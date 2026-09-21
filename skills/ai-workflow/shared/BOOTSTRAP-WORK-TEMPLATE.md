---
id: <kebab-case-id>
title: Bootstrap <project title>
profile: solo
type: bootstrap
status: awaiting_spec_approval
project_root: <absolute target directory>
bootstrap:
  command: <exact approved scaffold command>
  target: <empty target directory>
checks:
  lint: pending
  typecheck: pending
commit:
  message: pending
---

# Current Work: Bootstrap <project title>

## Objective

<Create the user-approved initial application scaffold.>

## User preferences

- <Confirmed stack, package manager, and starter choices.>

## Scope

- Run exactly one approved scaffold command in the approved empty target directory.

## Out of scope

- No Git initialization, branch creation, commit, push, deployment, dependency changes beyond the scaffold output, or post-scaffold feature work.

## Discovery findings

- <Environment fact or user decision.>

## Open questions

None

## Confirmed decisions

- <The exact scaffold command was approved.>

## Allowed changes

- The scaffold output in the approved empty target directory only.

## Implementation steps

1. Verify the target directory is empty.
2. Run the exact approved scaffold command.
3. Report the generated project and next manual Git action.

## Acceptance criteria

- The scaffold command exits successfully.
- The generated project has the selected stack.

## Verification

- Inspect the scaffold command exit status and generated project manifest.

## Manual QA

- Start the generated project only if the approved scaffold command documents a safe local command.

## Commit proposal

- No commit is created during bootstrap.

## Research references

- None

## Approval record

Spec approval: pending
Manual QA: pending
Commit review: pending
Commit approval: pending

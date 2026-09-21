# AI Workflow

A local-only, explicit workflow for Pi.

## Core loop

```text
short idea
-> preference-first discovery
-> reviewed spec
-> implement to final
-> lint and typecheck
-> user manual QA
-> reviewed commit packet
-> explicit commit
```

## Profiles

- `solo`: product planning, build plan, and approved scaffold support.
- `team`: one private repository overview plus scoped personal feature work. Shared files and instructions stay untouched.

## Commands

```text
/skill:workflow-setup solo
/skill:workflow-setup team
/skill:workflow-discovery
/skill:workflow-feature "..."
/skill:workflow-bugfix "..."
/skill:workflow-refactor "..."
/skill:workflow-implement approve
/skill:workflow-qa
/skill:workflow-commit
/skill:workflow-commit approve
/skill:workflow-status
/skill:workflow-refresh-context
```

All workflow state lives at `.pi/workflow/` and is added to `.git/info/exclude`, never to the repository `.gitignore`.

Each developer must install AI Workflow explicitly in each project where they want to use it: the package is never team-shared through the repository.

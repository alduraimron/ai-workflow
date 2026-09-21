# AI Workflow Roadmap

Candidate improvements, carried from the personal skill notes
(`~/.pi/agent/skills/_meta/ROADMAP.md`) and limited to `ai-workflow`, plus
package-level work. Status: `Todo` / `Doing` / `Done (date)` / `Dropped`.

## Workflow improvements

| # | Proposal | Why | Size | Status |
| --- | --- | --- | --- | --- |
| R1 | Add a "validate spec assumptions quickly" step to `workflow-implement`: verify paths, function/endpoint names, and verification commands exist before writing code. | Preflight currently covers Git and scope. A spec that points at the wrong path is only discovered mid-implementation. | S | Todo |
| R2 | Support extra verification commands beyond lint/typecheck (for example `react-doctor`, `eslint <file>`, migration tests) through `checks.extra` in the spec/config. | Real projects need more than two gates, and they differ per project. | S | Todo |
| R3 | Add a design-asset transcription step for UI work plus a `## Design references` field in `CURRENT-WORK-TEMPLATE.md`. | The planning session can read visual assets and transcribe facts (sizes, color tokens, copy, states) so the implementation session needs no vision model and less context. | S | Todo |
| R4 | Explicit personal vs team rules: a documented place for personal workflow preferences that does not edit `AGENTS.md` (for example `.pi/rules.md`, or an extension of `config.md` with priority and reading list per task type). | The suite is strict about not changing team files but has no official place for personal workflow preferences. | M | Todo |
| R5 | ADR integration: an "related ADR" field in the spec plus an ADR status update step in `workflow-implement`. | Projects using ADRs need planning decisions recorded and their status closed during implementation. | S | Todo |
| R6 | Sub-agent handoff: an `workflow-implement` mode that delegates spec execution to a sub-agent. | The spec is already self-contained (allowed paths, steps, acceptance, checks). Needs rules for when delegation is safe. | M | Todo |
| R7 | Standardized final report for `workflow-implement` (changes, numeric verification results, deviations, out-of-scope findings, commit suggestion). | Consistent, comparable results per work item. | S | Todo |
| R8 | Artifact language option: `config.md` already has `artifact_language: English`; add an `Indonesian` option. | Needed when a spec should be written in Indonesian. | S | Todo |

## Package / migration follow-ups

| # | Proposal | Why | Size | Status |
| --- | --- | --- | --- | --- |
| P1 | Review the standalone repository and create the first Git commit/tag. | Release state was deliberately out of scope for the migration task; completed by the `ai-workflow` rename and the `v0.1.0` release. | S | Done (2026-09-21) |
| P2 | Decide whether the package needs a LICENSE file before any public release. | The manifest intentionally omits a license field until that decision exists. | S | Todo |
| P3 | Add a Git-tag install path to the README (`pi install git:...@vX.Y.Z`) once a real remote and tag exist. | The README now documents the released `v0.1.0` Git-tag install path next to the local development install. | S | Done (2026-09-21) |
| P4 | Add an end-to-end fixture test that installs the package with `pi install -l --approve` into a temporary Git project and runs `check-loading.mjs --project`. | `npm test` covers script self-tests; loading is covered manually by `npm run check:loading`. An automated fixture makes regressions visible in CI. | M | Todo |
| P5 | Revisit the temporary global exclusion `"skills": ["!skills/feature-workflow/**"]` in `~/.pi/agent/settings.json` and remove the old global tree once no generated `current-work.md` artifact references the old absolute script path. | The old tree is kept only for backward compatibility during migration. | S | Todo |
| P6 | Keep `docs/DECISIONS.md` and `docs/ROADMAP.md` in sync with skill changes, and record skill-shape changes (still exactly 10 skills, no outer `SKILL.md`). | Without upkeep these notes drift, and the container-vs-skill decision is easy to break accidentally. | S | Todo |

## Explicitly out of scope

- Redesigning the workflow into a team-shared Pi package or shared
  `.pi/settings.json` model.
- Weakening scope checking, protected-branch logic, approved-path restrictions,
  or the commit gate for packaging convenience.
- Global installation as a supported first-class flow.

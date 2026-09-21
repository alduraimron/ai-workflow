# AI Workflow Decisions

Design history and rationale for `pi-ai-workflow`.

This document carries the `ai-workflow` parts of the personal skill notes that
previously lived in `~/.pi/agent/skills/_meta/` (`DECISIONS.md`), adapted to the
standalone package and corrected to the current shape: **10 skills**, not
"11 commands". It also records the decisions made when the suite became a
standalone, project-local Pi package.

## Product decisions

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Planning and implementation are two sessions. The planning skill writes a spec; `workflow-implement approve` executes it. | The artifact is the contract. The planning session never edits source, so the user reviews intent before any code changes. |
| D2 | `workflow-feature`, `workflow-bugfix`, and `workflow-refactor` are physically separate skills with one shared spec template. | Separate entry points give type-specific discovery, while the single `CURRENT-WORK-TEMPLATE.md` keeps the spec contract stable. |
| D3 | Every skill uses `disable-model-invocation: true`. | The workflow is explicit `/skill:*` only. It never auto-triggers from a model decision and it stays out of the system prompt. |
| D4 | One active work item at `.pi/workflow/current-work.md`, archived to `.pi/workflow/history/`. | A single reviewable contract beats dated plan folders. History keeps the audit trail without cluttering the active state. |
| D5 | Technical gates are scripts: `validate-work.mjs`, `check-workflow-scope.mjs`, `commit-approved-work.mjs`. | Rules must not depend on model compliance. The scripts re-check branch, scope, ignored content, staged paths, and work status. |
| D6 | One lifecycle per work item: `draft` -> `awaiting_spec_approval` -> `implementing` -> `qa_pending` -> `ready_for_commit` -> `awaiting_commit_approval` -> `idle`/`archived` (plus `qa_failed` and `blocked`). | A single status field makes "where am I" answerable by `workflow-status` without inference. |
| D7 | Manual QA is a separate user gate. The agent never claims QA passed. | Only the user can confirm behavior in their environment. |
| D8 | Commit is two-phase: `workflow-commit` shows the packet, `workflow-commit approve` commits. | Review happens before the irreversible Git mutation. The commit script re-runs every check. |
| D9 | Preflight before implementation and before commit: clean worktree outside `.pi/workflow/**`, non-protected branch, named branch, existing base commit. | Protects the user from implementing on a dirty or protected branch. |
| D10 | Small changes do not use the workflow; `workflow-implement` refuses work without an approved spec. | The workflow exists for changes that need a contract, not for trivia. |
| D11 | Path boundaries are strict: no dependency, manifest, lockfile, config, CI, documentation, instruction, or new path changes unless a new spec approves them. | The spec, not the moment, decides scope. The scope script enforces the approved paths. |
| D12 | Personal workflow rules do not live in the suite. Project rules come from `AGENTS.md` (team) and `.pi/workflow/config.md` (workflow). | Global or packaged skills must not encode one project's rules. |

### Why the gates beat prompt-only rules

The suite was compared against an earlier master/worker design in the personal
notes. The earlier design had useful ideas (explicit personal vs team rules,
design-asset transcription, ADRs, a standard worker report, quick assumption
validation) but no technical enforcement. `ai-workflow` kept enforcement in
scripts and treated those ideas as roadmap items instead.

## Migration decisions (standalone package, 2026-09)

| # | Decision | Rationale |
| --- | --- | --- |
| M1 | `ai-workflow` is a container, not a skill. `skills/ai-workflow/` contains exactly 10 `workflow-*` skill directories and no outer `SKILL.md`. | Pi stops recursive skill discovery when it finds a `SKILL.md`. Adding `skills/ai-workflow/SKILL.md` would collapse the package from 10 skills to 1. The container exists only to preserve the `../shared/...` and sibling-skill layout the skills depend on. |
| M2 | Installation is project-local only. The package is not recommended for global installation. | Workflow behavior belongs to the consuming project, and each developer opts in per project. |
| M3 | The package is stateless. Runtime state stays in the consumer project under `.pi/workflow/**`. | The package can be updated or reinstalled without touching any user's active work item or history. |
| M4 | Script paths inside `SKILL.md` are relative to the containing `SKILL.md` (`../scripts/...` in `workflow-implement` and `workflow-commit`). The command form stays `node <resolved-script-path> ...`. | Pi resolves relative skill-resource paths against the directory containing the `SKILL.md`. No absolute installation path and no executable-bit dependency remain. |
| M5 | Shared templates are location-independent. `CURRENT-WORK-TEMPLATE.md` describes the scope check semantically and never embeds a package path. | Templates are copied into `<consumer-project>/.pi/workflow/current-work.md`, where a `../scripts/...` path is wrong and an absolute install path is worse. The concrete command stays in the relevant `SKILL.md`. |
| M6 | Package maintenance is out of band. Do not install, remove, or update project-local Pi packages between implementation preflight/spec approval and the final workflow commit. | The scope checker fingerprints ignored project content. Project-local packages live under `.pi/git/` and `.pi/npm/`, so changing them can invalidate the ignored-content digest. The safety invariant is kept; only the operating rule is documented. |
| M7 | The retired global `feature-workflow` tree is temporarily excluded from auto-discovery instead of deleted: `"skills": ["!skills/feature-workflow/**"]` in `~/.pi/agent/settings.json`. | Previously generated `current-work.md` files may reference the old absolute script path. The physical directory keeps those artifacts runnable while the migration is verified. The exclusion suppresses global loading only; the project-local package still loads. The exclusion keeps the real directory name because the physical tree was not renamed. |
| M8 | No npm dependencies. The package and its tools use Node built-ins only. | The suite is scripts and Markdown. `tools/check-loading.mjs` resolves the already-installed Pi runtime at runtime instead of declaring a dependency. |
| M9 | The standalone package is named `pi-ai-workflow` with its container at `skills/ai-workflow/`. Version `0.1.0` is the first tagged release (`git@github.com:alduraimron/ai-workflow.git`), and the 10 `/skill:workflow-*` command names are unchanged. | The product name is package-level; the command names are the stable public API. Pi still recurses through the container, and the retired global compatibility tree keeps its real `feature-workflow` name and exclusion. |

### Rejected alternatives

- **Umbrella `ai-workflow` container skill** - collapses discovery to one skill (see M1).
- **Renaming the `/skill:workflow-*` commands** - the 10 command names are the public command API; the rename is package-level only.
- **Moving runtime state into the package** - breaks multi-project use and makes package updates destructive.
- **Team-shared `.pi/settings.json`** - `.pi/` intentionally stays out of repository commits; each developer runs the project-local install themselves.
- **Weakening `check-workflow-scope.mjs` for `.pi/git` or `.pi/npm`** - creates exceptions inside a safety gate. Documenting the operational rule (M6) preserves the invariant.
- **Global installation as the primary path** - loses project isolation and forces every project to inherit the workflow.

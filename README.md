# pi-ai-workflow

A project-local, gated workflow for Pi: spec first, then implementation, manual
QA, and a reviewed commit.

`ai-workflow` bundles **10 explicit skills** that expose
`/skill:workflow-*` commands. It is a container package, not a single skill:

```text
workflow-setup
workflow-discovery
workflow-feature
workflow-bugfix
workflow-refactor
workflow-implement
workflow-qa
workflow-commit
workflow-status
workflow-refresh-context
```

> `skills/ai-workflow/` intentionally has **no** `SKILL.md` of its own. Pi
> stops recursive skill discovery at an outer `SKILL.md`, so adding one would
> collapse the package to a single skill. Keep the container as a container.

## What it does

The core loop:

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

Lifecycle:

```text
workflow-feature | workflow-bugfix | workflow-refactor   (write the spec, never edits source)
        -> workflow-implement approve                    (implement the approved spec)
        -> workflow-qa                                   (user-run manual QA)
        -> workflow-commit                               (show the review packet)
        -> workflow-commit approve                       (one scoped commit)
```

Supporting commands: `workflow-setup` (solo or team), `workflow-discovery`
(solo product planning and bootstrap), `workflow-status` (read-only state
summary), `workflow-refresh-context` (refresh the private team project
overview).

## Profiles

- **solo**: product planning, build plan, and approved scaffold support.
- **team**: one private repository overview plus scoped personal feature work.
  Shared files and instructions stay untouched.

## Approval boundaries

- Planning skills (`workflow-feature`, `workflow-bugfix`, `workflow-refactor`)
  never edit source. They stop at an English spec in
  `.pi/workflow/current-work.md` and `status: awaiting_spec_approval`.
- `workflow-implement approve` is required before any source edit. Without
  `approve` it only inspects and reports.
- `workflow-qa` records user-reported manual QA. The agent never claims QA
  passed without user evidence.
- `workflow-commit` shows the packet; only `workflow-commit approve` creates a
  commit. The commit script re-checks branch, HEAD, ignored content, scope, and
  staged paths.
- Git history is never rewritten: no push, merge, rebase, reset, stash,
  checkout, or branch-changing commands.

All skills set `disable-model-invocation: true`. They are explicit
`/skill:*` commands only and are intentionally absent from the system prompt.

## Installation

Installation is **project-local only**. Do not install this package globally;
a global install would leak the workflow into every project and lose project
isolation.

Each developer must install AI Workflow explicitly in each project where they
want to use it. The package is never shared through the repository:

```bash
cd /path/to/your/project
pi install -l --approve /absolute/path/to/ai-workflow
```

- `-l` writes to the project settings file (`<project>/.pi/settings.json`).
- `--approve` trusts project-local files for the command.
- Local path packages are referenced in place; Pi does not copy the source.
- Project resources require project trust. Interactive Pi asks once and stores
  the decision in `~/.pi/agent/trust.json`; automation passes `--approve`.

Local development checkout:

```bash
pi install -l --approve ~/code/pi/ai-workflow
```

Git-tag install (released):

```bash
pi install -l --approve \
  git:git@github.com:alduraimron/ai-workflow@v0.1.0
```

- A Git-tag install is cloned to `<project>/.pi/git/<host>/<path>`, here
  `<project>/.pi/git/github.com/alduraimron/ai-workflow`.
- `v0.1.0` is the first release; later tags are installed the same way.
- Update package metadata only while the workflow is idle (see below).

### Installation vs workflow state

These are two different things and live in two different places:

| Concern | Location | Notes |
| --- | --- | --- |
| Package installation | `<project>/.pi/settings.json` (and `<project>/.pi/git/` or `.pi/npm/` for non-path installs) | Per developer, per machine. Not committed to the repository. |
| Workflow runtime state | `<project>/.pi/workflow/**` | Specs, config, project overview, history. All intentional project-relative paths. |
| Global settings | `~/.pi/agent/settings.json` | Not modified by a project-local install. |

The package itself is stateless. Moving, updating, or reinstalling it never
moves workflow state.

### Keep `.pi/` out of repository commits

`.pi/` is local-only by design. `workflow-setup` adds workflow state to
`.git/info/exclude`, never to the repository `.gitignore`, and it does not
commit `.pi/settings.json`. Keep that behavior: do not turn project-local Pi
settings into a team-shared file in this package or its docs.

## Operational constraint: package updates during an active workflow

The scope checker fingerprints ignored project content. Project-local Pi
packages live under `.pi/git/` and `.pi/npm/`, so installing, removing, or
updating a project-local package during an active work item can invalidate the
ignored-content digest.

> Do not install, remove, or update project-local Pi packages between workflow
> implementation preflight/spec approval and the final workflow commit.
> Run package maintenance while the workflow is idle.

This keeps the current safety invariant. The scope checker is intentionally not
weakened with package-directory exceptions.

## Repository layout

```text
pi-ai-workflow/
├── package.json
├── README.md
├── .gitignore
├── docs/
│   ├── DECISIONS.md
│   └── ROADMAP.md
├── tools/
│   ├── self-test.mjs
│   └── check-loading.mjs
└── skills/
    └── ai-workflow/               # container only: no SKILL.md here
        ├── README.md
        ├── scripts/
        │   ├── workflow-state.mjs
        │   ├── validate-work.mjs
        │   ├── check-workflow-scope.mjs
        │   └── commit-approved-work.mjs
        ├── shared/                # spec and config templates
        └── workflow-*/SKILL.md    # the 10 skills
```

## Development checks

No dependencies are required; Node built-ins only.

```bash
npm test               # runs the supported script self-tests
npm run check:loading  # verifies real Pi loading of the 10 skills
```

`npm run check:loading` uses Pi's real `DefaultResourceLoader` from the
installed runtime and checks:

- exactly the 10 expected skills load, by exact name;
- no missing, unexpected, or duplicate workflow skill names;
- no workflow collision diagnostics;
- no umbrella `ai-workflow` container skill (and not the retired
  `feature-workflow` container name);
- all skills resolve from this package (not a copy) and none from the old
  retired global `~/.pi/agent/skills/feature-workflow` compatibility tree;
- all skills still have `disable-model-invocation: true`.

Useful variants:

```bash
node tools/check-loading.mjs --project /path/to/installed/project
node tools/check-loading.mjs --project /path/to/project --expect-none
node tools/check-loading.mjs --isolated
node tools/check-loading.mjs --project /path/to/project --verbose
```

## License

No license file has been chosen yet. The manifest intentionally omits a license
field until that decision exists.

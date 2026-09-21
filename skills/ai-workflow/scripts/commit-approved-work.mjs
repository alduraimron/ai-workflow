#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  isValidWorkId,
  isWorkflowPath,
  nowIso,
  nulPaths,
  readWorkflowFile,
  runGit,
  statusPaths,
  valueAsMap,
} from "./workflow-state.mjs";
import { runScope } from "./check-workflow-scope.mjs";

function hasConfirmation(body, label, expected) {
  const expression = new RegExp(`^${label}:\\s*[\\x60]?${expected}[\\x60]?\\s*$`, "im");
  return expression.test(body);
}

function commitMessage(meta) {
  const commit = valueAsMap(meta.commit);
  const message = typeof commit.message === "string" ? commit.message.trim() : "";
  if (!message) return { error: "Commit message is missing." };
  if (message.includes("\0") || message.includes("\n")) return { error: "Commit message must be one line." };
  if (message.length > 72) return { error: "Commit message must be at most 72 characters." };
  return { message };
}

function archiveDirectory(type) {
  if (type === "feature") return "features";
  if (type === "bugfix") return "bugfixes";
  if (type === "refactor") return "refactors";
  return "bootstrap";
}

function markSoloBuildPlanItem(work) {
  if (work.meta.profile !== "solo") return { updated: false, reason: "not a solo work item" };

  const item = typeof work.meta.build_plan_item === "string" ? work.meta.build_plan_item.trim() : "";
  if (!item || item === "pending") return { updated: false, reason: "no build plan item recorded" };
  if (!/^\d+[a-z]?$/i.test(item)) return { updated: false, reason: `invalid build plan item: ${item}` };

  const planPath = path.join(path.resolve(work.meta.project_root), ".pi", "workflow", "build-plan.md");
  if (!fs.existsSync(planPath)) return { updated: false, reason: "build-plan.md not found" };

  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^(\\s*-\\s*\\[) \\](\\s+${escaped}\\.)`, "m");
  const current = fs.readFileSync(planPath, "utf8");
  if (!pattern.test(current)) return { updated: false, reason: `unchecked build plan item ${item} not found` };

  fs.writeFileSync(planPath, current.replace(pattern, "$1x]$2"), "utf8");
  return { updated: true, item };
}

function archiveWork(workPath, work, sha) {
  const root = path.resolve(work.meta.project_root);
  const timestamp = nowIso().replace(/[:.]/g, "-");
  const destinationDirectory = path.join(root, ".pi", "workflow", "history", archiveDirectory(work.meta.type));
  const destination = path.join(destinationDirectory, `${timestamp}-${work.meta.id}.md`);
  fs.mkdirSync(destinationDirectory, { recursive: true });

  const archivedMarkdown = `${work.markdown.replace(/^status:\s*.*$/m, "status: archived").trim()}\n\n## Completion\n\n- Commit: \`${sha}\`\n- Archived at: ${nowIso()}\n`;
  fs.writeFileSync(destination, archivedMarkdown, "utf8");
  fs.writeFileSync(
    workPath,
    `---\nstatus: idle\nupdated_at: ${nowIso()}\n---\n\n# Current Work\n\nNo active work.\n`,
    "utf8",
  );
  return destination;
}

function stagedPaths(projectRoot) {
  const staged = runGit(projectRoot, ["diff", "--cached", "--name-only", "-z"]);
  if (!staged.ok) return { ok: false, error: staged.stderr.trim() || "Could not inspect staged paths.", paths: [] };
  return { ok: true, paths: nulPaths(staged.stdout) };
}

function changedNonWorkflowPaths(projectRoot) {
  const status = runGit(projectRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (!status.ok) return { ok: false, error: status.stderr.trim() || "Could not inspect Git status.", paths: [] };
  return { ok: true, paths: statusPaths(status.stdout).filter((filePath) => !isWorkflowPath(filePath)) };
}

export function commitApprovedWork(workPath) {
  const work = readWorkflowFile(workPath);
  if (work.errors.length) return { ok: false, error: work.errors.join("; ") };
  if (work.meta.status !== "awaiting_commit_approval") {
    return { ok: false, error: `Expected status awaiting_commit_approval, got ${work.meta.status ?? "missing"}.` };
  }
  if (!isValidWorkId(work.meta.id)) return { ok: false, error: "Invalid work id." };
  if (!hasConfirmation(work.body, "Commit approval", "confirmed")) {
    return { ok: false, error: "Commit approval: confirmed is required before committing." };
  }

  const messageResult = commitMessage(work.meta);
  if (messageResult.error) return { ok: false, error: messageResult.error };

  const scope = runScope(workPath);
  if (!scope.ok) return { ok: false, error: `Scope check failed: ${scope.errors.join("; ")}`, scope };
  if (!scope.allowedSourcePaths.length) return { ok: false, error: "No approved source changes are available to commit.", scope };

  const projectRoot = path.resolve(work.meta.project_root);
  const add = runGit(projectRoot, ["add", "--", ...scope.allowedSourcePaths]);
  if (!add.ok) return { ok: false, error: `git add failed: ${add.stderr.trim() || add.stdout.trim()}`, scope };

  const staged = stagedPaths(projectRoot);
  if (!staged.ok) return { ok: false, error: staged.error, scope };
  const expected = new Set(scope.allowedSourcePaths);
  const unexpectedStaged = staged.paths.filter((filePath) => !expected.has(filePath));
  const missingStaged = scope.allowedSourcePaths.filter((filePath) => !staged.paths.includes(filePath));
  if (unexpectedStaged.length || missingStaged.length) {
    return {
      ok: false,
      error: "The staged set does not exactly match approved source changes.",
      unexpectedStaged,
      missingStaged,
      scope,
    };
  }

  const commit = spawnSync("git", ["-C", projectRoot, "commit", "-m", messageResult.message], {
    encoding: "utf8",
    env: { ...process.env, GIT_EDITOR: "true" },
  });
  if (commit.status !== 0) {
    return { ok: false, error: `git commit failed: ${(commit.stderr || commit.stdout || "").trim()}`, scope };
  }

  const head = runGit(projectRoot, ["rev-parse", "HEAD"]);
  if (!head.ok) {
    return { ok: false, error: "Commit succeeded but the new HEAD could not be resolved.", scope };
  }

  const buildPlan = markSoloBuildPlanItem(work);

  let archivePath;
  try {
    archivePath = archiveWork(workPath, work, head.stdout.trim());
  } catch (error) {
    return {
      ok: false,
      error: `Commit succeeded (${head.stdout.trim()}) but workflow archive failed: ${error instanceof Error ? error.message : String(error)}`,
      scope,
    };
  }

  const remaining = changedNonWorkflowPaths(projectRoot);
  return {
    ok: true,
    commit: head.stdout.trim(),
    message: messageResult.message,
    committedPaths: scope.allowedSourcePaths,
    archivePath,
    buildPlan,
    remainingPaths: remaining.ok ? remaining.paths : [],
    remainingStatusError: remaining.ok ? undefined : remaining.error,
  };
}

function run(command, argumentsList, cwd) {
  const result = spawnSync(command, argumentsList, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${argumentsList.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function fixture(root, branch, commit) {
  return `---
id: commit-fixture
title: Commit fixture
profile: solo
type: feature
status: awaiting_commit_approval
build_plan_item: 1
project_root: ${root}
base:
  branch: ${branch}
  commit: ${commit}
  ignored_digest: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
allowed_paths:
  - .pi/workflow/**
  - src/feature.js
forbidden_paths:
  - AGENTS.md
  - CLAUDE.md
  - .gitignore
checks:
  lint: node --check src/feature.js
  typecheck: node --check src/feature.js
commit:
  message: feat: add commit fixture
---

# Current Work: Commit fixture

## Objective

Add a committed fixture.

## User preferences

- Keep it small.

## Scope

- Add one source file.

## Out of scope

- No shared files change.

## Discovery findings

- \`src/index.js\` is present.

## Open questions

None

## Confirmed decisions

- The user approved the scope.

## Allowed changes

- \`src/feature.js\`

## Implementation steps

1. Add the fixture module.

## Acceptance criteria

- The module can be parsed by Node.

## Verification

- Run node --check.

## Manual QA

- User confirmed the manual path.

## Commit proposal

- \`feat: add commit fixture\`

## Approval record

Spec approval: confirmed
Manual QA: passed
Commit review: shown
Commit approval: confirmed
`;
}

function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-commit-"));
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "index.js"), "export const fixture = true;\n");
    run("git", ["init", "-q"], root);
    run("git", ["config", "user.email", "workflow@example.test"], root);
    run("git", ["config", "user.name", "Workflow Test"], root);
    run("git", ["add", "."], root);
    run("git", ["commit", "-qm", "fixture"], root);
    run("git", ["checkout", "-qb", "feature/commit-fixture"], root);

    const branch = run("git", ["branch", "--show-current"], root);
    const head = run("git", ["rev-parse", "HEAD"], root);
    const workPath = path.join(root, ".pi", "workflow", "current-work.md");
    fs.mkdirSync(path.dirname(workPath), { recursive: true });
    fs.writeFileSync(workPath, fixture(root, branch, head));
    fs.writeFileSync(path.join(root, ".pi", "workflow", "build-plan.md"), "# Build Plan\n\n- [ ] 1. Commit fixture\n");
    fs.writeFileSync(path.join(root, "src", "feature.js"), "export const committed = true;\n");

    const result = commitApprovedWork(workPath);
    if (!result.ok) throw new Error(result.error);
    if (!fs.existsSync(result.archivePath)) throw new Error("Expected archive to exist.");
    if (!fs.readFileSync(workPath, "utf8").includes("status: idle")) throw new Error("Expected idle current-work state.");
    if (!fs.readFileSync(path.join(root, ".pi", "workflow", "build-plan.md"), "utf8").includes("- [x] 1. Commit fixture")) {
      throw new Error("Expected matching solo build plan item to be checked.");
    }

    console.log("commit-approved-work self-test passed.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const [workPath, approval] = process.argv.slice(2);
  if (workPath === "--self-test") {
    runSelfTest();
    return;
  }
  if (!workPath || approval !== "--approve") {
    console.log("Usage: node commit-approved-work.mjs <current-work.md> --approve | --self-test");
    process.exitCode = workPath ? 1 : 0;
    return;
  }

  const result = commitApprovedWork(workPath);
  if (result.ok) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

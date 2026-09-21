#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  globMatches,
  isWorkflowPath,
  normalizePath,
  nulPaths,
  readWorkflowFile,
  runGit,
  statusPaths,
  valueAsList,
  valueAsMap,
} from "./workflow-state.mjs";
import { validateWorkText } from "./validate-work.mjs";

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function projectRootFrom(meta) {
  return typeof meta.project_root === "string" ? path.resolve(meta.project_root) : process.cwd();
}

function protectedBranches(meta) {
  const values = valueAsList(meta.protected_branches);
  return values.length ? values : ["main"];
}

function ignoredDigest(projectRoot) {
  const ignored = runGit(projectRoot, ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"]);
  if (!ignored.ok) {
    return { ok: false, error: ignored.stderr.trim() || "Could not inspect ignored paths.", paths: [], digest: "" };
  }

  const paths = nulPaths(ignored.stdout).filter((filePath) => !isWorkflowPath(filePath)).sort();
  return {
    ok: true,
    paths,
    digest: createHash("sha256").update(paths.join("\0")).digest("hex"),
  };
}

function baseResult(workPath) {
  const work = readWorkflowFile(workPath);
  const validation = validateWorkText(work.markdown);
  const errors = [...work.errors, ...validation.errors];
  return {
    work,
    meta: validation.meta,
    errors,
    projectRoot: projectRootFrom(validation.meta),
  };
}

function ensureRepository(projectRoot, errors) {
  const result = runGit(projectRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (!result.ok || result.stdout.trim() !== "true") {
    errors.push("Workflow scope checks require a Git worktree.");
    return false;
  }
  return true;
}

function currentBranchAndCommit(projectRoot, errors) {
  const branch = runGit(projectRoot, ["branch", "--show-current"]);
  const commit = runGit(projectRoot, ["rev-parse", "HEAD"]);
  if (!branch.ok || !branch.stdout.trim()) errors.push("A named Git branch is required.");
  if (!commit.ok || !commit.stdout.trim()) errors.push("A Git HEAD commit is required.");
  return { branch: branch.stdout.trim(), commit: commit.stdout.trim() };
}

function changedNonWorkflowPaths(projectRoot, errors) {
  const status = runGit(projectRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (!status.ok) {
    errors.push(`Could not inspect Git status: ${status.stderr.trim()}`);
    return [];
  }
  return statusPaths(status.stdout).filter((filePath) => !isWorkflowPath(filePath));
}

function classifyPath(filePath, meta) {
  const normalized = normalizePath(filePath);
  const forbidden = valueAsList(meta.forbidden_paths).some((pattern) => globMatches(pattern, normalized));
  const allowed = valueAsList(meta.allowed_paths).some((pattern) => globMatches(pattern, normalized));
  return allowed && !forbidden;
}

export function runPreflight(workPath) {
  const context = baseResult(workPath);
  const result = {
    ok: false,
    errors: [...context.errors],
    branch: "",
    commit: "",
    ignoredDigest: "",
    ignoredCount: 0,
    dirtyPaths: [],
  };
  if (result.errors.length) return result;
  if (!ensureRepository(context.projectRoot, result.errors)) return result;

  const current = currentBranchAndCommit(context.projectRoot, result.errors);
  result.branch = current.branch;
  result.commit = current.commit;
  if (protectedBranches(context.meta).includes(current.branch)) {
    result.errors.push(`Protected branch is not allowed: ${current.branch}.`);
  }

  result.dirtyPaths = changedNonWorkflowPaths(context.projectRoot, result.errors);
  if (result.dirtyPaths.length) {
    result.errors.push(`Working tree is not clean outside .pi/workflow: ${result.dirtyPaths.join(", ")}.`);
  }

  const ignored = ignoredDigest(context.projectRoot);
  if (!ignored.ok) result.errors.push(ignored.error);
  result.ignoredDigest = ignored.digest;
  result.ignoredCount = ignored.paths.length;
  result.ok = result.errors.length === 0;
  return result;
}

export function runScope(workPath) {
  const context = baseResult(workPath);
  const result = {
    ok: false,
    errors: [...context.errors],
    branch: "",
    commit: "",
    allowedPaths: [],
    allowedSourcePaths: [],
    violations: [],
    ignoredChanged: false,
  };
  if (result.errors.length) return result;
  if (!ensureRepository(context.projectRoot, result.errors)) return result;

  const current = currentBranchAndCommit(context.projectRoot, result.errors);
  result.branch = current.branch;
  result.commit = current.commit;
  const base = valueAsMap(context.meta.base);

  if (protectedBranches(context.meta).includes(current.branch)) {
    result.errors.push(`Protected branch is not allowed: ${current.branch}.`);
  }
  if (typeof base.branch !== "string" || current.branch !== base.branch) {
    result.errors.push(`Branch changed since approval (base ${base.branch ?? "missing"}, current ${current.branch || "missing"}).`);
  }
  if (typeof base.commit !== "string" || current.commit !== base.commit) {
    result.errors.push(`HEAD changed since approval (base ${base.commit ?? "missing"}, current ${current.commit || "missing"}).`);
  }

  const changed = changedNonWorkflowPaths(context.projectRoot, result.errors);
  for (const filePath of changed) {
    if (classifyPath(filePath, context.meta)) {
      result.allowedPaths.push(filePath);
      result.allowedSourcePaths.push(filePath);
    } else {
      result.violations.push(filePath);
    }
  }

  const ignored = ignoredDigest(context.projectRoot);
  const expectedIgnoredDigest = typeof base.ignored_digest === "string" ? base.ignored_digest : "";
  if (!ignored.ok) {
    result.errors.push(ignored.error);
  } else if (expectedIgnoredDigest && ignored.digest !== expectedIgnoredDigest) {
    result.ignoredChanged = true;
    result.errors.push("Ignored paths changed since approval outside .pi/workflow.");
  }

  result.allowedPaths = unique(result.allowedPaths);
  result.allowedSourcePaths = unique(result.allowedSourcePaths);
  result.violations = unique(result.violations);
  if (result.violations.length) {
    result.errors.push(`Out-of-scope changed paths: ${result.violations.join(", ")}.`);
  }
  result.ok = result.errors.length === 0;
  return result;
}

function printResult(result) {
  if (result.ok) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}

function run(command, argumentsList, cwd) {
  const result = spawnSync(command, argumentsList, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${argumentsList.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function fixture(root, branch, commit, ignoredHash) {
  return `---
id: scope-fixture
title: Scope fixture
profile: team
type: feature
status: implementing
project_root: ${root}
base:
  branch: ${branch}
  commit: ${commit}
  ignored_digest: ${ignoredHash}
allowed_paths:
  - .pi/workflow/**
  - src/feature.js
forbidden_paths:
  - AGENTS.md
  - CLAUDE.md
  - .gitignore
checks:
  lint: npm run lint
  typecheck: npm run typecheck
commit:
  message: feat: add fixture
---

# Current Work: Scope fixture

## Objective

Add a scoped fixture.

## User preferences

- Keep it minimal.

## Scope

- Add one source file.

## Out of scope

- No configuration changes.

## Discovery findings

- \`src/index.js\` exists.

## Open questions

None

## Confirmed decisions

- The user approved the scope.

## Allowed changes

- \`src/feature.js\`

## Implementation steps

1. Add the source file.

## Acceptance criteria

- The source file exists.

## Verification

- Inspect the file and run configured checks later.

## Manual QA

- Not run yet.

## Commit proposal

- \`feat: add fixture\`

## Approval record

Spec approval: confirmed
Manual QA: pending
Commit review: pending
`;
}

function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-scope-"));
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "index.js"), "export const fixture = true;\n");
    fs.writeFileSync(path.join(root, ".gitignore"), "dist/\n");
    run("git", ["init", "-q"], root);
    run("git", ["config", "user.email", "workflow@example.test"], root);
    run("git", ["config", "user.name", "Workflow Test"], root);
    run("git", ["add", "."], root);
    run("git", ["commit", "-qm", "fixture"], root);
    run("git", ["checkout", "-qb", "feature/scope-fixture"], root);

    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    fs.writeFileSync(path.join(root, "dist", "existing.js"), "existing\n");
    const head = run("git", ["rev-parse", "HEAD"], root);
    const branch = run("git", ["branch", "--show-current"], root);
    const initialIgnored = ignoredDigest(root);
    if (!initialIgnored.ok) throw new Error(initialIgnored.error);

    const workPath = path.join(root, ".pi", "workflow", "current-work.md");
    fs.mkdirSync(path.dirname(workPath), { recursive: true });
    fs.writeFileSync(workPath, fixture(root, branch, head, initialIgnored.digest));

    const preflight = runPreflight(workPath);
    if (!preflight.ok) throw new Error(`Expected clean preflight: ${preflight.errors.join("; ")}`);

    fs.writeFileSync(path.join(root, "src", "feature.js"), "export const implemented = true;\n");
    const allowed = runScope(workPath);
    if (!allowed.ok || !allowed.allowedSourcePaths.includes("src/feature.js")) {
      throw new Error(`Expected allowed scope: ${allowed.errors.join("; ")}`);
    }

    fs.writeFileSync(path.join(root, "README.md"), "unexpected\n");
    const forbidden = runScope(workPath);
    if (forbidden.ok || !forbidden.violations.includes("README.md")) {
      throw new Error("Expected README.md to fail scope.");
    }
    fs.rmSync(path.join(root, "README.md"));

    fs.writeFileSync(path.join(root, "dist", "new.js"), "new\n");
    const changedIgnored = runScope(workPath);
    if (changedIgnored.ok || !changedIgnored.ignoredChanged) {
      throw new Error("Expected new ignored path to fail scope.");
    }

    console.log("check-workflow-scope self-test passed.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const [mode, workPath] = process.argv.slice(2);
  if (mode === "--self-test") {
    runSelfTest();
    return;
  }
  if (!mode || !workPath || !["preflight", "scope"].includes(mode)) {
    console.log("Usage: node check-workflow-scope.mjs <preflight|scope> <current-work.md> | --self-test");
    process.exitCode = mode ? 1 : 0;
    return;
  }

  const result = mode === "preflight" ? runPreflight(workPath) : runScope(workPath);
  printResult(result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  VALID_PROFILES,
  VALID_STATUSES,
  VALID_TYPES,
  containsNoneOnly,
  isValidWorkId,
  parseFrontmatter,
  sectionContent,
  validateProjectRelativePath,
  valueAsList,
  valueAsMap,
} from "./workflow-state.mjs";

const REQUIRED_SECTIONS = [
  "Objective",
  "User preferences",
  "Scope",
  "Out of scope",
  "Discovery findings",
  "Open questions",
  "Confirmed decisions",
  "Allowed changes",
  "Implementation steps",
  "Acceptance criteria",
  "Verification",
  "Manual QA",
  "Commit proposal",
  "Approval record",
];

const ALWAYS_FORBIDDEN = new Set(["AGENTS.md", "CLAUDE.md", ".gitignore"]);
const READY_STATUSES = new Set([
  "awaiting_spec_approval",
  "implementing",
  "qa_pending",
  "qa_failed",
  "ready_for_commit",
  "awaiting_commit_approval",
]);
const IMPLEMENTATION_STATUSES = new Set([
  "implementing",
  "qa_pending",
  "qa_failed",
  "ready_for_commit",
  "awaiting_commit_approval",
]);

function meaningful(value) {
  return typeof value === "string" && value.trim() !== "" && !/^<(?:.+)>$/i.test(value.trim());
}

function hasConfirmation(body, label, expected) {
  const expression = new RegExp(`^${label}:\\s*[\\x60]?${expected}[\\x60]?\\s*$`, "im");
  return expression.test(body);
}

function validatePaths(meta, errors) {
  const type = meta.type;
  if (type === "bootstrap") return;

  const allowed = valueAsList(meta.allowed_paths);
  const forbidden = valueAsList(meta.forbidden_paths);

  if (!allowed.includes(".pi/workflow/**")) {
    errors.push("allowed_paths must include .pi/workflow/**.");
  }
  if (!allowed.some((entry) => entry !== ".pi/workflow/**")) {
    errors.push("allowed_paths must include at least one narrow implementation path.");
  }

  for (const entry of allowed) {
    const error = validateProjectRelativePath(entry, { allowGlob: true, role: "Allowed path" });
    if (error) errors.push(error);
    if (ALWAYS_FORBIDDEN.has(entry)) errors.push(`Allowed path is permanently forbidden: ${entry}.`);
  }

  for (const entry of forbidden) {
    const error = validateProjectRelativePath(entry, { allowGlob: true, role: "Forbidden path" });
    if (error) errors.push(error);
  }

  for (const required of ALWAYS_FORBIDDEN) {
    if (!forbidden.includes(required)) errors.push(`forbidden_paths must include ${required}.`);
  }
}

function validateLifecycle(meta, body, errors) {
  const status = meta.status;
  const type = meta.type;
  if (status === "idle" || status === "archived") return;

  for (const title of REQUIRED_SECTIONS) {
    if (sectionContent(body, title) === null) errors.push(`Missing required section: ## ${title}.`);
  }

  if (READY_STATUSES.has(status)) {
    const openQuestions = sectionContent(body, "Open questions") ?? "";
    if (!containsNoneOnly(openQuestions)) {
      errors.push("A work item awaiting approval or later must have no open questions.");
    }
  }

  if (IMPLEMENTATION_STATUSES.has(status) && type !== "bootstrap") {
    const base = valueAsMap(meta.base);
    if (!meaningful(base.branch) || !meaningful(base.commit)) {
      errors.push("Implementation state requires base.branch and base.commit.");
    }
    if (!hasConfirmation(body, "Spec approval", "confirmed")) {
      errors.push("Implementation state requires Spec approval: confirmed.");
    }
  }

  if (["qa_pending", "qa_failed", "ready_for_commit", "awaiting_commit_approval"].includes(status)) {
    const checks = valueAsMap(meta.checks);
    if (!meaningful(checks.lint) || checks.lint === "pending") errors.push("Lint command must be configured before QA.");
    if (!meaningful(checks.typecheck) || checks.typecheck === "pending") errors.push("Typecheck command must be configured before QA.");
  }

  if (["ready_for_commit", "awaiting_commit_approval"].includes(status)) {
    if (!hasConfirmation(body, "Manual QA", "passed")) {
      errors.push("Ready-to-commit state requires Manual QA: passed.");
    }
  }

  if (status === "awaiting_commit_approval") {
    const commit = valueAsMap(meta.commit);
    if (!meaningful(commit.message)) errors.push("Commit message must be recorded before commit approval.");
    if (!hasConfirmation(body, "Commit review", "shown")) {
      errors.push("Commit approval state requires Commit review: shown.");
    }
  }
}

export function validateWorkText(markdown) {
  const { meta, body, errors: parseErrors } = parseFrontmatter(markdown);
  const errors = [...parseErrors];

  for (const key of ["id", "title", "profile", "type", "status", "project_root"]) {
    if (!meaningful(meta[key])) errors.push(`Missing required frontmatter field: ${key}.`);
  }

  if (meaningful(meta.id) && !isValidWorkId(meta.id)) errors.push("id must be lowercase kebab-case.");
  if (meaningful(meta.profile) && !VALID_PROFILES.has(meta.profile)) errors.push(`Unsupported profile: ${meta.profile}.`);
  if (meaningful(meta.type) && !VALID_TYPES.has(meta.type)) errors.push(`Unsupported type: ${meta.type}.`);
  if (meaningful(meta.status) && !VALID_STATUSES.has(meta.status)) errors.push(`Unsupported status: ${meta.status}.`);
  if (meaningful(meta.project_root) && !path.isAbsolute(meta.project_root)) errors.push("project_root must be absolute.");

  validatePaths(meta, errors);
  validateLifecycle(meta, body, errors);

  return { ok: errors.length === 0, errors, meta, body };
}

function fixture(root, overrides = {}) {
  const status = overrides.status ?? "awaiting_commit_approval";
  return `---
id: sample-work
title: Sample work
profile: team
type: feature
status: ${status}
project_root: ${root}
base:
  branch: feature/sample
  commit: abc123
allowed_paths:
  - .pi/workflow/**
  - src/sample.js
forbidden_paths:
  - AGENTS.md
  - CLAUDE.md
  - .gitignore
checks:
  lint: npm run lint
  typecheck: npm run typecheck
commit:
  message: feat: add sample work
---

# Current Work: Sample work

## Objective

Implement the approved sample behavior.

## User preferences

- Keep the behavior minimal.

## Scope

- Add the sample module.

## Out of scope

- No project configuration changes.

## Discovery findings

- \`src/index.js\` is the relevant entry point.

## Open questions

None

## Confirmed decisions

- The user approved the selected behavior.

## Allowed changes

- \`src/sample.js\`

## Implementation steps

1. Add the sample module.

## Acceptance criteria

- The module exposes the approved behavior.

## Verification

- Run lint and typecheck before QA.

## Manual QA

- Open the relevant flow and confirm the expected result.

## Commit proposal

- \`feat: add sample work\`

## Approval record

Spec approval: confirmed
Manual QA: passed
Commit review: shown
`;
}

function runSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-validate-"));
  try {
    const valid = validateWorkText(fixture(root));
    if (!valid.ok) throw new Error(`Expected valid fixture: ${valid.errors.join("; ")}`);

    const invalidPath = validateWorkText(fixture(root).replace("  - src/sample.js", "  - **"));
    if (invalidPath.ok || !invalidPath.errors.some((error) => error.includes("root-wide"))) {
      throw new Error("Expected root-wide allowed path to fail.");
    }

    const missingQa = validateWorkText(fixture(root).replace("Manual QA: passed", "Manual QA: pending"));
    if (missingQa.ok || !missingQa.errors.some((error) => error.includes("Manual QA"))) {
      throw new Error("Expected pending QA to fail commit-ready validation.");
    }

    console.log("validate-work self-test passed.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function main() {
  const [argument] = process.argv.slice(2);
  if (argument === "--self-test") {
    runSelfTest();
    return;
  }
  if (!argument || argument === "--help" || argument === "-h") {
    console.log("Usage: node validate-work.mjs <current-work.md> | --self-test");
    process.exitCode = argument ? 0 : 1;
    return;
  }

  if (!fs.existsSync(argument)) {
    console.error(`Work file not found: ${argument}`);
    process.exitCode = 1;
    return;
  }

  const result = validateWorkText(fs.readFileSync(argument, "utf8"));
  if (result.ok) {
    console.log(`Workflow work validation passed: ${argument}`);
    return;
  }

  console.error(`Workflow work validation failed: ${argument}`);
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

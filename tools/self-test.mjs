#!/usr/bin/env node
// Runs every supported workflow script self-test.
//
// The workflow scripts are the real technical gates; this runner keeps a single
// stable entry point (`npm test`) for local development. It adds no dependencies
// and relies on the fixture behaviour already implemented inside each script.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOL_DIR, "..");
const SCRIPTS_DIR = path.join(REPO_ROOT, "skills", "ai-workflow", "scripts");

// Only scripts that actually expose `--self-test` are listed here.
// `workflow-state.mjs` is a shared library module and has no self-test by design.
const SELF_TEST_SCRIPTS = [
  "validate-work.mjs",
  "check-workflow-scope.mjs",
  "commit-approved-work.mjs",
];

const results = [];

for (const script of SELF_TEST_SCRIPTS) {
  const scriptPath = path.join(SCRIPTS_DIR, script);
  if (!fs.existsSync(scriptPath)) {
    results.push({ script, ok: false, output: "script not found" });
    continue;
  }

  const run = spawnSync(process.execPath, [scriptPath, "--self-test"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });

  const output = [run.stdout, run.stderr]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join("\n");

  results.push({
    script,
    ok: run.status === 0,
    status: run.status,
    signal: run.signal,
    output,
  });
}

let failures = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`PASS ${result.script}${result.output ? ` - ${result.output}` : ""}`);
  } else {
    failures += 1;
    const detail = result.signal ? `signal ${result.signal}` : `exit ${result.status}`;
    console.log(`FAIL ${result.script} - ${detail}`);
    if (result.output) {
      for (const line of result.output.split("\n")) {
        console.log(`     ${line}`);
      }
    }
  }
}

console.log("");
if (failures > 0) {
  console.log(`${failures} of ${results.length} self-test(s) failed.`);
  process.exit(1);
}

console.log(`${results.length} of ${results.length} self-test(s) passed.`);

#!/usr/bin/env node
// Verifies how Pi actually loads the AI Workflow skills.
//
// This tool uses Pi's real `DefaultResourceLoader` from the currently installed
// global Pi runtime. It intentionally does not depend on
// `@earendil-works/pi-coding-agent` in package.json: the package under test has
// no runtime dependencies, and the checker only needs the runtime that is
// already installed on the machine.
//
// Checks performed:
//   - exactly the 10 expected workflow skills load by exact name
//   - missing, unexpected, or duplicate workflow skill names
//   - collision diagnostics that mention workflow skills
//   - no umbrella container skill (`ai-workflow`, or the retired
//     `feature-workflow` container name)
//   - no workflow skill resolves from the retired global
//     `~/.pi/agent/skills/feature-workflow` tree (path kept for compatibility)
//   - all workflow skills resolve from the package root (not a copy)
//   - no workflow skill resolves from the old global
//     `~/.pi/agent/skills/feature-workflow` tree
//   - every loaded workflow skill still has `disable-model-invocation: true`
//
// Modes:
//   default            generate an isolated project that references this package
//                      and load with the real global agent dir (verifies the
//                      package and the global exclusion)
//   --project <dir>    load from an existing project (for example a fixture
//                      where `pi install -l` was used)
//   --expect-none      expect zero of the 10 workflow skills to load
//                      (uninstalled project or neutral directory)
//   --isolated         use a temporary empty agent dir instead of the real one
//                      (pure package check, ignores global settings)
//
// Options:
//   --project <dir>    project directory to load from
//   --package <dir>    package root (default: this repository)
//   --agent-dir <dir>  agent dir (default: real agent dir, or temp with --isolated)
//   --expect-none      expect no workflow skills
//   --isolated         use a temporary agent dir
//   --keep             keep generated temporary directories
//   --verbose          print every loaded skill

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PACKAGE_ROOT = path.resolve(TOOL_DIR, "..");

const EXPECTED_SKILLS = [
  "workflow-bugfix",
  "workflow-commit",
  "workflow-discovery",
  "workflow-feature",
  "workflow-implement",
  "workflow-qa",
  "workflow-refactor",
  "workflow-refresh-context",
  "workflow-setup",
  "workflow-status",
];

const OLD_GLOBAL_SKILL_DIR = path.join(os.homedir(), ".pi", "agent", "skills", "feature-workflow");
// The container directory must never carry a SKILL.md of its own. `ai-workflow`
// is the current container name; the retired `feature-workflow` name is checked
// too so it cannot silently reappear as a single umbrella skill.
const UMBRELLA_NAMES = ["ai-workflow", "feature-workflow"];
const DEFAULT_AGENT_DIR = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent");

function parseArgs(argv) {
  const options = {
    project: undefined,
    packageRoot: DEFAULT_PACKAGE_ROOT,
    agentDir: undefined,
    expectNone: false,
    isolated: false,
    keep: false,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--project":
        options.project = path.resolve(argv[++index]);
        break;
      case "--package":
        options.packageRoot = path.resolve(argv[++index]);
        break;
      case "--agent-dir":
        options.agentDir = path.resolve(argv[++index]);
        break;
      case "--expect-none":
        options.expectNone = true;
        break;
      case "--isolated":
        options.isolated = true;
        break;
      case "--keep":
        options.keep = true;
        break;
      case "--verbose":
        options.verbose = true;
        break;
      default:
        throw new Error(`unknown argument: ${argument}`);
    }
  }

  return options;
}

function resolvePiPackageDir() {
  const candidates = [];

  if (process.env.PI_CODING_AGENT_PACKAGE) {
    candidates.push(process.env.PI_CODING_AGENT_PACKAGE);
  }

  try {
    const globalRoot = spawnSync("npm", ["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (globalRoot.status === 0 && globalRoot.stdout.trim()) {
      candidates.push(path.join(globalRoot.stdout.trim(), "@earendil-works", "pi-coding-agent"));
    }
  } catch {
    // npm is optional for this tool.
  }

  const executableDir = path.dirname(process.execPath);
  candidates.push(path.join(executableDir, "..", "lib", "node_modules", "@earendil-works", "pi-coding-agent"));

  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("@earendil-works/pi-coding-agent");
    candidates.push(path.resolve(entry, "..", ".."));
  } catch {
    // Not resolvable from this working tree; try the remaining candidates.
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, "package.json"))) {
      return resolved;
    }
  }

  throw new Error(
    "Could not resolve the installed @earendil-works/pi-coding-agent package. " +
      "Set PI_CODING_AGENT_PACKAGE to the package directory.",
  );
}

async function importPi() {
  const packageDir = resolvePiPackageDir();
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
  const entry = packageJson.main ?? "dist/index.js";
  const module = await import(pathToFileURL(path.join(packageDir, entry)).href);

  if (typeof module.DefaultResourceLoader !== "function") {
    throw new Error(`DefaultResourceLoader is not exported by ${packageDir}`);
  }

  return {
    packageDir,
    version: packageJson.version,
    DefaultResourceLoader: module.DefaultResourceLoader,
  };
}

function createFixtureProject(packageRoot) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-project-"));
  const settingsDir = path.join(projectDir, ".pi");
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(
    path.join(settingsDir, "settings.json"),
    `${JSON.stringify({ packages: [packageRoot] }, null, 2)}\n`,
  );
  return projectDir;
}

function createFixtureAgentDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ai-workflow-agent-"));
}

function isUnder(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const temporaryDirs = [];

  if (!fs.existsSync(options.packageRoot)) {
    throw new Error(`package root does not exist: ${options.packageRoot}`);
  }

  let projectDir = options.project;
  if (!projectDir) {
    projectDir = createFixtureProject(options.packageRoot);
    temporaryDirs.push(projectDir);
  }

  let agentDir = options.agentDir;
  if (!agentDir) {
    if (options.isolated) {
      agentDir = createFixtureAgentDir();
      temporaryDirs.push(agentDir);
    } else {
      agentDir = DEFAULT_AGENT_DIR;
    }
  }

  const pi = await importPi();
  const loader = new pi.DefaultResourceLoader({
    cwd: projectDir,
    agentDir,
    noExtensions: true,
    noContextFiles: true,
  });

  await loader.reload({ resolveProjectTrust: async () => true });

  const { skills, diagnostics } = loader.getSkills();

  const loadedExpected = new Map();
  for (const skill of skills) {
    if (EXPECTED_SKILLS.includes(skill.name)) {
      const list = loadedExpected.get(skill.name) ?? [];
      list.push(skill);
      loadedExpected.set(skill.name, list);
    }
  }

  const missing = EXPECTED_SKILLS.filter((name) => !loadedExpected.has(name));
  const loadedNames = [...loadedExpected.keys()];
  const duplicates = loadedNames.filter((name) => (loadedExpected.get(name) ?? []).length > 1);
  const unexpectedWorkflow = skills
    .filter((skill) => skill.name.startsWith("workflow-") && !EXPECTED_SKILLS.includes(skill.name))
    .map((skill) => skill.name);
  const umbrella = skills.filter((skill) => UMBRELLA_NAMES.includes(skill.name));
  const workflowSkills = skills.filter(
    (skill) => EXPECTED_SKILLS.includes(skill.name) || skill.name.startsWith("workflow-") || UMBRELLA_NAMES.includes(skill.name),
  );

  const collisionDiagnostics = diagnostics.filter((diagnostic) => {
    if (diagnostic.type !== "collision") return false;
    const name = diagnostic.collision?.name ?? "";
    return EXPECTED_SKILLS.includes(name) || name.startsWith("workflow-") || UMBRELLA_NAMES.includes(name);
  });

  const fromOldGlobal = workflowSkills.filter((skill) => isUnder(skill.filePath, OLD_GLOBAL_SKILL_DIR));
  const outsidePackage = workflowSkills.filter(
    (skill) => !isUnder(skill.filePath, options.packageRoot) && !isUnder(skill.filePath, OLD_GLOBAL_SKILL_DIR),
  );
  const notExplicit = workflowSkills.filter((skill) => skill.disableModelInvocation !== true);

  const expectedCount = options.expectNone ? 0 : EXPECTED_SKILLS.length;
  const checks = [];

  if (options.expectNone) {
    checks.push({
      ok: loadedNames.length === 0 && workflowSkills.length === 0,
      label: `no workflow skills load (found ${workflowSkills.length})`,
    });
  } else {
    checks.push({
      ok: loadedNames.length === EXPECTED_SKILLS.length,
      label: `${EXPECTED_SKILLS.length} expected workflow skills load (found ${loadedNames.length})`,
    });
    checks.push({ ok: missing.length === 0, label: `no missing skills${missing.length ? `: ${missing.join(", ")}` : ""}` });
    checks.push({ ok: duplicates.length === 0, label: `no duplicate workflow skill names${duplicates.length ? `: ${duplicates.join(", ")}` : ""}` });
    checks.push({
      ok: unexpectedWorkflow.length === 0,
      label: `no unexpected workflow-* skills${unexpectedWorkflow.length ? `: ${unexpectedWorkflow.join(", ")}` : ""}`,
    });
    checks.push({ ok: umbrella.length === 0, label: `no umbrella container skill (${UMBRELLA_NAMES.join(", ")})` });
    checks.push({
      ok: collisionDiagnostics.length === 0,
      label: `no workflow skill collision diagnostics${collisionDiagnostics.length ? `: ${collisionDiagnostics.map((d) => d.message).join("; ")}` : ""}`,
    });
    checks.push({
      ok: outsidePackage.length === 0,
      label: `all workflow skills load from the package root${outsidePackage.length ? `: ${outsidePackage.map((s) => s.filePath).join(", ")}` : ""}`,
    });
    checks.push({ ok: notExplicit.length === 0, label: "all workflow skills keep disable-model-invocation: true" });
  }

  checks.push({
    ok: fromOldGlobal.length === 0,
    label: `no workflow skill resolves from ${OLD_GLOBAL_SKILL_DIR}${fromOldGlobal.length ? `: ${fromOldGlobal.length} found` : ""}`,
  });

  console.log(`Pi package: ${pi.packageDir} (v${pi.version})`);
  console.log(`Project:    ${projectDir}${options.project ? "" : " (generated)"}`);
  console.log(`Agent dir:  ${agentDir}`);
  console.log(`Package:    ${options.packageRoot}`);
  console.log("");

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? "[ok]  " : "[FAIL]"} ${check.label}`);
  }

  if (options.verbose) {
    console.log("");
    console.log("Loaded skills:");
    for (const skill of skills) {
      console.log(`  ${skill.name} -> ${skill.filePath}`);
    }
  }

  const relevantDiagnostics = diagnostics.filter(
    (diagnostic) =>
      diagnostic.type === "collision" ||
      EXPECTED_SKILLS.includes(path.basename(path.dirname(diagnostic.path ?? ""))),
  );
  if (relevantDiagnostics.length > 0) {
    console.log("");
    console.log("Relevant diagnostics:");
    for (const diagnostic of relevantDiagnostics) {
      console.log(`  ${diagnostic.type}: ${diagnostic.message}${diagnostic.path ? ` (${diagnostic.path})` : ""}`);
    }
  }

  if (!options.keep) {
    for (const dir of temporaryDirs) {
      removeDir(dir);
    }
  } else if (temporaryDirs.length > 0) {
    console.log("");
    console.log(`Kept temporary directories: ${temporaryDirs.join(", ")}`);
  }

  if (failed.length > 0) {
    console.log("");
    console.log(`${failed.length} check(s) failed.`);
    process.exit(1);
  }

  console.log("");
  console.log(`All checks passed (${checks.length}).`);
}

main().catch((error) => {
  console.error(`check-loading failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

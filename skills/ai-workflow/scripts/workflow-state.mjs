#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const WORKFLOW_DIR = ".pi/workflow";
export const CURRENT_WORK_RELATIVE_PATH = `${WORKFLOW_DIR}/current-work.md`;
export const CONFIG_RELATIVE_PATH = `${WORKFLOW_DIR}/config.md`;

export const VALID_PROFILES = new Set(["solo", "team"]);
export const VALID_TYPES = new Set(["feature", "bugfix", "refactor", "bootstrap"]);
export const VALID_STATUSES = new Set([
  "draft",
  "awaiting_spec_approval",
  "implementing",
  "qa_pending",
  "qa_failed",
  "ready_for_commit",
  "awaiting_commit_approval",
  "blocked",
  "archived",
  "idle",
]);

function stripInlineComment(value) {
  let quoted = false;
  let quote = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === '"' || character === "'") && value[index - 1] !== "\\") {
      if (!quoted) {
        quoted = true;
        quote = character;
      } else if (quote === character) {
        quoted = false;
        quote = "";
      }
    }
    if (!quoted && character === "#" && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trim();
    }
  }

  return value.trim();
}

function parseScalar(raw) {
  const value = stripInlineComment(raw);
  if (value === "[]") return [];
  if (value === "{}") return {};
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Parses the small YAML subset used by the workflow Markdown artifacts. */
export function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: markdown, errors: ["Missing YAML frontmatter."] };

  const meta = {};
  const errors = [];
  let currentTop;
  let currentNested;

  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const indent = rawLine.match(/^\s*/)[0].length;
    const line = rawLine.trim();

    if (indent === 0) {
      const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!entry) {
        errors.push(`Unsupported frontmatter line: ${rawLine}`);
        continue;
      }
      const [, key, rawValue] = entry;
      meta[key] = rawValue === "" ? null : parseScalar(rawValue);
      currentTop = key;
      currentNested = undefined;
      continue;
    }

    if (indent === 2) {
      if (!currentTop) {
        errors.push(`Nested frontmatter value has no parent: ${rawLine}`);
        continue;
      }
      if (line.startsWith("- ")) {
        if (!Array.isArray(meta[currentTop])) meta[currentTop] = [];
        meta[currentTop].push(parseScalar(line.slice(2)));
        continue;
      }
      const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!entry) {
        errors.push(`Unsupported nested frontmatter line: ${rawLine}`);
        continue;
      }
      if (!isPlainObject(meta[currentTop])) meta[currentTop] = {};
      const [, key, rawValue] = entry;
      meta[currentTop][key] = rawValue === "" ? null : parseScalar(rawValue);
      currentNested = key;
      continue;
    }

    if (indent === 4 && line.startsWith("- ")) {
      if (!currentTop || !currentNested || !isPlainObject(meta[currentTop])) {
        errors.push(`Nested list has no valid parent: ${rawLine}`);
        continue;
      }
      if (!Array.isArray(meta[currentTop][currentNested])) meta[currentTop][currentNested] = [];
      meta[currentTop][currentNested].push(parseScalar(line.slice(2)));
      continue;
    }

    errors.push(`Unsupported frontmatter indentation: ${rawLine}`);
  }

  return { meta, body: match[2], errors };
}

export function readWorkflowFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { filePath, markdown: "", meta: {}, body: "", errors: [`File not found: ${filePath}`] };
  }
  const markdown = fs.readFileSync(filePath, "utf8");
  const parsed = parseFrontmatter(markdown);
  return { filePath, markdown, ...parsed };
}

export function normalizePath(value) {
  return String(value ?? "")
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/^\.\//, "")
    .replaceAll("\\", "/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/$/, "");
}

export function isWorkflowPath(filePath) {
  const normalized = normalizePath(filePath);
  return normalized === WORKFLOW_DIR || normalized.startsWith(`${WORKFLOW_DIR}/`);
}

export function globMatches(pattern, candidate) {
  const normalizedPattern = normalizePath(pattern);
  const normalizedCandidate = normalizePath(candidate);
  if (normalizedPattern.endsWith("/**") && normalizedCandidate === normalizedPattern.slice(0, -3)) return true;

  let expression = "^";
  for (let index = 0; index < normalizedPattern.length; index += 1) {
    const character = normalizedPattern[index];
    const next = normalizedPattern[index + 1];
    if (character === "*" && next === "*") {
      expression += ".*";
      index += 1;
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  expression += "$";
  return new RegExp(expression).test(normalizedCandidate);
}

export function validateProjectRelativePath(rawPath, { allowGlob = true, role = "Path" } = {}) {
  const raw = String(rawPath ?? "").trim();
  const normalized = normalizePath(raw);
  if (!raw || !normalized) return `${role} is empty.`;
  if (raw.includes("\\")) return `${role} must use forward slashes: ${raw}.`;
  if (/^(?:\/|~|[A-Za-z]:[\\/])/.test(raw)) return `${role} must be project-relative: ${raw}.`;

  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return `${role} contains an invalid segment: ${raw}.`;
  }

  if (!allowGlob && /[*?{}\[\]]/.test(normalized)) {
    return `${role} must be concrete, not a glob: ${raw}.`;
  }

  if (allowGlob) {
    if (normalized === "*" || normalized === "**" || normalized === "/**" || normalized.startsWith("**/")) {
      return `${role} is root-wide and forbidden: ${raw}.`;
    }
    if (/[*?{}\[\]]/.test(segments[0])) return `${role} has a wildcard root segment: ${raw}.`;
    if (/[{}\[\]]/.test(normalized)) return `${role} uses an unsupported pattern: ${raw}.`;
  }

  return null;
}

export function sectionContent(body, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = new RegExp(`^##\\s+${escaped}\\s*$`, "mi").exec(body);
  if (!header || header.index === undefined) return null;
  const remainder = body.slice(header.index + header[0].length);
  const nextHeader = remainder.search(/^##\s+/m);
  return (nextHeader === -1 ? remainder : remainder.slice(0, nextHeader)).trim();
}

export function containsNoneOnly(value) {
  return /^(?:-\s*)?none\.?$/i.test(String(value ?? "").trim());
}

export function valueAsList(value) {
  return Array.isArray(value) ? value.map(normalizePath).filter(Boolean) : [];
}

export function valueAsMap(value) {
  return isPlainObject(value) ? value : {};
}

export function runGit(projectRoot, argumentsList) {
  const result = spawnSync("git", ["-C", projectRoot, ...argumentsList], { encoding: "utf8" });
  return {
    ok: result.status === 0,
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function statusPaths(rawStatus) {
  const entries = String(rawStatus).split("\0").filter(Boolean);
  const paths = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.length < 4) continue;
    const code = entry.slice(0, 2);
    paths.push(normalizePath(entry.slice(3)));
    if (code.includes("R") || code.includes("C")) {
      const original = entries[index + 1];
      if (original) {
        paths.push(normalizePath(original));
        index += 1;
      }
    }
  }

  return [...new Set(paths.filter(Boolean))];
}

export function nulPaths(value) {
  return [...new Set(String(value).split("\0").filter(Boolean).map(normalizePath).filter(Boolean))];
}

export function currentWorkPath(projectRoot) {
  return path.join(projectRoot, CURRENT_WORK_RELATIVE_PATH);
}

export function configPath(projectRoot) {
  return path.join(projectRoot, CONFIG_RELATIVE_PATH);
}

export function isValidWorkId(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value ?? ""));
}

export function nowIso() {
  return new Date().toISOString();
}

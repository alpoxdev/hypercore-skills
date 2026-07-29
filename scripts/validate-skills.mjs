#!/usr/bin/env bun
// @ts-check

/** Validate the approved Bun skill-script inventory and safety boundaries. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "scripts/fixtures/skill-script-parity/manifest.json");
const skillsPath = join(root, "skills");

/** @param {string} directory @returns {string[]} */
function filesBelow(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesBelow(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

/** @param {boolean} condition @param {string} message @returns {asserts condition} */
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** @param {string[]} values @returns {string[]} */
function sorted(values) { return [...values].sort((left, right) => left.localeCompare(right)); }
/** @param {string[]} left @param {string[]} right @returns {boolean} */
function sameList(left, right) { return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right)); }
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
/** @param {unknown} value @returns {value is string} */
function nonEmpty(value) { return typeof value === "string" && value.trim() !== ""; }

/** @param {string} content @param {string} file */
function validateNamedFunctionDocs(content, file) {
  const pattern = /\/\*\*((?:(?!\/\*\*)[\s\S])*?)\*\/\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/gu;
  for (const match of content.matchAll(pattern)) {
    const [, doc, name, rawParameters] = match;
    const parameters = rawParameters.split(",").map((value) => value.trim().replace(/^\.\.\./u, "").split("=")[0].trim()).filter((value) => /^[A-Za-z_$][\w$]*$/u.test(value));
    const documented = doc.split("@").filter((tag) => tag.trimStart().startsWith("param")).map((tag) => tag.trimStart().replace(/^param\b/u, "").trim().split(/\s+/u).filter((part) => part !== "*").at(-1)?.replace(/^\[|\]$/gu, "") ?? "");
    assert(sameList(parameters, documented), `${file}:${name} JSDoc @param names must exactly match named parameters`);
    for (const tag of doc.matchAll(/@(returns?|throws?)\b([^\n*]*)/gu)) assert(tag[2].trim() !== "", `${file}:${name} @${tag[1]} must have a description or type`);
  }
}

const manifest = /** @type {Record<string, unknown>} */ (JSON.parse(readFileSync(manifestPath, "utf8")));
assert(Array.isArray(manifest.scripts), "manifest scripts must be an array");
assert(manifest.scripts.length === 30, "manifest must contain exactly 30 scripts");
assert(manifest.scripts.every(isRecord), "manifest rows must be objects");
const requiredRowFields = ["path", "family", "legacyOrigin", "usage", "behavior"];
for (const [index, row] of manifest.scripts.entries()) {
  for (const field of requiredRowFields) assert(nonEmpty(row[field]), `manifest scripts[${index}].${field} must be a non-empty string`);
  assert(row.path === `skills/${row.family}/scripts/${String(row.path).split("/").at(-1)}`, `manifest scripts[${index}] path/family must agree`);
}
const approved = manifest.scripts.map((row) => /** @type {string} */ (row.path));
assert(new Set(approved).size === approved.length, "manifest script paths must be unique");

const references = manifest.forbiddenDetectorReferences;
assert(isRecord(references), "manifest forbiddenDetectorReferences must be an object");
assert(references.detector === "git-commit-detect", "manifest detector name must be exact");
assert(Array.isArray(references.externalCandidatePaths) && references.externalCandidatePaths.length > 0, "manifest external candidate paths are required");
for (const candidate of references.externalCandidatePaths) {
  assert(isRecord(candidate) && nonEmpty(candidate.path) && (candidate.state === "installed" || candidate.state === "missing") && nonEmpty(candidate.handoff), "external candidate paths require path, installed|missing state, and handoff");
}
assert(Array.isArray(references.allowlist) && sameList(references.allowlist, ["scripts/fixtures/skill-script-parity/manifest.json", "scripts/validate-skills.mjs"]), "detector reference allowlist must be exact");
assert(isRecord(references.selfAudit) && references.selfAudit.production === "zero" && references.selfAudit.docs === "zero" && references.selfAudit.manifest === "allowlist-only" && references.selfAudit.behavior === "zero", "detector self-audit policy must be exact");
const correction = manifest.versionUpdateDetectorAbsentCorrection;
assert(isRecord(correction) && nonEmpty(correction.baseline) && nonEmpty(correction.rollback), "version-update detector-absent correction baseline and rollback are required");

const scriptFiles = filesBelow(skillsPath).map((file) => relative(root, file));
const mjsFiles = scriptFiles.filter((file) => file.endsWith(".mjs"));
const legacyFiles = scriptFiles.filter((file) => /\/scripts\/.*\.(?:sh|py)$/u.test(file));
assert(legacyFiles.length === 0, `skill script directories must contain no .sh or .py files: ${legacyFiles.join(", ")}`);
assert(sameList(mjsFiles, approved), "MJS inventory must exactly match the 30-row manifest");

const detectorPattern = /git-commit-detect/iu;
const auditFiles = [...filesBelow(join(root, "skills")), ...filesBelow(join(root, "instructions")), join(root, "README.md")];
for (const absolute of auditFiles) {
  if (statSync(absolute).isFile()) assert(!detectorPattern.test(readFileSync(absolute, "utf8")), `forbidden detector reference outside allowlist: ${relative(root, absolute)}`);
}
assert(!detectorPattern.test(JSON.stringify(manifest.scripts)) && !detectorPattern.test(JSON.stringify(manifest.scripts.map((row) => row.behavior))), "manifest paths and behavior must contain zero detector references");

for (const file of approved) {
  const absolute = join(root, file);
  const content = readFileSync(absolute, "utf8");
  const mode = statSync(absolute).mode;
  assert(content.startsWith("#!/usr/bin/env bun\n"), `${file} must use the Bun shebang`);
  assert(/^\/\/ @ts-check\s*$/mu.test(content), `${file} must enable @ts-check`);
  assert((mode & 0o111) !== 0, `${file} must be executable`);
  assert(!/\b(?:exec|execFile|spawn)\s*\([^\n]*\{[^\n]*\bshell\s*:\s*true/u.test(content), `${file} must not invoke a shell`);
  assert(!/\bBun\.\$|\b(?:bash|sh|zsh)\s+-c\b/u.test(content), `${file} must not use shell command patterns`);
  assert(!/\b(?:import\s*\{[^}]*\bspawnSync\b[^}]*\}|(?:const|let|var)\s+spawnSync\s*=)\b/u.test(content), `${file} must not use spawnSync`);
  assert(!/\b(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']\.{1,2}\//u.test(content), `${file} must not have runtime local imports`);
  assert(!/\bimport\s*\(\s*["']\.{1,2}\//u.test(content), `${file} must not dynamically import local modules`);
  assert(!/\brequire\s*\(\s*["']\.{1,2}\//u.test(content), `${file} must not require local modules`);
  assert(!/["']node:child_process["']/u.test(content), `${file} must not import shell process helpers`);
  validateNamedFunctionDocs(content, file);
}

console.log(`Validated ${approved.length} Bun MJS skill scripts.`);

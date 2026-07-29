#!/usr/bin/env bun
// @ts-check

/** Exercise the immutable skill-script manifest and harmless Bun subprocess paths. */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = join(root, "scripts/fixtures/skill-script-parity/manifest.json");
const validatorPath = join(root, "scripts/validate-skills.mjs");
const currentVersionPath = join(root, "skills/version-update/scripts/version-current.mjs");
const versionApplyPath = join(root, "skills/version-update/scripts/version-apply.mjs");
const dashboardPath = join(root, "skills/autoresearch-code/scripts/render-dashboard.mjs");
const versionGitCommitPath = join(root, "skills/version-update/scripts/git-commit.mjs");
const versionGitPushPath = join(root, "skills/version-update/scripts/git-push.mjs");
const deployCheckPath = join(root, "skills/pre-deploy/scripts/deploy-check.mjs");

/** @param {string[]} command @param {string} cwd */
function run(command, cwd) {
  const result = Bun.spawnSync({ cmd: command, cwd, stdout: "pipe", stderr: "pipe" });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}
/** @param {string} directory */
function filesBelow(directory) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...filesBelow(file));
    else if (entry.isFile() && file.endsWith(".mjs")) files.push(file);
  }
  return files;
}


test("manifest closes over exactly the approved 30 MJS paths and policy metadata", () => {
  const manifest = /** @type {{ scripts: { path: string, family: string, legacyOrigin: string, usage: string, behavior: string }[], forbiddenDetectorReferences: { detector: string }, versionUpdateDetectorAbsentCorrection: { baseline: string, rollback: string } }} */ (JSON.parse(readFileSync(manifestPath, "utf8")));
  expect(manifest.scripts).toHaveLength(30);
  expect(new Set(manifest.scripts.map((row) => row.path)).size).toBe(30);
  expect(manifest.scripts.every((row) => [row.path, row.family, row.legacyOrigin, row.usage, row.behavior].every(Boolean))).toBe(true);
  expect(manifest.scripts.map((row) => row.path).sort()).toEqual(
    filesBelow(join(root, "skills")).map((file) => relative(root, file)).sort(),
  );
  expect(manifest.forbiddenDetectorReferences.detector).toBe("git-commit-detect");
  expect(manifest.versionUpdateDetectorAbsentCorrection.baseline).not.toBe("");
  expect(manifest.versionUpdateDetectorAbsentCorrection.rollback).not.toBe("");
});

test("validator accepts the approved inventory", () => {
  const result = run([process.execPath, validatorPath], root);
  expect(result.stderr).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Validated 30 Bun MJS skill scripts.");
});

test("version-current reads an isolated package fixture without changing it", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hypercore-version-current-"));
  const packagePath = join(fixture, "package.json");
  const source = '{"name":"fixture","version":"1.2.3"}\n';
  writeFileSync(packagePath, source);
  try {
    const result = run([process.execPath, currentVersionPath, packagePath], fixture);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(`${packagePath}|1.2.3`);
    expect(readFileSync(packagePath, "utf8")).toBe(source);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
test("version scripts reject leading-zero semver and preserve paths with spaces", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hypercore version fixture-"));
  const packagePath = join(fixture, "package.json");
  writeFileSync(packagePath, '{"name":"fixture","version":"1.2.3"}\n');
  try {
    const rejected = run([process.execPath, versionApplyPath, "01.2.3", packagePath], fixture);
    expect(rejected.exitCode).toBe(1);
    const applied = run([process.execPath, versionApplyPath, "2.0.0", packagePath], fixture);
    expect(applied.exitCode).toBe(0);
    expect(readFileSync(packagePath, "utf8")).toContain('"version":"2.0.0"');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("dashboard validation leaves no partial output for malformed results", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hypercore-dashboard-"));
  writeFileSync(join(fixture, "results.json"), "{\"status\":\"complete\"}\n");
  try {
    const result = run([process.execPath, dashboardPath, fixture], fixture);
    expect(result.exitCode).toBe(1);
    expect(readdirSync(fixture).sort()).toEqual(["results.json"]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("dashboard produces both artifacts from a valid isolated result", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hypercore-dashboard-"));
  writeFileSync(join(fixture, "results.json"), JSON.stringify({ status: "running", codebase_name: "fixture", current_experiment: 0, baseline_score: 1, best_score: 1, experiments: [] }));
  try {
    const result = run([process.execPath, dashboardPath, fixture], fixture);
    expect(result.exitCode).toBe(0);
    expect(readdirSync(fixture).sort()).toEqual(["dashboard.html", "results.js", "results.json"]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("version Git helpers reject unrelated staged files without staging requested files", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hypercore-git-"));
  try {
    expect(run(["git", "init", "-q"], fixture).exitCode).toBe(0);
    expect(run(["git", "config", "user.name", "Test"], fixture).exitCode).toBe(0);
    expect(run(["git", "config", "user.email", "test@example.com"], fixture).exitCode).toBe(0);
    writeFileSync(join(fixture, "a.txt"), "initial\n");
    writeFileSync(join(fixture, "b.txt"), "initial\n");
    expect(run(["git", "add", "a.txt", "b.txt"], fixture).exitCode).toBe(0);
    expect(run(["git", "commit", "-qm", "initial"], fixture).exitCode).toBe(0);
    writeFileSync(join(fixture, "a.txt"), "changed\n");
    writeFileSync(join(fixture, "b.txt"), "changed\n");
    expect(run(["git", "add", "b.txt"], fixture).exitCode).toBe(0);

    const result = run([process.execPath, versionGitCommitPath, "test: scoped", "a.txt"], fixture);
    expect(result.exitCode).toBe(1);
    expect(run(["git", "diff", "--cached", "--name-only"], fixture).stdout.trim()).toBe("b.txt");
    expect(run(["git", "log", "-1", "--format=%s"], fixture).stdout.trim()).toBe("initial");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("version git-push rejects unknown arguments before touching a remote", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hypercore-push-"));
  try {
    expect(run(["git", "init", "-q"], fixture).exitCode).toBe(0);
    const result = run([process.execPath, versionGitPushPath, "--unknown"], fixture);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Usage:");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("pre-deploy rejects malformed package metadata", () => {
  const fixture = mkdtempSync(join(tmpdir(), "hypercore-predeploy-"));
  writeFileSync(join(fixture, "package.json"), "{broken");
  try {
    const result = run([process.execPath, deployCheckPath, "--sequential"], fixture);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("package.json");
    expect(result.stdout).not.toContain("Ready to deploy");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

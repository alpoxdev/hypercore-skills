#!/usr/bin/env bun
// @ts-check
/** Extract a semantic version from a version-bearing project file. */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";

const SEMVER = "(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)";

/** @param {string} file @param {RegExp} pattern */
function firstMatch(file, pattern) {
  const content = readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match) return match[1];
  }
  return "";
}
/** @param {string} file */
function cargoVersion(file) {
  let inPackage = false;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\[package\][ \t]*$/.test(line)) { inPackage = true; continue; }
    if (/^\[[^\]]+\][ \t]*$/.test(line) && line !== "[package]") inPackage = false;
    if (inPackage) {
      const match = line.match(new RegExp(`^[ \\t]*version[ \\t]*=.*"(${SEMVER})"`));
      if (match) return match[1];
    }
  }
  return "";
}
/** @param {string} file */
function pyprojectVersion(file) {
  let section = "";
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\[[^\]]+\][ \t]*$/.test(line)) { section = line; continue; }
    if ((section === "[project]" || section === "[tool.poetry]") && /^[ \t]*version[ \t]*=/.test(line)) {
      const version = line.replace(/^[^=]*=/, "").replace(/[ \t"']/g, "");
      if (new RegExp(`^${SEMVER}$`).test(version)) return version;
    }
  }
  return "";
}

let file = process.argv[2] ?? "";
if (!file) {
  for (const candidate of ["package.json", "Cargo.toml", "pyproject.toml", "setup.py"]) {
    if (existsSync(candidate)) { file = candidate; break; }
  }
  if (!file) {
    const finder = resolve(dirname(fileURLToPath(import.meta.url)), "version-find.mjs");
    const activeChildren = new Set();
    const child = Bun.spawn([process.execPath, finder, "--plain"], { stdout: "pipe", stderr: "pipe" });
    activeChildren.add(child);
    const stdout = new Response(child.stdout).text();
    const stderr = new Response(child.stderr).text();
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => {
        for (const activeChild of activeChildren) activeChild.kill(signal);
      });
    }
    try {
      const [exitCode, output, error] = await Promise.all([child.exited, stdout, stderr]);
      if (exitCode !== 0 && error) process.stderr.write(error);
      file = output.split(/\r?\n/)[0] ?? "";
    } finally {
      activeChildren.delete(child);
    }
  }
}
if (!file || !existsSync(file)) {
  console.error("Error: Could not determine a version file");
  process.exit(1);
}

let version = "";
switch (basename(file)) {
  case "package.json":
    version = firstMatch(file, new RegExp(`.*"version"[ \\t]*:[ \\t]*"(${SEMVER})".*`));
    break;
  case "Cargo.toml": version = cargoVersion(file); break;
  case "pyproject.toml": version = pyprojectVersion(file); break;
  case "setup.py": version = firstMatch(file, new RegExp(`.*version[ \\t]*=[ \\t]*['"](${SEMVER})['"].*`)); break;
  default:
    if (file.endsWith(".py")) version = firstMatch(file, new RegExp(`^[ \\t]*__version__[ \\t]*=[ \\t]*['"](${SEMVER})['"].*`));
    if (!version) version = firstMatch(file, new RegExp(`.*\\.version\\(['"](${SEMVER})['"]\\).*`));
}
if (!new RegExp(`^${SEMVER}$`).test(version)) {
  console.error(`Error: Could not parse semantic version (x.y.z) from ${file}`);
  process.exit(1);
}
console.log(`${file}|${version}`);

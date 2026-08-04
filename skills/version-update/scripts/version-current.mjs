#!/usr/bin/env bun
// @ts-check
/** Extract a semantic version from a version-bearing project file. */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";

const SEMVER = "(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)";
const activeChildren = new Set();
/** @type {string | undefined} */
let receivedSignal;
const signalHandlers = new Map();
for (const signal of ["SIGINT", "SIGTERM"]) {
  const handler = () => {
    receivedSignal ??= signal;
    for (const child of activeChildren) child.kill(signal);
  };
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
}

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

/** @returns {Promise<number>} */
async function main() {
  let file = process.argv[2] ?? "";
  if (!file) {
    for (const candidate of ["package.json", "Cargo.toml", "pyproject.toml", "setup.py"]) {
      if (existsSync(candidate)) { file = candidate; break; }
    }
    if (!file) {
      const finder = resolve(dirname(fileURLToPath(import.meta.url)), "version-find.mjs");
      if (receivedSignal) { console.error("Error: Interrupted by signal"); return 1; }
      const child = Bun.spawn({ cmd: [process.execPath, finder, "--plain"], cwd: process.cwd(), env: process.env, stdout: "pipe", stderr: "pipe" });
      activeChildren.add(child);
      const stdout = new Response(child.stdout).text();
      const stderr = new Response(child.stderr).text();
      try {
        const [finderExitCode, output, error] = await Promise.all([child.exited, stdout, stderr]);
        if (finderExitCode !== 0) {
          if (error) process.stderr.write(error);
          console.error(`Error: Version discovery failed with exit code ${finderExitCode}`);
          return 1;
        }
        file = output.split(/\r?\n/)[0] ?? "";
      } finally {
        activeChildren.delete(child);
      }
    }
  }
  if (!file || !existsSync(file)) {
    console.error("Error: Could not determine a version file");
    return 1;
  }

  let version = "";
  switch (basename(file)) {
    case "package.json":
      version = firstMatch(file, new RegExp(`.*"version"[ \t]*:[ \t]*"(${SEMVER})".*`));
      break;
    case "Cargo.toml": version = cargoVersion(file); break;
    case "pyproject.toml": version = pyprojectVersion(file); break;
    case "setup.py": version = firstMatch(file, new RegExp(`.*version[ \t]*=[ \t]*['"](${SEMVER})['"].*`)); break;
    default:
      if (file.endsWith(".py")) version = firstMatch(file, new RegExp(`^[ \t]*__version__[ \t]*=[ \t]*['"](${SEMVER})['"].*`));
      if (!version) version = firstMatch(file, new RegExp(`.*\\.version\\(['"](${SEMVER})['"]\\).*`));
  }
  if (!new RegExp(`^${SEMVER}$`).test(version)) {
    console.error(`Error: Could not parse semantic version (x.y.z) from ${file}`);
    return 1;
  }
  console.log(`${file}|${version}`);
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} finally {
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  if (receivedSignal) {
    for (const child of activeChildren) child.kill(receivedSignal);
    await Promise.allSettled([...activeChildren].map((child) => child.exited));
    process.kill(process.pid, receivedSignal);
  }
}
process.exitCode = exitCode;

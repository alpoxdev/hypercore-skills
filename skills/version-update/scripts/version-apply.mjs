#!/usr/bin/env bun
// @ts-check
/** Apply a semantic version to explicitly supplied or discovered version files. */
import { chmodSync, existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
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

try {

const [newVersion, ...providedFiles] = process.argv.slice(2);
if (!newVersion) {
  console.error(`Usage: ${process.argv[1]} <new_version> [files...]`);
  throw new Error("Invalid arguments");
}
if (!new RegExp(`^${SEMVER}$`).test(newVersion)) {
  console.error(`Error: Invalid version format: ${newVersion} (expected x.y.z)`);
  throw new Error("Invalid version");
}

let files = providedFiles;
if (!files.length) {
  const finder = resolve(dirname(fileURLToPath(import.meta.url)), "version-find.mjs");
  if (receivedSignal) {
    console.error("Error: Interrupted by signal");
    throw new Error("Interrupted by signal");
  }
  const child = Bun.spawn({ cmd: [process.execPath, finder, "--plain"], cwd: process.cwd(), env: process.env, stdout: "pipe", stderr: "pipe" });
  activeChildren.add(child);
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  try {
    const [exitCode, output, error] = await Promise.all([child.exited, stdout, stderr]);
    if (exitCode !== 0) {
      if (error) process.stderr.write(error);
      console.error(`Error: Version discovery failed with exit code ${exitCode}`);
      throw new Error(`Version discovery failed with exit code ${exitCode}`);
    }
    files = output.split(/\r?\n/).filter(Boolean);
  } finally {
    activeChildren.delete(child);
  }
}
if (!files.length) {
  console.error("Error: No version files found");
  throw new Error("No version files found");
}

/** @param {string} file */
function updateFor(file) {
  switch (basename(file)) {
    case "package.json": return updatePackage;
    case "Cargo.toml": return updateCargo;
    case "pyproject.toml": return updatePyproject;
    case "setup.py": return (/** @type {string} */ content) => content.replace(/(version[ \t]*=[ \t]*['"])[0-9]+\.[0-9]+\.[0-9]+(['"])/g, `$1${newVersion}$2`);
    default:
      if (!file.endsWith(".py")) return null;
      return (/** @type {string} */ content) => {
        let result = content.replace(/^([ \t]*__version__[ \t]*=[ \t]*['"])[0-9]+\.[0-9]+\.[0-9]+(['"].*)$/m, `$1${newVersion}$2`);
        return result.replace(/(\.version\(['"])[0-9]+\.[0-9]+\.[0-9]+(['"]\))/g, `$1${newVersion}$2`);
      };
  }
}
/** @param {string} content */
function updatePackage(content) {
  let done = false;
  return content.split(/(?<=\n)/).map((line) => {
    if (!done && /"version"[ \t]*:/.test(line)) {
      done = true;
      return line.replace(/"[0-9]+\.[0-9]+\.[0-9]+"/g, `"${newVersion}"`);
    }
    return line;
  }).join("");
}
/** @param {string} content */
function updateCargo(content) {
  let inPackage = false;
  return content.split(/(?<=\n)/).map((line) => {
    const bare = line.replace(/\r?\n$/, "");
    if (/^\[package\][ \t]*$/.test(bare)) { inPackage = true; return line; }
    if (/^\[[^\]]+\][ \t]*$/.test(bare) && bare !== "[package]") { inPackage = false; return line; }
    return inPackage && /^[ \t]*version[ \t]*=/.test(bare)
      ? line.replace(/"[0-9]+\.[0-9]+\.[0-9]+"/, `"${newVersion}"`)
      : line;
  }).join("");
}
/** @param {string} content */
function updatePyproject(content) {
  let section = "";
  return content.split(/(?<=\n)/).map((line) => {
    const bare = line.replace(/\r?\n$/, "");
    if (/^\[[^\]]+\][ \t]*$/.test(bare)) { section = bare; return line; }
    if ((section === "[project]" || section === "[tool.poetry]") && /^[ \t]*version[ \t]*=/.test(bare)) {
      return line.replace(/"[0-9]+\.[0-9]+\.[0-9]+"/, `"${newVersion}"`).replace(/'[0-9]+\.[0-9]+\.[0-9]+'/, `'${newVersion}'`);
    }
    return line;
  }).join("");
}

/** @param {string} file @param {string} content */
function hasRequestedVersion(file, content) {
  const escaped = newVersion.replace(/\./g, "\\.");
  switch (basename(file)) {
    case "package.json":
      return new RegExp(`"version"[ \\t]*:[ \\t]*"${escaped}"`).test(content);
    case "Cargo.toml":
      return content.split(/\r?\n/).some((line, index, lines) => {
        if (!/^[ \t]*version[ \t]*=[ \t]*"/.test(line)) return false;
        let section = "";
        for (let cursor = 0; cursor <= index; cursor += 1) {
          if (/^\[[^\]]+\][ \t]*$/.test(lines[cursor])) section = lines[cursor];
        }
        return section === "[package]" && new RegExp(`^[ \\t]*version[ \\t]*=[ \\t]*"${escaped}"`).test(line);
      });
    case "pyproject.toml": {
      let section = "";
      return content.split(/\r?\n/).some((line) => {
        if (/^\[[^\]]+\][ \t]*$/.test(line)) section = line;
        return (section === "[project]" || section === "[tool.poetry]")
          && new RegExp(`^[ \\t]*version[ \\t]*=[ \\t]*["']${escaped}["']`).test(line);
      });
    }
    case "setup.py":
      return new RegExp(`version[ \\t]*=[ \\t]*['"]${escaped}['"]`).test(content);
    default:
      return new RegExp(`(?:__version__[ \\t]*=[ \\t]*['"]${escaped}['"]|\\.version\\(['"]${escaped}['"]\\))`).test(content);
  }
}

/** @typedef {{ file: string, original: Buffer, updated: string, mode: number, temporary: string }} Plan */

/** @type {Plan[]} */
const plans = [];
for (const [index, file] of files.entries()) {
  if (!existsSync(file)) throw new Error(`Error: Version file not found: ${file}`);

  const update = updateFor(file);
  if (!update) throw new Error(`Error: Unsupported version file: ${file}`);

  const stat = statSync(file);
  if (!stat.isFile()) throw new Error(`Error: Version target is not a file: ${file}`);

  const original = readFileSync(file);
  const content = original.toString("utf8");
  const updated = update(content);
  if (updated === content) throw new Error(`Error: No version update applied to ${file}`);
  if (!hasRequestedVersion(file, updated)) throw new Error(`Error: Version postcondition failed for ${file}`);

  plans.push({
    file,
    original,
    updated,
    mode: stat.mode & 0o7777,
    temporary: `${file}.version-apply-${process.pid}-${index}.tmp`,
  });
}

/** @param {string} file */
function removeTemporary(file) {
  try {
    unlinkSync(file);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
  }
}

/** @type {Plan[]} */
const replaced = [];
try {
  for (const plan of plans) {
    writeFileSync(plan.temporary, plan.updated, { mode: plan.mode, flag: "wx" });
    chmodSync(plan.temporary, plan.mode);
    renameSync(plan.temporary, plan.file);
    replaced.push(plan);
  }
} catch (error) {
  const rollbackErrors = [];
  for (const plan of replaced.reverse()) {
    try {
      writeFileSync(plan.temporary, plan.original, { mode: plan.mode, flag: "wx" });
      chmodSync(plan.temporary, plan.mode);
      renameSync(plan.temporary, plan.file);
    } catch (rollbackError) {
      rollbackErrors.push(`${plan.file}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
  }
  for (const plan of plans) {
    try {
      removeTemporary(plan.temporary);
    } catch (cleanupError) {
      rollbackErrors.push(`${plan.temporary}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }
  }
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Error: Version update failed; restored replaced files. ${detail}${rollbackErrors.length ? ` Rollback errors: ${rollbackErrors.join("; ")}` : ""}`);
}

for (const plan of plans) console.log(`[updated] ${plan.file}`);
console.log(`Applied version ${newVersion} to ${plans.length} file(s).`);
} finally {
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  if (receivedSignal) {
    for (const child of activeChildren) child.kill(receivedSignal);
    await Promise.allSettled([...activeChildren].map((child) => child.exited));
    process.kill(process.pid, receivedSignal);
  }
}

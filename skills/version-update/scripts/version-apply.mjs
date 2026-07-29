#!/usr/bin/env bun
// @ts-check
/** Apply a semantic version to explicitly supplied or discovered version files. */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";

const SEMVER = "(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)";

const [newVersion, ...providedFiles] = process.argv.slice(2);
if (!newVersion) {
  console.error(`Usage: ${process.argv[1]} <new_version> [files...]`);
  process.exit(1);
}
if (!new RegExp(`^${SEMVER}$`).test(newVersion)) {
  console.error(`Error: Invalid version format: ${newVersion} (expected x.y.z)`);
  process.exit(1);
}

let files = providedFiles;
if (!files.length) {
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
    if (exitCode !== 0) {
      if (error) process.stderr.write(error);
      console.error(`Error: Version discovery failed with exit code ${exitCode}`);
      process.exit(exitCode || 1);
    }
    files = output.split(/\r?\n/).filter(Boolean);
  } finally {
    activeChildren.delete(child);
  }
}
if (!files.length) {
  console.error("Error: No version files found");
  process.exit(1);
}

/** @param {string} file @param {(content: string) => string} update */
function rewrite(file, update) {
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, update(readFileSync(file, "utf8")));
  renameSync(temporary, file);
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

let updated = 0;
for (const file of files) {
  if (!existsSync(file)) {
    console.error(`[skip] not found: ${file}`);
    continue;
  }
  switch (basename(file)) {
    case "package.json": rewrite(file, updatePackage); break;
    case "Cargo.toml": rewrite(file, updateCargo); break;
    case "pyproject.toml": rewrite(file, updatePyproject); break;
    case "setup.py": rewrite(file, (content) => content.replace(/(version[ \t]*=[ \t]*['"])[0-9]+\.[0-9]+\.[0-9]+(['"])/g, `$1${newVersion}$2`)); break;
    default:
      rewrite(file, (content) => {
        let result = content;
        if (file.endsWith(".py")) result = result.replace(/^([ \t]*__version__[ \t]*=[ \t]*['"])[0-9]+\.[0-9]+\.[0-9]+(['"].*)$/m, `$1${newVersion}$2`);
        return result.replace(/(\.version\(['"])[0-9]+\.[0-9]+\.[0-9]+(['"]\))/g, `$1${newVersion}$2`);
      });
  }
  console.log(`[updated] ${file}`);
  updated += 1;
}
console.log(`Applied version ${newVersion} to ${updated} file(s).`);

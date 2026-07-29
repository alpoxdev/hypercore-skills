#!/usr/bin/env bun
// @ts-check
/** Discover files that carry semantic versions below the current directory. */
import { readdirSync, readFileSync } from "node:fs";
import { extname, relative, sep } from "node:path";

const plain = process.argv[2] === "--plain";
const root = process.cwd();

const PRUNED_DIRECTORIES = new Set([".git", "node_modules", "target", ".venv", "venv", ".tox", "dist", "build"]);
const TEXT_OR_CODE_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".h", ".hpp", ".java", ".js", ".json", ".jsx", ".kt", ".kts",
  ".mjs", ".mts", ".php", ".py", ".rb", ".rs", ".scala", ".sh", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

/** @param {"directory" | "file"} kind @param {string} path @param {unknown} error @returns {never} */
function failRead(kind, path, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`Error: Failed to read ${kind}: ${path}: ${detail}`);
  process.exit(1);
}

/** @param {string} directory @param {string[]} files */
function collectFiles(directory, files) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    failRead("directory", directory, error);
  }
  for (const entry of entries) {
    const path = `${directory}${sep}${entry.name}`;
    if (entry.isDirectory()) {
      if (!PRUNED_DIRECTORIES.has(entry.name)) collectFiles(path, files);
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
}

/** @type {string[]} */
const files = [];
collectFiles(root, files);
/** @param {string} path */
const displayPath = (path) => relative(root, path);
/** @param {string} path @param {string[]} directories */
const hasDirectory = (path, directories) => path.split(sep).some((part) => directories.includes(part));
const node = files.filter((path) => !hasDirectory(displayPath(path), ["node_modules"]) && (path.endsWith(`${sep}package.json`) || displayPath(path) === "package.json")).map(displayPath);
const rust = files.filter((path) => !hasDirectory(displayPath(path), ["target"]) && (path.endsWith(`${sep}Cargo.toml`) || displayPath(path) === "Cargo.toml")).map(displayPath);
const python = files.filter((path) => !hasDirectory(displayPath(path), [".venv", "venv", ".tox"]) && /(?:^|\/)pyproject\.toml$|(?:^|\/)setup\.py$|__init__\.py$|_version\.py$/.test(displayPath(path))).map(displayPath);
const pattern = /\.version\(['"](?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)['"]\)|__version__\s*=\s*['"](?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)['"]/;
const code = files.filter((path) => {
  if (!TEXT_OR_CODE_EXTENSIONS.has(extname(path))) return false;
  try {
    return pattern.test(readFileSync(path, "utf8"));
  } catch (error) {
    failRead("file", path, error);
  }
  return false;
}).map(displayPath);
const all = [...new Set([...node, ...rust, ...python, ...code])].sort();

if (plain) {
  for (const path of all) console.log(path);
  process.exit(0);
}
/** @param {string} heading @param {string[]} paths */
function section(heading, paths) {
  console.log(heading);
  if (paths.length) {
    for (const path of paths) console.log(path);
  } else {
    console.log("(none found)");
  }
}
console.log("=== Searching version files ===");
console.log("");
section("=== Node version files ===", node);
console.log("");
section("=== Rust version files ===", rust);
console.log("");
section("=== Python version files ===", python);
console.log("");
section("=== Code files with inline version patterns ===", code);
console.log("");
section("=== All version files ===", all);

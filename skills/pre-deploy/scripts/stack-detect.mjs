#!/usr/bin/env bun
// @ts-check

import { existsSync } from "node:fs";

/** @param {string} path */
function exists(path) {
  return existsSync(path);
}

let found = false;

if (exists("package.json")) {
  console.log("node");
  found = true;
}
if (exists("Cargo.toml")) {
  console.log("rust");
  found = true;
}
if (["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "poetry.lock"].some(exists)) {
  console.log("python");
  found = true;
}

if (!found) {
  console.error("Error: No supported stack detected (node/rust/python)");
  process.exit(1);
}

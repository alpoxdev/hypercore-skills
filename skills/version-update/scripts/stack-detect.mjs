#!/usr/bin/env bun
// @ts-check
/** Detect supported project stacks in the current directory. */
import { existsSync } from "node:fs";

let found = false;
if (existsSync("package.json")) {
  console.log("node");
  found = true;
}
if (existsSync("Cargo.toml")) {
  console.log("rust");
  found = true;
}
if (["pyproject.toml", "requirements.txt", "setup.py", "Pipfile", "poetry.lock"].some(existsSync)) {
  console.log("python");
  found = true;
}
if (!found) {
  console.error("Error: No supported stack detected (node/rust/python)");
  process.exit(1);
}

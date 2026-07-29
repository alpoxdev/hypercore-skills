#!/usr/bin/env bun
// @ts-check

import { existsSync } from "node:fs";

if (existsSync("bun.lock") || existsSync("bun.lockb")) {
  console.log("bun");
} else if (existsSync("pnpm-lock.yaml")) {
  console.log("pnpm");
} else if (existsSync("yarn.lock")) {
  console.log("yarn");
} else if (existsSync("package-lock.json")) {
  console.log("npm");
} else if (existsSync("package.json")) {
  console.error("Warning: No lock file found, defaulting to npm");
  console.log("npm");
} else {
  console.error("Error: No package.json found");
  process.exit(1);
}

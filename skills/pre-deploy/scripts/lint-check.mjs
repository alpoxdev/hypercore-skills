#!/usr/bin/env bun
// @ts-check

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const stackDetect = join(scriptDir, "stack-detect.mjs");
const pmDetect = join(scriptDir, "pm-detect.mjs");

/** @param {string[]} argv */
async function run(argv) {
  const child = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const [exitCode, out, err] = await Promise.all([child.exited, stdout, stderr]);
  return { exitCode, out, err };
}

/** @param {string} tool */
function resolvePyTool(tool) {
  const local = join(".venv", "bin", tool);
  return existsSync(local) ? local : Bun.which(tool);
}

/** @returns {{ typecheck: boolean, lint: boolean } | null} */
function loadNodeScripts() {
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  } catch (error) {
    console.error(`Error: Unable to read or parse package.json: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) {
    console.error("Error: Invalid package.json: expected a JSON object");
    return null;
  }
  const scripts = packageJson.scripts;
  if (scripts !== undefined && (!scripts || typeof scripts !== "object" || Array.isArray(scripts))) {
    console.error("Error: Invalid package.json: expected scripts to be an object");
    return null;
  }
  if (scripts && Object.values(scripts).some((script) => typeof script !== "string")) {
    console.error("Error: Invalid package.json: expected script values to be strings");
    return null;
  }
  return { typecheck: Boolean(scripts?.typecheck), lint: Boolean(scripts?.lint) };
}

async function packageManager() {
  const result = await run(["bun", pmDetect]);
  if (result.exitCode !== 0) {
    process.stderr.write(result.err);
    return null;
  }
  return result.out.trim();
}

/** @param {string} pm @param {"typecheck" | "lint"} name */
function nodeScriptCommand(pm, name) {
  if (pm === "bun") return ["bun", "run", name];
  if (pm === "pnpm") return ["pnpm", "run", name];
  if (pm === "yarn") return ["yarn", name];
  if (pm === "npm") return ["npm", "run", name];
  return name === "typecheck" ? ["npx", "tsc", "--noEmit"] : ["npx", "eslint", "."];
}

async function runNodeChecks() {
  if (!existsSync(pmDetect)) {
    console.error("Error: pm-detect.mjs not found or not executable");
    return 1;
  }
  const pm = await packageManager();
  if (!pm) return 1;
  const scripts = loadNodeScripts();
  if (!scripts) return 1;
  console.log("\n=== [node] Running checks ===");
  const typecheck = existsSync("tsconfig.json")
    ? run(scripts.typecheck ? nodeScriptCommand(pm, "typecheck") : ["npx", "tsc", "--noEmit"])
    : null;
  const eslintConfig = ["eslint.config.js", "eslint.config.mjs", ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json"].some(existsSync);
  const lint = scripts.lint ? run(nodeScriptCommand(pm, "lint")) : eslintConfig ? run(["npx", "eslint", "."]) : null;
  if (!typecheck && !lint) {
    console.log("[node] No typecheck/lint configuration found. Skipping.");
    return 0;
  }
  let failed = false;
  console.log("\n--- [node] Typecheck ---");
  if (!typecheck) console.log("(skipped: no tsconfig.json)");
  else {
    const result = await typecheck;
    if (result.exitCode === 0) console.log("✓ Typecheck passed");
    else { process.stdout.write(result.out); process.stderr.write(result.err); failed = true; }
  }
  console.log("\n--- [node] Lint ---");
  if (!lint) console.log("(skipped: no lint configuration)");
  else {
    const result = await lint;
    if (result.exitCode === 0) console.log("✓ Lint passed");
    else { process.stdout.write(result.out); process.stderr.write(result.err); failed = true; }
  }
  return failed ? 1 : 0;
}

/** @param {string[]} argv */
async function runPhase(argv) {
  const result = await run(argv);
  process.stdout.write(result.out);
  process.stderr.write(result.err);
  return result.exitCode;
}

async function runRustChecks() {
  console.log("\n=== [rust] Running checks ===");
  if (!Bun.which("cargo")) { console.error("Error: cargo not found for Rust project"); return 1; }
  let failed = false;
  for (const [title, argv, passed] of [
    ["--- [rust] cargo fmt --check ---", ["cargo", "fmt", "--all", "--", "--check"], "✓ Format check passed"],
    ["--- [rust] cargo clippy ---", ["cargo", "clippy", "--all-targets", "--all-features", "--", "-D", "warnings"], "✓ Clippy passed"],
    ["--- [rust] cargo check ---", ["cargo", "check", "--all-targets", "--all-features"], "✓ Cargo check passed"],
  ]) {
    console.log(`${title}`);
    if (await runPhase(/** @type {string[]} */ (argv)) === 0) console.log(passed);
    else failed = true;
    if (title !== "--- [rust] cargo check ---") console.log();
  }
  return failed ? 1 : 0;
}

async function runPythonChecks() {
  console.log("\n=== [python] Running checks ===");
  const python = Bun.which("python3") ?? Bun.which("python");
  if (!python) { console.error("Error: python/python3 not found for Python project"); return 1; }
  let failed = false;
  const lint = resolvePyTool("ruff") ?? resolvePyTool("flake8");
  if (lint) {
    const ruff = lint.endsWith("ruff");
    console.log(ruff ? "--- [python] Ruff ---" : "--- [python] Flake8 ---");
    if (await runPhase(ruff ? [lint, "check", "."] : [lint, "."]) === 0) console.log(ruff ? "✓ Ruff passed" : "✓ Flake8 passed"); else failed = true;
  } else console.log("--- [python] Lint ---\n(skipped: ruff/flake8 not found)");
  console.log();
  const mypy = resolvePyTool("mypy");
  if (mypy) {
    console.log("--- [python] Mypy ---");
    if (await runPhase([mypy, "."]) === 0) console.log("✓ Mypy passed"); else failed = true;
  } else {
    console.log("--- [python] Type/Syntax ---");
    if (await runPhase([python, "-m", "compileall", "-q", "-x", "(^|/)(\\.git|\\.venv|node_modules|dist|build)(/|$)", "."]) === 0) console.log("✓ Syntax compile check passed (fallback)"); else failed = true;
  }
  return failed ? 1 : 0;
}

console.log("==========================================\n  Pre-Deploy Quality Checks\n==========================================");
if (!existsSync(stackDetect)) { console.error("Error: stack-detect.mjs not found or not executable"); process.exit(1); }
const stacks = await run(["bun", stackDetect]);
if (stacks.exitCode !== 0) { process.stderr.write(stacks.err); process.exit(stacks.exitCode); }
let totalExit = 0;
for (const stack of stacks.out.trim().split("\n").filter(Boolean)) {
  let exitCode = 0;
  if (stack === "node") exitCode = await runNodeChecks();
  else if (stack === "rust") exitCode = await runRustChecks();
  else if (stack === "python") exitCode = await runPythonChecks();
  else { console.error(`Warning: Unknown stack '${stack}'`); continue; }
  if (exitCode !== 0) totalExit = 1;
}
console.log("\n==========================================");
console.log(totalExit === 0 ? "  ✓ All quality checks passed" : "  ✗ Quality checks failed");
console.log("==========================================");
process.exit(totalExit);

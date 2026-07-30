#!/usr/bin/env bun
// @ts-check

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const stackDetect = join(scriptDir, "stack-detect.mjs");
const pmDetect = join(scriptDir, "pm-detect.mjs");
const activeChildren = new Set();
const activeDrains = new Map();
const ownedTempPaths = new Set();
let receivedSignal;
let stopNewWork = false;

/** @param {NodeJS.Signals} signal */
function forwardSignal(signal) {
  receivedSignal ??= signal;
  stopNewWork = true;
  for (const child of activeChildren) child.kill(signal);
}

process.on("SIGINT", forwardSignal);
process.on("SIGTERM", forwardSignal);

/** @param {string[]} cmd */
async function runSilent(cmd) {
  if (stopNewWork) return { exitCode: 1, out: "", err: "" };
  const child = Bun.spawn({ cmd, cwd: process.cwd(), env: { ...process.env }, stdout: "pipe", stderr: "pipe" });
  activeChildren.add(child);
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  activeDrains.set(child, Promise.all([stdout, stderr]));
  try {
    const [exitCode, out, err] = await Promise.all([child.exited, stdout, stderr]);
    return { exitCode, out, err };
  } finally {
    activeChildren.delete(child);
    activeDrains.delete(child);
  }
}

/** @param {string[]} cmd */
async function run(cmd) {
  const result = await runSilent(cmd);
  process.stdout.write(result.out);
  process.stderr.write(result.err);
  return result.exitCode;
}

/** @param {string} name @returns {boolean | null} */
function hasPackageScript(name) {
  let packageJson;
  try { packageJson = JSON.parse(readFileSync("package.json", "utf8")); }
  catch (error) { console.error(`Error: Unable to read or parse package.json: ${error instanceof Error ? error.message : String(error)}`); return null; }
  if (!packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) { console.error("Error: Invalid package.json: expected a JSON object"); return null; }
  const scripts = packageJson.scripts;
  if (scripts !== undefined && (!scripts || typeof scripts !== "object" || Array.isArray(scripts))) { console.error("Error: Invalid package.json: expected scripts to be an object"); return null; }
  if (scripts && Object.values(scripts).some((script) => typeof script !== "string")) { console.error("Error: Invalid package.json: expected script values to be strings"); return null; }
  return Boolean(scripts?.[name]);
}

function resolvePython() { return Bun.which("python3") ?? Bun.which("python"); }
/** @param {string} stderr */
function isBuildModuleMissing(stderr) { return /^(?:.+: )?No module named build\r?\n?$/.test(stderr); }

async function packageManager() {
  const result = await runSilent(["bun", pmDetect]);
  if (result.exitCode !== 0) process.stderr.write(result.err);
  return result.exitCode === 0 ? result.out.trim() : null;
}

/** @param {string} pm @returns {string[] | null} */
function buildCommand(pm) {
  if (pm === "bun") return ["bun", "run", "build"];
  if (pm === "pnpm") return ["pnpm", "run", "build"];
  if (pm === "yarn") return ["yarn", "build"];
  if (pm === "npm") return ["npm", "run", "build"];
  return null;
}

/** @returns {Promise<number>} */
async function main() {
  console.log("==========================================\n  Pre-Deploy Build Phase\n==========================================");
  if (!existsSync(stackDetect)) { console.error("Error: stack-detect.mjs not found or not executable"); return 1; }
  const detect = await runSilent(["bun", stackDetect]);
  if (detect.exitCode !== 0) { process.stderr.write(detect.err); return detect.exitCode; }
  for (const stack of detect.out.trim().split("\n").filter(Boolean)) {
    if (stopNewWork) return 1;
    if (stack === "node") {
      console.log("\n=== [node] Build ===");
      const pm = await packageManager(); if (!pm) return 1;
      const hasBuildScript = hasPackageScript("build"); if (hasBuildScript === null) return 1;
      if (!hasBuildScript) console.log("[node] No build script found in package.json. Skipping.");
      else { const command = buildCommand(pm); if (!command) { console.error(`Error: Unknown package manager: ${pm}`); return 1; } if (await run(command) !== 0) return 1; console.log("✓ Node build completed"); }
    } else if (stack === "rust") {
      console.log("\n=== [rust] Build ==="); if (!Bun.which("cargo")) { console.error("Error: cargo not found for Rust project"); return 1; }
      if (await run(["cargo", "build", "--release"]) !== 0) return 1; console.log("✓ Rust build completed");
    } else if (stack === "python") {
      console.log("\n=== [python] Build ==="); const python = resolvePython(); if (!python) { console.error("Error: python/python3 not found for Python project"); return 1; }
      if (Bun.which("poetry") && existsSync("poetry.lock")) { if (await run(["poetry", "build"]) !== 0) return 1; console.log("✓ Python build completed (poetry)"); }
      else if (existsSync("pyproject.toml") || existsSync("setup.py")) {
        const probe = await runSilent([python, "-m", "build", "--version"]);
        if (probe.exitCode === 0) { if (await run([python, "-m", "build"]) !== 0) return 1; console.log("✓ Python build completed (python -m build)"); }
        else if (isBuildModuleMissing(probe.err)) { console.log("[python] build module not found. Running compile fallback."); if (await run([python, "-m", "compileall", "-q", "-x", "(^|/)(\\.git|\\.venv|node_modules|dist|build)(/|$)", "."]) !== 0) return 1; console.log("✓ Python compile fallback completed"); }
        else { process.stdout.write(probe.out); process.stderr.write(probe.err); return probe.exitCode; }
      } else { console.log("[python] Packaging files not found. Running compile fallback."); if (await run([python, "-m", "compileall", "-q", "-x", "(^|/)(\\.git|\\.venv|node_modules|dist|build)(/|$)", "."]) !== 0) return 1; console.log("✓ Python compile fallback completed"); }
    } else console.error(`Warning: Unknown stack '${stack}'`);
  }
  console.log("\n==========================================\n  ✓ Build phase completed\n==========================================");
  return 0;
}

try { process.exitCode = await main(); }
finally {
  if (receivedSignal) for (const child of activeChildren) child.kill(receivedSignal);
  await Promise.allSettled([...activeChildren].map((child) => Promise.all([child.exited, activeDrains.get(child)])));
  for (const path of ownedTempPaths) rmSync(path, { recursive: true, force: true });
  process.off("SIGINT", forwardSignal); process.off("SIGTERM", forwardSignal);
  if (receivedSignal) process.kill(process.pid, receivedSignal);
}

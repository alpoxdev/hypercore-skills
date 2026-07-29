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
  process.stdout.write(out);
  process.stderr.write(err);
  return exitCode;
}
/** @param {string[]} argv */
async function runSilent(argv) {
  const child = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const [exitCode, out, err] = await Promise.all([child.exited, stdout, stderr]);
  return { exitCode, out, err };
}


/** @param {string} name @returns {boolean | null} */
function hasPackageScript(name) {
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
  return Boolean(scripts?.[name]);
}

function resolvePython() {
  return Bun.which("python3") ?? Bun.which("python");
}
/** @param {string} stderr */
function isBuildModuleMissing(stderr) {
  return /^(?:.+: )?No module named build\r?\n?$/.test(stderr);
}

async function packageManager() {
  const child = Bun.spawn(["bun", pmDetect], { stdout: "pipe", stderr: "pipe" });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const [exitCode, out, err] = await Promise.all([child.exited, stdout, stderr]);
  if (exitCode !== 0) process.stderr.write(err);
  return exitCode === 0 ? out.trim() : null;
}

/** @param {string} pm */
function buildCommand(pm) {
  if (pm === "bun") return ["bun", "run", "build"];
  if (pm === "pnpm") return ["pnpm", "run", "build"];
  if (pm === "yarn") return ["yarn", "build"];
  if (pm === "npm") return ["npm", "run", "build"];
  return null;
}

console.log("==========================================\n  Pre-Deploy Build Phase\n==========================================");
if (!existsSync(stackDetect)) { console.error("Error: stack-detect.mjs not found or not executable"); process.exit(1); }
const detect = Bun.spawn(["bun", stackDetect], { stdout: "pipe", stderr: "pipe" });
const detectStdout = new Response(detect.stdout).text();
const detectStderr = new Response(detect.stderr).text();
const [detectCode, stacksOut, stacksErr] = await Promise.all([detect.exited, detectStdout, detectStderr]);
if (detectCode !== 0) { process.stderr.write(stacksErr); process.exit(detectCode); }

for (const stack of stacksOut.trim().split("\n").filter(Boolean)) {
  if (stack === "node") {
    console.log("\n=== [node] Build ===");
    const pm = await packageManager();
    if (!pm) process.exit(1);
    const hasBuildScript = hasPackageScript("build");
    if (hasBuildScript === null) process.exit(1);
    if (!hasBuildScript) console.log("[node] No build script found in package.json. Skipping.");
    else {
      const command = buildCommand(pm);
      if (!command) { console.error(`Error: Unknown package manager: ${pm}`); process.exit(1); }
      if (await run(command) !== 0) process.exit(1);
      console.log("✓ Node build completed");
    }
  } else if (stack === "rust") {
    console.log("\n=== [rust] Build ===");
    if (!Bun.which("cargo")) { console.error("Error: cargo not found for Rust project"); process.exit(1); }
    if (await run(["cargo", "build", "--release"]) !== 0) process.exit(1);
    console.log("✓ Rust build completed");
  } else if (stack === "python") {
    console.log("\n=== [python] Build ===");
    const python = resolvePython();
    if (!python) { console.error("Error: python/python3 not found for Python project"); process.exit(1); }
    if (Bun.which("poetry") && existsSync("poetry.lock")) {
      if (await run(["poetry", "build"]) !== 0) process.exit(1);
      console.log("✓ Python build completed (poetry)");
    } else if (existsSync("pyproject.toml") || existsSync("setup.py")) {
      const probe = await runSilent([python, "-m", "build", "--version"]);
      if (probe.exitCode === 0) {
        if (await run([python, "-m", "build"]) !== 0) process.exit(1);
        console.log("✓ Python build completed (python -m build)");
      } else if (isBuildModuleMissing(probe.err)) {
        console.log("[python] build module not found. Running compile fallback.");
        if (await run([python, "-m", "compileall", "-q", "-x", "(^|/)(\\.git|\\.venv|node_modules|dist|build)(/|$)", "."]) !== 0) process.exit(1);
        console.log("✓ Python compile fallback completed");
      } else {
        process.stdout.write(probe.out);
        process.stderr.write(probe.err);
        process.exit(probe.exitCode);
      }
    } else {
      console.log("[python] Packaging files not found. Running compile fallback.");
      if (await run([python, "-m", "compileall", "-q", "-x", "(^|/)(\\.git|\\.venv|node_modules|dist|build)(/|$)", "."]) !== 0) process.exit(1);
      console.log("✓ Python compile fallback completed");
    }
  } else console.error(`Warning: Unknown stack '${stack}'`);
}
console.log("\n==========================================\n  ✓ Build phase completed\n==========================================");

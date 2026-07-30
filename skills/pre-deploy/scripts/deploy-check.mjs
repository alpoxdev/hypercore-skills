#!/usr/bin/env bun
// @ts-check

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const lintCheck = join(scriptDir, "lint-check.mjs");
const buildRun = join(scriptDir, "build-run.mjs");
const stackDetect = join(scriptDir, "stack-detect.mjs");
const activeChildren = new Set();
const activeDrains = new Map();
const ownedTempPaths = new Set();
let receivedSignal;
let stopNewWork = false;

/** @param {NodeJS.Signals} signal */
function forwardSignal(signal) { receivedSignal ??= signal; stopNewWork = true; for (const child of activeChildren) child.kill(signal); }
process.on("SIGINT", forwardSignal); process.on("SIGTERM", forwardSignal);

/** @param {string[]} cmd @returns {{ child: import("bun").Subprocess, exitCode: Promise<number>, output: Promise<string> } | null} */
function spawnDrained(cmd) {
  if (stopNewWork) return null;
  const child = Bun.spawn({ cmd, cwd: process.cwd(), env: { ...process.env }, stdout: "pipe", stderr: "pipe" });
  activeChildren.add(child);
  /** @type {string[]} */
  const output = [];
  /** @param {ReadableStream<Uint8Array>} stream */
  async function drain(stream) {
    const reader = stream.getReader(); const decoder = new TextDecoder();
    try { while (true) { const { done, value } = await reader.read(); if (done) break; const text = decoder.decode(value, { stream: true }); if (text) output.push(text); } const text = decoder.decode(); if (text) output.push(text); }
    finally { reader.releaseLock(); }
  }
  const outputDone = Promise.all([drain(child.stdout), drain(child.stderr)]).then(() => output.join(""));
  activeDrains.set(child, outputDone);
  const exitCode = child.exited;
  return { child, exitCode, output: outputDone };
}

/** @param {{ child: import("bun").Subprocess, exitCode: Promise<number>, output: Promise<string> }} child */
async function collectChild(child) {
  try { return await Promise.all([child.exitCode, child.output]); }
  finally { activeChildren.delete(child.child); activeDrains.delete(child.child); }
}
/** @param {{ child: import("bun").Subprocess, exitCode: Promise<number>, output: Promise<string> }} child */
async function printChild(child) { const [exitCode, output] = await collectChild(child); process.stdout.write(output); return exitCode; }

/** @returns {Promise<number>} */
async function main() {
  let mode = process.env.PRE_DEPLOY_MODE ?? "parallel";
  const argument = process.argv[2] ?? "";
  if (argument === "--sequential") mode = "sequential";
  else if (argument === "--parallel" || argument === "") { /* environment-selected mode remains in effect */ }
  else if (argument === "-h" || argument === "--help") { console.log("Usage: deploy-check.mjs [--parallel|--sequential]"); console.log("Environment: PRE_DEPLOY_MODE=parallel|sequential (default: parallel)"); return 0; }
  else { console.error(`Error: unknown argument: ${argument}`); return 2; }
  if (mode !== "parallel" && mode !== "sequential") { console.error("Error: PRE_DEPLOY_MODE must be parallel or sequential"); return 2; }
  console.log("==========================================\n  Pre-Deploy Verification\n==========================================");
  for (const [path, name] of [[lintCheck, "lint-check.mjs"], [buildRun, "build-run.mjs"], [stackDetect, "stack-detect.mjs"]]) if (!existsSync(path)) { console.error(`Error: ${name} not found or not executable`); return 1; }
  if (mode === "sequential") {
    console.log("\n[1/2] Running quality checks..."); const lint = spawnDrained(["bun", lintCheck]); if (!lint || await printChild(lint) !== 0) return 1;
    if (stopNewWork) return 1;
    console.log("\n[2/2] Running build phase..."); const build = spawnDrained(["bun", buildRun]); if (!build || await printChild(build) !== 0) return 1;
  } else {
    console.log("\n[1+2/2] Running quality checks and build concurrently...");
    const lint = spawnDrained(["bun", lintCheck]); const build = spawnDrained(["bun", buildRun]);
    if (!lint || !build) return 1;
    const [[lintCode, lintOutput], [buildCode, buildOutput]] = await Promise.all([collectChild(lint), collectChild(build)]);
    console.log("\n--- Quality checks ---"); process.stdout.write(lintOutput);
    console.log("\n--- Build phase ---"); process.stdout.write(buildOutput);
    if (lintCode !== 0 || buildCode !== 0) return 1;
  }
  console.log("\n==========================================\n  ✓ All checks passed - Ready to deploy\n==========================================");
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

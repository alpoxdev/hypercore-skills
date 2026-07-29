#!/usr/bin/env bun
// @ts-check

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const lintCheck = join(scriptDir, "lint-check.mjs");
const buildRun = join(scriptDir, "build-run.mjs");
const stackDetect = join(scriptDir, "stack-detect.mjs");

/** @param {string[]} argv */
function spawnDrained(argv) {
  const child = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
  /** @type {string[]} */
  const output = [];

  /** @param {ReadableStream<Uint8Array>} stream */
  async function drain(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text) output.push(text);
      }
      const text = decoder.decode();
      if (text) output.push(text);
    } finally {
      reader.releaseLock();
    }
  }

  return {
    process: child,
    exitCode: child.exited,
    output: Promise.all([drain(child.stdout), drain(child.stderr)]).then(() => output.join("")),
  };
}

/** @param {{ process: ReturnType<typeof Bun.spawn>, exitCode: Promise<number>, output: Promise<string> }} child */
async function printChild(child) {
  const [exitCode, output] = await Promise.all([child.exitCode, child.output]);
  process.stdout.write(output);
  return exitCode;
}

/** @param {{ process: ReturnType<typeof Bun.spawn>, exitCode: Promise<number>, output: Promise<string> }} child */
async function collectChild(child) {
  return Promise.all([child.exitCode, child.output]);
}


let mode = process.env.PRE_DEPLOY_MODE ?? "parallel";
const argument = process.argv[2] ?? "";
if (argument === "--sequential") mode = "sequential";
else if (argument === "--parallel" || argument === "") {
  // The environment-selected mode remains in effect.
} else if (argument === "-h" || argument === "--help") {
  console.log("Usage: deploy-check.mjs [--parallel|--sequential]");
  console.log("Environment: PRE_DEPLOY_MODE=parallel|sequential (default: parallel)");
  process.exit(0);
} else {
  console.error(`Error: unknown argument: ${argument}`);
  process.exit(2);
}
if (mode !== "parallel" && mode !== "sequential") {
  console.error("Error: PRE_DEPLOY_MODE must be parallel or sequential");
  process.exit(2);
}

console.log("==========================================\n  Pre-Deploy Verification\n==========================================");
for (const [path, name] of [[lintCheck, "lint-check.mjs"], [buildRun, "build-run.mjs"], [stackDetect, "stack-detect.mjs"]]) {
  if (!existsSync(path)) { console.error(`Error: ${name} not found or not executable`); process.exit(1); }
}

if (mode === "sequential") {
  console.log("\n[1/2] Running quality checks...");
  if (await printChild(spawnDrained(["bun", lintCheck])) !== 0) process.exit(1);
  console.log("\n[2/2] Running build phase...");
  if (await printChild(spawnDrained(["bun", buildRun])) !== 0) process.exit(1);
} else {
  console.log("\n[1+2/2] Running quality checks and build concurrently...");
  const lint = spawnDrained(["bun", lintCheck]);
  const build = spawnDrained(["bun", buildRun]);
  /** @param {NodeJS.Signals} signal */
  const forwardSignal = (signal) => {
    lint.process.kill(signal);
    build.process.kill(signal);
  };
  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);
  let lintCode;
  let lintOutput;
  let buildCode;
  let buildOutput;
  try {
    [[lintCode, lintOutput], [buildCode, buildOutput]] = await Promise.all([collectChild(lint), collectChild(build)]);
  } finally {
    process.removeListener("SIGINT", forwardSignal);
    process.removeListener("SIGTERM", forwardSignal);
  }
  console.log("\n--- Quality checks ---");
  process.stdout.write(lintOutput);
  console.log("\n--- Build phase ---");
  process.stdout.write(buildOutput);
  if (lintCode !== 0 || buildCode !== 0) process.exit(1);
}
console.log("\n==========================================\n  ✓ All checks passed - Ready to deploy\n==========================================");

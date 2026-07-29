#!/usr/bin/env bun
// @ts-check

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @typedef {{ exitCode: number, stdout: string, stderr: string }} GitResult
 * @returns {{ git: (args: string[], cwd: string) => Promise<GitResult>, settle: <T>(main: () => Promise<T>) => Promise<T> }}
 */
function createGitRunner() {
  const children = new Set();
  /** @type {NodeJS.Signals | null} */
  let receivedSignal = null;
  /** @param {NodeJS.Signals} signal */
  const forward = (signal) => { receivedSignal ??= signal; for (const child of children) child.kill(signal); };
  process.on("SIGINT", forward); process.on("SIGTERM", forward);
  /** @param {string[]} args @param {string} cwd @returns {Promise<GitResult>} */
  async function git(args, cwd) {
    const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" }); children.add(child);
    try { const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]); return { exitCode, stdout, stderr }; }
    finally { children.delete(child); }
  }
  /** @template T @param {() => Promise<T>} main @returns {Promise<T>} */
  async function settle(main) { try { return await main(); } finally { process.off("SIGINT", forward); process.off("SIGTERM", forward); if (receivedSignal) process.kill(process.pid, receivedSignal); } }
  return { git, settle };
}
/** @param {string[]} args @param {string} cwd @returns {Promise<GitResult | null>} */
async function requiredGit(args, cwd) {
  const result = await runner.git(args, cwd);
  if (result.exitCode === 0) return result;
  if (result.stderr) process.stderr.write(result.stderr);
  else console.error(`Error: git ${args.join(" ")} failed with exit code ${result.exitCode}`);
  return null;
}
/** @param {string[]} args @returns {Promise<number>} */
async function main(args) {
  if (args.length > 1 || args[0]?.startsWith("-")) { console.error(`Usage: ${process.argv[1]} [repo]`); return 1; }
  const repo = args[0] ?? ".";
  if (!existsSync(repo) || !statSync(repo).isDirectory()) { console.error(`Error: Directory not found: ${repo}`); return 1; }
  const cwd = resolve(repo);
  if (!await requiredGit(["rev-parse", "--git-dir"], cwd)) return 1;
  const [rootResult, statusResult, stagedResult, unstagedResult] = await Promise.all([
    requiredGit(["rev-parse", "--show-toplevel"], cwd), requiredGit(["status", "--short", "--no-renames"], cwd), requiredGit(["diff", "--staged", "--stat"], cwd), requiredGit(["diff", "--stat"], cwd),
  ]);
  if (!rootResult || !statusResult || !stagedResult || !unstagedResult) return 1;
  const root = rootResult.stdout.trimEnd(); const statusShort = statusResult.stdout.trimEnd(); const stagedStat = stagedResult.stdout.trimEnd(); const unstagedStat = unstagedResult.stdout.trimEnd();
  const untrackedFiles = statusShort.split("\n").filter((line) => line.startsWith("?? ")).map((line) => line.slice(3));
  console.log(`repo|${root}`); console.log("status|begin"); if (statusShort) console.log(statusShort); console.log("status|end");
  console.log("staged|begin"); console.log(stagedStat || "(no staged changes)"); console.log("staged|end"); console.log("unstaged|begin");
  if (!unstagedStat && !untrackedFiles.length) console.log("(no unstaged changes)"); else { if (unstagedStat) console.log(unstagedStat); for (const file of untrackedFiles) if (file) console.log(`untracked: ${file}`); }
  console.log("unstaged|end"); return 0;
}
const runner = createGitRunner();
process.exitCode = await runner.settle(() => main(process.argv.slice(2)));

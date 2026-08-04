#!/usr/bin/env bun
// @ts-check

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @typedef {{ exitCode: number, stdout: string, stderr: string }} GitResult
 * @returns {{ git: (args: string[], cwd: string, output?: boolean) => Promise<GitResult>, settle: <T>(main: () => Promise<T>) => Promise<T> }}
 */
function createGitRunner() {
  const children = new Set();
  /** @type {NodeJS.Signals | null} */
  let receivedSignal = null;
  /** @param {NodeJS.Signals} signal */
  const forward = (signal) => { receivedSignal ??= signal; for (const child of children) child.kill(signal); };
  process.on("SIGINT", forward); process.on("SIGTERM", forward);
  /** @param {string[]} args @param {string} cwd @param {boolean} [output] @returns {Promise<GitResult>} */
  async function git(args, cwd, output = false) {
    if (receivedSignal) return { exitCode: 130, stdout: "", stderr: "Interrupted by signal" };
    const child = Bun.spawn({ cmd: ["git", ...args], cwd, env: process.env, stdout: "pipe", stderr: "pipe" });
    children.add(child);
    try {
      const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      if (output) { if (stdout) process.stdout.write(stdout); if (stderr) process.stderr.write(stderr); }
      return { exitCode, stdout, stderr };
    } finally { children.delete(child); }
  }
  /** @template T @param {() => Promise<T>} main @returns {Promise<T>} */
  async function settle(main) {
    try { return await main(); }
    finally {
      process.off("SIGINT", forward); process.off("SIGTERM", forward);
      if (receivedSignal) process.kill(process.pid, receivedSignal);
    }
  }
  return { git, settle };
}
/** @param {string[]} args @param {GitResult} result @returns {Error} */
function gitError(args, result) { return new Error(result.stderr || `git ${args.join(" ")} failed with exit code ${result.exitCode}`); }
/** @param {string[]} args @param {string} cwd @returns {Promise<GitResult>} */
async function requiredGit(args, cwd) { const result = await runner.git(args, cwd); if (result.exitCode !== 0) throw gitError(args, result); return result; }
/** @param {string[]} args @param {string} cwd @returns {Promise<boolean>} */
async function diffHasChanges(args, cwd) { const result = await runner.git(args, cwd); if (result.exitCode === 0) return false; if (result.exitCode === 1) return true; throw gitError(args, result); }
/** @param {GitResult} result @returns {boolean} */
function isNotGitRepository(result) { return result.exitCode !== 0 && /not a git repository/i.test(result.stderr); }

/** @param {string} stagedFile @param {string[]} targets @returns {boolean} */
function matchesRequestedTarget(stagedFile, targets) { return targets.some((target) => stagedFile === target || stagedFile.startsWith(`${target}/`)); }
/** @param {string[]} args @returns {Promise<number>} */
async function main(args) {
  let repo = ".";
  if (args[0] === "--repo") { if (!args[1]) return usage(); repo = args[1]; args = args.slice(2); }
  if (args[0]?.startsWith("--")) return usage();
  const message = args[0];
  if (message === undefined || message === "") return usage();
  if (!/\S/.test(message)) { console.error("Error: Commit message cannot be empty"); return 1; }
  if (!existsSync(repo) || !statSync(repo).isDirectory()) { console.error(`Error: Directory not found: ${repo}`); return 1; }
  const cwd = resolve(repo); const { git } = runner;
  const repoResult = await git(["rev-parse", "--git-dir"], cwd);
  if (repoResult.exitCode !== 0) {
    if (isNotGitRepository(repoResult)) { console.error(`Error: Not a git repository: ${repo}`); return 1; }
    console.error(`Error: ${gitError(["rev-parse", "--git-dir"], repoResult).message}`); return 1;
  }
  const requested = args.slice(1);
  if (requested.some((file) => file.startsWith("--"))) return usage();
  try {
    if (requested.length > 0) {
      const before = await requiredGit(["diff", "--cached", "--name-only"], cwd);
      const extra = before.stdout.trimEnd().split("\n").filter(Boolean).filter((file) => !matchesRequestedTarget(file, requested));
      if (extra.length) { console.error("Error: Additional staged changes exist outside the requested files:"); for (const file of extra) console.error(`  ${file}`); console.error("Tip: Unstage unrelated files or commit them separately before retrying."); return 1; }
      // Preflight before staging prevents a failed targeted request from altering the index.
      const changed = await diffHasChanges(["diff", "--quiet", "--", ...requested], cwd) ||
        await diffHasChanges(["diff", "--cached", "--quiet", "--", ...requested], cwd);
      const untracked = (await requiredGit(["ls-files", "--others", "--exclude-standard", "--", ...requested], cwd)).stdout.trimEnd();
      if (!changed && !untracked) { console.error("Error: No changes found in the requested files"); return 1; }
      if ((await git(["add", "--", ...requested], cwd, true)).exitCode !== 0) return 1;
      const after = await requiredGit(["diff", "--cached", "--name-only"], cwd);
      const appeared = after.stdout.trimEnd().split("\n").filter(Boolean).filter((file) => !matchesRequestedTarget(file, requested));
      if (appeared.length) { console.error("Error: Additional staged changes appeared while staging:"); for (const file of appeared) console.error(`  ${file}`); return 1; }
    }
    if (!await diffHasChanges(["diff", "--cached", "--quiet"], cwd)) { console.error("Error: No staged changes to commit"); return 1; }
    if ((await git(["commit", "-m", message], cwd, true)).exitCode !== 0) return 1;
    const root = (await requiredGit(["rev-parse", "--show-toplevel"], cwd)).stdout.trimEnd(); console.log(`Committed successfully in ${root}`); return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`); return 1;
  }
}
/** @returns {number} */
function usage() { console.error(`Usage: ${process.argv[1]} [--repo path] "commit message" [files...]`); return 1; }
const runner = createGitRunner();
process.exitCode = await runner.settle(() => main(process.argv.slice(2)));

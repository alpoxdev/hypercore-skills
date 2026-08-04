#!/usr/bin/env bun
// @ts-check

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PRUNED_DIRECTORIES = new Set(["node_modules", "dist", "build", ".next", ".turbo", ".cache", "coverage", "vendor"]);
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
  async function git(args, cwd) { if (receivedSignal) return { exitCode: 130, stdout: "", stderr: "Interrupted by signal" }; const child = Bun.spawn({ cmd: ["git", ...args], cwd, env: process.env, stdout: "pipe", stderr: "pipe" }); children.add(child); try { const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]); return { exitCode, stdout, stderr }; } finally { children.delete(child); } }
  /** @template T @param {() => Promise<T>} main @returns {Promise<T>} */
  async function settle(main) { try { return await main(); } finally { process.off("SIGINT", forward); process.off("SIGTERM", forward); if (receivedSignal) process.kill(process.pid, receivedSignal); } }
  return { git, settle };
}
/** @param {string[]} args @param {GitResult} result @returns {Error} */
function gitError(args, result) { return new Error(result.stderr || `git ${args.join(" ")} failed with exit code ${result.exitCode}`); }
/** @param {GitResult} result @returns {boolean} */
function isNotGitRepository(result) { return result.exitCode !== 0 && /not a git repository/i.test(result.stderr); }
/** @param {string} path @returns {Promise<string | null>} */
async function repoRoot(path) { const args = ["rev-parse", "--show-toplevel"]; const result = await runner.git(args, path); if (result.exitCode === 0) return result.stdout.trimEnd(); if (isNotGitRepository(result)) return null; throw gitError(args, result); }
/** @param {string} directory @param {string[]} gitPaths @returns {void} */
function collectGitPaths(directory, gitPaths) { for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = `${directory}/${entry.name}`; if (entry.name === ".git" && (entry.isDirectory() || entry.isFile())) { gitPaths.push(path); continue; } if (entry.isDirectory() && !PRUNED_DIRECTORIES.has(entry.name)) collectGitPaths(path, gitPaths); } }
/** @param {string | null} root @returns {root is string} */
function isRepoRoot(root) { return root !== null; }
/** @param {string[]} args @returns {Promise<number>} */
async function main(args) {
  if (args.length > 1 || args[0]?.startsWith("-")) { console.error(`Usage: ${process.argv[1]} [start_dir]`); return 1; }
  const startDir = args[0] ?? ".";
  if (!existsSync(startDir) || !statSync(startDir).isDirectory()) { console.error(`Error: Directory not found: ${startDir}`); return 1; }
  const cwd = resolve(startDir);
  try {
    const current = await repoRoot(cwd);
    if (current) { console.log(`current|${current}`); return 0; }
    /** @type {string[]} */
    const gitPaths = []; collectGitPaths(cwd, gitPaths);
    const roots = [...new Set((await Promise.all(gitPaths.sort().map((path) => repoRoot(dirname(path))))).filter(isRepoRoot))].sort();
    if (!roots.length) { console.error(`Error: No git repository found from ${startDir}`); return 1; }
    for (const root of roots) console.log(`descendant|${root}`); return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`); return 1;
  }
}
const runner = createGitRunner();
process.exitCode = await runner.settle(() => main(process.argv.slice(2)));

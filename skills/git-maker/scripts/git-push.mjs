#!/usr/bin/env bun
// @ts-check

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PRUNED_DIRECTORIES = new Set(["node_modules", "dist", "build", ".next", ".turbo", ".cache", "coverage", "vendor"]);
/**
 * @typedef {{ exitCode: number, stdout: string, stderr: string }} GitResult
 * @returns {{ git: (args: string[], cwd: string, env?: Record<string, string | undefined>, output?: boolean) => Promise<GitResult>, settle: <T>(main: () => Promise<T>) => Promise<T> }}
 */
function createGitRunner() {
  const children = new Set();
  /** @type {NodeJS.Signals | null} */
  let receivedSignal = null;
  /** @param {NodeJS.Signals} signal */
  const forward = (signal) => { receivedSignal ??= signal; for (const child of children) child.kill(signal); };
  process.on("SIGINT", forward); process.on("SIGTERM", forward);
  /** @param {string[]} args @param {string} cwd @param {Record<string, string | undefined>} [env] @param {boolean} [output] @returns {Promise<GitResult>} */
  async function git(args, cwd, env, output = false) { if (receivedSignal) return { exitCode: 130, stdout: "", stderr: "Interrupted by signal" }; const child = Bun.spawn({ cmd: ["git", ...args], cwd, env: env ? { ...process.env, ...env } : process.env, stdout: "pipe", stderr: "pipe" }); children.add(child); try { const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]); if (output) { if (stdout) process.stdout.write(stdout); if (stderr) process.stderr.write(stderr); } return { exitCode, stdout, stderr }; } finally { children.delete(child); } }
  /** @template T @param {() => Promise<T>} main @returns {Promise<T>} */
  async function settle(main) { try { return await main(); } finally { process.off("SIGINT", forward); process.off("SIGTERM", forward); if (receivedSignal) process.kill(process.pid, receivedSignal); } }
  return { git, settle };
}
/** @param {string[]} args @param {GitResult} result @returns {Error} */
function gitError(args, result) { return new Error(result.stderr || `git ${args.join(" ")} failed with exit code ${result.exitCode}`); }
/** @param {string[]} args @param {string} cwd @returns {Promise<GitResult>} */
async function requiredGit(args, cwd) { const result = await runner.git(args, cwd); if (result.exitCode !== 0) throw gitError(args, result); return result; }
/** @param {GitResult} result @returns {boolean} */
function isNotGitRepository(result) { return result.exitCode !== 0 && /not a git repository/i.test(result.stderr); }
/** @param {string} path @returns {Promise<string | null>} */
async function repoRoot(path) { const args = ["rev-parse", "--show-toplevel"]; const result = await runner.git(args, path); if (result.exitCode === 0) return result.stdout.trimEnd(); if (isNotGitRepository(result)) return null; throw gitError(args, result); }
/** @param {string} directory @param {string[]} paths @returns {void} */
function collectGitPaths(directory, paths) { for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = `${directory}/${entry.name}`; if (entry.name === ".git" && (entry.isDirectory() || entry.isFile())) { paths.push(path); continue; } if (entry.isDirectory() && !PRUNED_DIRECTORIES.has(entry.name)) collectGitPaths(path, paths); } }
/** @param {string} startDir @returns {Promise<string[]>} */
async function discoverRepos(startDir) {
  if (!existsSync(startDir) || !statSync(startDir).isDirectory()) return [];
  const cwd = resolve(startDir);
  const current = await repoRoot(cwd);
  if (current) return [current];
  /** @type {string[]} */
  const paths = [];
  collectGitPaths(cwd, paths);
  return [...new Set((await Promise.all(paths.sort().map((path) => repoRoot(dirname(path))))).filter(isRepoRoot))].sort();
}
/** @param {string | null} root @returns {root is string} */
function isRepoRoot(root) { return root !== null; }
/** @param {string} repo @param {boolean} force @returns {Promise<number>} */
async function pushOneRepo(repo, force) {
  try {
    const root = await repoRoot(repo); if (!root) { console.error(`[${repo}] Failed: not a git work tree`); return 1; }
    const branch = (await requiredGit(["branch", "--show-current"], root)).stdout.trimEnd(); if (!branch) { console.error(`[${root}] Skipped: detached HEAD`); return 2; }
    if (force && (branch === "main" || branch === "master")) { console.error(`[${root}] Skipped: cannot force push to protected branch ${branch}`); return 2; }
    const upstream = (await requiredGit(["for-each-ref", "--format=%(upstream:short)", `refs/heads/${branch}`], root)).stdout.trimEnd();
    const env = { GIT_TERMINAL_PROMPT: "0" };
    if (upstream) {
      const ahead = (await requiredGit(["rev-list", "--count", "@{upstream}..HEAD"], root)).stdout.trimEnd();
      if (Number(ahead) === 0) { console.log(`[${root}] Already up to date on ${branch}`); return 2; }
      console.log(`[${root}] Pushing ${ahead} commit(s) on ${branch}...`); return (await runner.git(force ? ["push", "--force-with-lease"] : ["push"], root, env, true)).exitCode;
    }
    console.log(`[${root}] No upstream. Pushing ${branch} to origin...`); return (await runner.git(force ? ["push", "-u", "origin", branch, "--force-with-lease"] : ["push", "-u", "origin", branch], root, env, true)).exitCode;
  } catch (error) {
    console.error(`[${repo}] Failed: ${error instanceof Error ? error.message : error}`); return 1;
  }
}
/** @param {string[]} args @returns {Promise<number>} */
async function main(args) {
  let force = false; /** @type {string[]} */ const repos = [];
  for (const arg of args) { if (arg === "--force") force = true; else if (arg === "-h" || arg === "--help") { usage(); return 0; } else if (arg.startsWith("-")) return usage(); else repos.push(arg); }
  if (!repos.length) repos.push(...await discoverRepos(".")); if (!repos.length) { console.error("Error: No git repository found"); return 1; }
  let pushed = 0; let skipped = 0; let errors = 0;
  for (const repo of repos) { const code = await pushOneRepo(repo, force); if (code === 0) pushed++; else if (code === 2) skipped++; else errors++; }
  console.log(); console.log(`Done: ${pushed} pushed, ${skipped} skipped, ${errors} failed`); return errors === 0 ? 0 : 1;
}
/** @returns {number} */
function usage() { console.error(`Usage: ${process.argv[1]} [--force] [repo...]`); return 1; }
const runner = createGitRunner();
process.exitCode = await runner.settle(() => main(process.argv.slice(2)));

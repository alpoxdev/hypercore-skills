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
  async function git(args, cwd, env, output = false) { const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe", env: env ? { ...process.env, ...env } : undefined }); children.add(child); try { const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]); if (output) { if (stdout) process.stdout.write(stdout); if (stderr) process.stderr.write(stderr); } return { exitCode, stdout, stderr }; } finally { children.delete(child); } }
  /** @template T @param {() => Promise<T>} main @returns {Promise<T>} */
  async function settle(main) { try { return await main(); } finally { process.off("SIGINT", forward); process.off("SIGTERM", forward); if (receivedSignal) process.kill(process.pid, receivedSignal); } }
  return { git, settle };
}
/** @param {string} path @returns {Promise<string | null>} */
async function repoRoot(path) { const result = await runner.git(["rev-parse", "--show-toplevel"], path); return result.exitCode === 0 ? result.stdout.trimEnd() : null; }
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
  const root = await repoRoot(repo); if (!root) { console.error(`[${repo}] Failed: not a git work tree`); return 1; }
  const branch = (await runner.git(["branch", "--show-current"], root)).stdout.trimEnd(); if (!branch) { console.error(`[${root}] Skipped: detached HEAD`); return 2; }
  if (force && (branch === "main" || branch === "master")) { console.error(`[${root}] Skipped: cannot force push to protected branch ${branch}`); return 2; }
  const upstream = (await runner.git(["rev-parse", "--abbrev-ref", "@{upstream}"], root)).stdout.trimEnd(); const env = { GIT_TERMINAL_PROMPT: "0" };
  if (upstream) { const ahead = (await runner.git(["rev-list", "--count", "@{upstream}..HEAD"], root)).stdout.trimEnd() || "0"; if (Number(ahead) === 0) { console.log(`[${root}] Already up to date on ${branch}`); return 2; } console.log(`[${root}] Pushing ${ahead} commit(s) on ${branch}...`); return (await runner.git(force ? ["push", "--force-with-lease"] : ["push"], root, env, true)).exitCode ?? 1; }
  console.log(`[${root}] No upstream. Pushing ${branch} to origin...`); return (await runner.git(force ? ["push", "-u", "origin", branch, "--force-with-lease"] : ["push", "-u", "origin", branch], root, env, true)).exitCode ?? 1;
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

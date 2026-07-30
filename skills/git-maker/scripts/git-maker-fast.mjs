#!/usr/bin/env bun
// @ts-check

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const PRUNED_DIRECTORIES = new Set(["node_modules", "dist", "build", ".next", ".turbo", ".cache", "coverage", "vendor"]);
/**
 * @typedef {{ exitCode: number, stdout: string, stderr: string }} GitResult
 * @returns {{ git: (args: string[], cwd: string, env?: Record<string, string | undefined>, output?: boolean) => Promise<GitResult>, stop: () => void, throwIfStopping: () => void, settle: <T>(main: () => Promise<T>) => Promise<T> }}
 */
function createGitRunner() {
  const children = new Set();
  const settlements = new Set();
  let stopNewWork = false;
  /** @type {NodeJS.Signals | null} */
  let receivedSignal = null;
  /** @param {NodeJS.Signals} signal */
  function killActive(signal) { for (const child of children) child.kill(signal); }
  /** @param {NodeJS.Signals} signal */
  function forward(signal) { receivedSignal ??= signal; stopNewWork = true; killActive(signal); }
  function stop() { stopNewWork = true; killActive("SIGTERM"); }
  process.on("SIGINT", forward); process.on("SIGTERM", forward);
  function throwIfStopping() { if (stopNewWork) throw new Error("Git runner is stopping"); }
  /** @param {string[]} args @param {string} cwd @param {Record<string, string | undefined>} [env] @param {boolean} [output] @returns {Promise<GitResult>} */
  async function git(args, cwd, env, output = false) {
    throwIfStopping();
    const child = Bun.spawn({ cmd: ["git", ...args], cwd, env: env ? { ...process.env, ...env } : process.env, stdout: "pipe", stderr: "pipe" });
    children.add(child);
    const settlement = Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
    settlements.add(settlement);
    try {
      const [exitCode, stdout, stderr] = await settlement;
      if (output) { if (stdout) process.stdout.write(stdout); if (stderr) process.stderr.write(stderr); }
      return { exitCode, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() };
    } finally {
      settlements.delete(settlement);
      children.delete(child);
    }
  }
  /** @template T @param {() => Promise<T>} main @returns {Promise<T>} */
  async function settle(main) {
    try {
      return await main();
    } catch (error) {
      stop();
      throw error;
    } finally {
      await Promise.allSettled([...settlements]);
      process.off("SIGINT", forward); process.off("SIGTERM", forward);
      if (receivedSignal) process.kill(process.pid, receivedSignal);
    }
  }
  return { git, stop, throwIfStopping, settle };
}
/** @param {string[]} args @param {GitResult} result @returns {Error} */
function gitError(args, result) { return new Error(result.stderr || `git ${args.join(" ")} failed with exit code ${result.exitCode}`); }
/** @param {string[]} args @param {string} cwd @param {Record<string, string | undefined>} [env] @param {boolean} [output] @returns {Promise<GitResult>} */
async function requiredGit(args, cwd, env, output = false) { const result = await runner.git(args, cwd, env, output); if (result.exitCode !== 0) throw gitError(args, result); return result; }
/** @param {GitResult} result @returns {boolean} */
function isNotGitRepository(result) { return result.exitCode !== 0 && /not a git repository/i.test(result.stderr); }
/** @param {string} path @param {boolean} [allowNotRepo] @returns {Promise<string | null>} */
async function repoRoot(path, allowNotRepo = false) { const args = ["rev-parse", "--show-toplevel"]; const result = await runner.git(args, path); if (result.exitCode === 0) return result.stdout; if (allowNotRepo && isNotGitRepository(result)) return null; throw gitError(args, result); }
/** @param {string} directory @param {string[]} paths @returns {void} */
function collectGitPaths(directory, paths) { for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = `${directory}/${entry.name}`; if (entry.name === ".git" && (entry.isDirectory() || entry.isFile())) { paths.push(path); continue; } if (entry.isDirectory() && !PRUNED_DIRECTORIES.has(entry.name)) collectGitPaths(path, paths); } }
/** @param {string} startDir @returns {Promise<string[]>} */
async function discoverRepos(startDir) {
  if (!existsSync(startDir) || !statSync(startDir).isDirectory()) throw new Error(`Directory not found: ${startDir}`);
  const cwd = resolve(startDir);
  const current = await repoRoot(cwd, true);
  if (current) return [current];
  /** @type {string[]} */
  const paths = [];
  collectGitPaths(cwd, paths);
  return [...new Set((await Promise.all(paths.sort().map((path) => repoRoot(dirname(path))))).filter(isRepoRoot))].sort();
}
/** @param {string | null} root @returns {root is string} */
function isRepoRoot(root) { return root !== null; }
/** @param {string} repo @returns {Promise<string>} */
async function statusOneRepo(repo) {
  const inside = await requiredGit(["rev-parse", "--is-inside-work-tree"], repo);
  if (inside.stdout !== "true") throw new Error(`[${repo}] not a git work tree`);
  const root = await repoRoot(repo);
  if (!root) throw new Error(`[${repo}] not a git work tree`);
  const [gitDir, commonDir, branch, status] = await Promise.all(["--git-dir", "--git-common-dir"].map((arg) => requiredGit(["rev-parse", arg], root)).concat([requiredGit(["branch", "--show-current"], root), requiredGit(["status", "--short", "--no-renames"], root)]));
  const upstream = branch.stdout ? await requiredGit(["for-each-ref", "--format=%(upstream:short)", `refs/heads/${branch.stdout}`], root) : { stdout: "" };
  const ahead = upstream.stdout ? (await requiredGit(["rev-list", "--count", "@{upstream}..HEAD"], root)).stdout || "0" : "0";
  const output = [`repo|${root}`, `worktree|${gitDir.stdout && commonDir.stdout && gitDir.stdout !== commonDir.stdout ? "linked" : "primary"}`, `git-dir|${gitDir.stdout}`, `git-common-dir|${commonDir.stdout}`, `branch|${branch.stdout || "DETACHED"}`, `upstream|${upstream.stdout || "none"}`, `ahead|${ahead}`, "status|begin"];
  if (status.stdout) output.push(status.stdout); output.push("status|end", "files|begin");
  for (const line of status.stdout ? status.stdout.split("\n") : []) { const code = line.slice(0, 2); const file = line.slice(3); if (code === "??") output.push(`untracked|${file}`); else { if (code[0] !== " ") output.push(`staged|${file}`); if (code[1] !== " ") output.push(`unstaged|${file}`); } }
  output.push("files|end"); return `${output.join("\n")}\n`;
}
/** @template T, U @param {T[]} items @param {number} limit @param {(item: T) => Promise<U>} work @returns {Promise<U[]>} */
async function parallelMap(items, limit, work) { const results = new Array(items.length); let cursor = 0; async function worker() { while (true) { runner.throwIfStopping(); const index = cursor++; if (index >= items.length) return; results[index] = await work(items[index]); } } const workers = Array.from({ length: Math.min(limit, items.length) }, worker); try { await Promise.all(workers); } catch (error) { runner.stop(); await Promise.allSettled(workers); throw error; } return results; }
/** @param {string} repo @param {boolean} force @returns {Promise<number>} */
async function pushOneRepo(repo, force) { const root = await repoRoot(repo); if (!root) throw new Error(`[${repo}] not a git work tree`); const branch = (await requiredGit(["branch", "--show-current"], root)).stdout; if (!branch) { console.error(`[${root}] Skipped: detached HEAD`); return 2; } if (force && (branch === "main" || branch === "master")) { console.error(`[${root}] Skipped: cannot force push to protected branch ${branch}`); return 2; } const upstream = (await requiredGit(["for-each-ref", "--format=%(upstream:short)", `refs/heads/${branch}`], root)).stdout; const env = { GIT_TERMINAL_PROMPT: "0" }; if (upstream) { const ahead = (await requiredGit(["rev-list", "--count", "@{upstream}..HEAD"], root)).stdout || "0"; if (Number(ahead) === 0) { console.log(`[${root}] Already up to date on ${branch}`); return 2; } console.log(`[${root}] Pushing ${ahead} commit(s) on ${branch}...`); return (await runner.git(force ? ["push", "--force-with-lease"] : ["push"], root, env, true)).exitCode ?? 1; } console.log(`[${root}] No upstream. Pushing ${branch} to origin...`); return (await runner.git(force ? ["push", "-u", "origin", branch, "--force-with-lease"] : ["push", "-u", "origin", branch], root, env, true)).exitCode ?? 1; }
/** @param {string[]} args @returns {Promise<number>} */
async function inspectCommand(args) { let startDir = "."; let jobs = process.env.GIT_MAKER_JOBS ?? "4"; let seenStart = false; while (args.length) { const arg = args.shift(); if (arg === undefined) break; if (arg === "--jobs") { jobs = args.shift() ?? ""; if (!jobs) { console.error("Error: --jobs requires a value"); return 1; } } else if (arg.startsWith("--jobs=")) jobs = arg.slice(7); else if (arg === "-h" || arg === "--help") { usage(); return 0; } else if (arg.startsWith("-" ) || seenStart) return usage(); else { startDir = arg; seenStart = true; } } if (!/^\d+$/.test(jobs) || Number(jobs) <= 0) jobs = "4"; /** @type {string[]} */ let repos; try { repos = await discoverRepos(startDir); } catch (error) { console.error(`Error: ${error instanceof Error ? error.message : error}`); return 1; } if (!repos.length) { console.error(`Error: No git repository found from ${startDir}`); return 1; } console.log("repos|begin"); for (const repo of repos) console.log(repo); console.log("repos|end"); /** @type {string[]} */ let results; try { results = await parallelMap(repos, Number(jobs), statusOneRepo); } catch (error) { console.error(`Error: ${error instanceof Error ? error.message : error}`); return 1; } for (const result of results) { console.log("repo-status|begin"); process.stdout.write(result); console.log("repo-status|end"); } return 0; }
/** @param {string[]} args @returns {Promise<number>} */
async function pushCommand(args) { let force = false; /** @type {string[]} */ const repos = []; for (const arg of args) { if (arg === "--force") force = true; else if (arg === "-h" || arg === "--help") { usage(); return 0; } else if (arg.startsWith("-")) return usage(); else repos.push(arg); } if (!repos.length) repos.push(...await discoverRepos(".")); if (!repos.length) { console.error("Error: No git repository found"); return 1; } let pushed = 0; let skipped = 0; let errors = 0; for (const repo of repos) { const code = await pushOneRepo(repo, force); if (code === 0) pushed++; else if (code === 2) skipped++; else errors++; } console.log(); console.log(`Done: ${pushed} pushed, ${skipped} skipped, ${errors} failed`); return errors === 0 ? 0 : 1; }
/** @returns {number} */
function usage() { console.error("Usage:\n  git-maker-fast.mjs inspect [start_dir] [--jobs N]\n  git-maker-fast.mjs push [--force] [repo...]"); return 1; }
/** @param {string[]} args @returns {Promise<number>} */
async function main(args) { const command = args.shift(); if (command === "inspect") return inspectCommand(args); if (command === "push") return pushCommand(args); if (command === "-h" || command === "--help") { usage(); return 0; } usage(); return 1; }
const runner = createGitRunner();
process.exitCode = await runner.settle(() => main(process.argv.slice(2)));

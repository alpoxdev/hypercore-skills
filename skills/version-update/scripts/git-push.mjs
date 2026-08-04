#!/usr/bin/env bun
// @ts-check

const activeChildren = new Set();

/** @param {string[]} args @param {"inherit" | "pipe"} [output] @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>} */
async function git(args, output = "inherit") {
  if (receivedSignal) return { exitCode: 130, stdout: "", stderr: "Interrupted by signal" };
  const piped = output === "pipe";
  const child = Bun.spawn({ cmd: ["git", ...args], cwd: process.cwd(), env: process.env, stdout: output, stderr: output });
  activeChildren.add(child);
  const stdout = piped ? new Response(child.stdout).text() : Promise.resolve("");
  const stderr = piped ? new Response(child.stderr).text() : Promise.resolve("");
  try {
    const [exitCode, standardOutput, standardError] = await Promise.all([child.exited, stdout, stderr]);
    return { exitCode, stdout: standardOutput, stderr: standardError };
  } finally {
    activeChildren.delete(child);
  }
}

/** @type {string | undefined} */
let receivedSignal;
const signalHandlers = new Map();
for (const signal of ["SIGINT", "SIGTERM"]) {
  const handler = () => {
    receivedSignal ??= signal;
    for (const child of activeChildren) child.kill(signal);
  };
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
}

/** @param {string} output */
function text(output) {
  return output.trimEnd();
}

/** @param {string} stderr */
function isNotGitRepository(stderr) {
  return /^fatal: not a git repository \(or any of the parent directories\): \.git$/m.test(stderr);
}

/** @param {string[]} args @returns {Promise<number>} */
async function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--force")) {
    console.error(`Usage: ${process.argv[1]} [--force]`);
    return 2;
  }

  const gitDirectory = await git(["rev-parse", "--git-dir"], "pipe");
  if (gitDirectory.exitCode !== 0) {
    if (isNotGitRepository(gitDirectory.stderr)) {
      console.error("Error: Not a git repository");
      return 1;
    }
    if (gitDirectory.stderr) process.stderr.write(gitDirectory.stderr);
    return gitDirectory.exitCode;
  }

  const branchResult = await git(["branch", "--show-current"], "pipe");
  if (branchResult.exitCode !== 0) {
    if (branchResult.stderr) process.stderr.write(branchResult.stderr);
    return branchResult.exitCode;
  }
  const branch = text(branchResult.stdout);
  if (!branch) {
    console.error("Error: Not on any branch (detached HEAD)");
    return 1;
  }

  const force = args[0] === "--force";
  if (force && (branch === "main" || branch === "master")) {
    console.error(`ERROR: Cannot force push to ${branch}`);
    console.error("This operation is too dangerous on protected branches");
    return 1;
  }
  if (force) console.log(`Warning: Force push enabled (with lease) to ${branch}`);

  const upstream = await git(["for-each-ref", "--format=%(upstream:short)", `refs/heads/${branch}`], "pipe");
  if (upstream.exitCode !== 0) {
    if (upstream.stderr) process.stderr.write(upstream.stderr);
    return upstream.exitCode;
  }
  const hasUpstream = text(upstream.stdout) !== "";
  if (!hasUpstream) {
    console.log(`Setting upstream for branch: ${branch}`);
    if ((await git(force ? ["push", "-u", "origin", branch, "--force-with-lease"] : ["push", "-u", "origin", branch])).exitCode !== 0) return 1;
  } else if ((await git(force ? ["push", "--force-with-lease"] : ["push"])).exitCode !== 0) {
    return 1;
  }

  console.log(`Pushed to origin/${branch}`);
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main(process.argv.slice(2));
} finally {
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  if (receivedSignal) {
    for (const child of activeChildren) child.kill(receivedSignal);
    await Promise.allSettled([...activeChildren].map((child) => child.exited));
    process.kill(process.pid, receivedSignal);
  }
}
process.exitCode = exitCode;

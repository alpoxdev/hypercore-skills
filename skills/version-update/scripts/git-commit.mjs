#!/usr/bin/env bun
// @ts-check

const activeChildren = new Set();

/** @param {string[]} args @param {"inherit" | "pipe"} [output] @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>} */
async function git(args, output = "inherit") {
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
function lines(output) {
  const value = output.trimEnd();
  return value ? value.split("\n") : [];
}

/** @param {string} stagedFile @param {string[]} targets */
function matchesRequestedTarget(stagedFile, targets) {
  return targets.some((target) => stagedFile === target || stagedFile.startsWith(`${target}/`));
}

/** @param {string} stderr */
function isNotGitRepository(stderr) {
  return /^fatal: not a git repository \(or any of the parent directories\): \.git$/m.test(stderr);
}

/** @param {string[]} args @returns {Promise<number>} */
async function main(args) {
  const gitDirectory = await git(["rev-parse", "--git-dir"], "pipe");
  if (gitDirectory.exitCode !== 0) {
    if (isNotGitRepository(gitDirectory.stderr)) {
      console.error("Error: Not a git repository");
      return 1;
    }
    if (gitDirectory.stderr) process.stderr.write(gitDirectory.stderr);
    return gitDirectory.exitCode;
  }

  const message = args[0];
  if (message === undefined || message === "") {
    console.error(`Usage: ${process.argv[1]} "commit message" [files...]`);
    return 1;
  }
  if (!/\S/.test(message)) {
    console.error("Error: Commit message cannot be empty");
    return 1;
  }

  const requested = args.slice(1);
  if (requested.length > 0) {
    const staged = await git(["diff", "--cached", "--name-only"], "pipe");
    if (staged.exitCode !== 0) {
      if (staged.stderr) process.stderr.write(staged.stderr);
      return staged.exitCode;
    }
    const extra = lines(staged.stdout).filter((file) => !matchesRequestedTarget(file, requested));
    if (extra.length > 0) {
      console.error("Error: Additional staged changes exist outside the requested files:");
      for (const file of extra) console.error(`  ${file}`);
      console.error("Tip: Unstage unrelated files or commit them separately before retrying.");
      return 1;
    }
    if ((await git(["add", "--", ...requested])).exitCode !== 0) return 1;
  }

  const stagedChanges = await git(["diff", "--cached", "--quiet"], "pipe");
  if (stagedChanges.exitCode === 0) {
    if (requested.length === 0) {
      console.error("Error: No staged changes to commit");
      console.error("Tip: Stage files with 'git add' or pass files as arguments");
    } else {
      console.error("Error: No changes in specified files");
      console.error("Tip: Check if files exist and have modifications");
    }
    return 1;
  }
  if (stagedChanges.exitCode !== 1) {
    if (stagedChanges.stderr) process.stderr.write(stagedChanges.stderr);
    return stagedChanges.exitCode;
  }

  if ((await git(["commit", "-m", message])).exitCode !== 0) return 1;
  console.log("Committed successfully");
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

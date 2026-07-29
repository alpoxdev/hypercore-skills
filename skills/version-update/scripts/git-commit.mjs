#!/usr/bin/env bun
// @ts-check

const activeChildren = new Set();

/** @param {string[]} args @param {"inherit" | "pipe"} [output] */
async function git(args, output = "inherit") {
  const piped = output === "pipe";
  const child = Bun.spawn(["git", ...args], { stdout: output, stderr: output });
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

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const child of activeChildren) child.kill(signal);
  });
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

/** @param {string[]} args */
async function main(args) {
  if ((await git(["rev-parse", "--git-dir"], "pipe")).exitCode !== 0) {
    console.error("Error: Not a git repository");
    return 1;
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
    const extra = lines((await git(["diff", "--cached", "--name-only"], "pipe")).stdout)
      .filter((file) => !matchesRequestedTarget(file, requested));
    if (extra.length > 0) {
      console.error("Error: Additional staged changes exist outside the requested files:");
      for (const file of extra) console.error(`  ${file}`);
      console.error("Tip: Unstage unrelated files or commit them separately before retrying.");
      return 1;
    }
    if ((await git(["add", ...requested])).exitCode !== 0) return 1;
  }

  if ((await git(["diff", "--cached", "--quiet"], "pipe")).exitCode === 0) {
    if (requested.length === 0) {
      console.error("Error: No staged changes to commit");
      console.error("Tip: Stage files with 'git add' or pass files as arguments");
    } else {
      console.error("Error: No changes in specified files");
      console.error("Tip: Check if files exist and have modifications");
    }
    return 1;
  }

  if ((await git(["commit", "-m", message])).exitCode !== 0) return 1;
  console.log("Committed successfully");
  return 0;
}

process.exitCode = await main(process.argv.slice(2));

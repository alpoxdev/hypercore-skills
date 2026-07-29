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
function text(output) {
  return output.trimEnd();
}

/** @param {string[]} args */
async function main(args) {
  if (args.length > 1 || (args.length === 1 && args[0] !== "--force")) {
    console.error(`Usage: ${process.argv[1]} [--force]`);
    return 2;
  }

  if ((await git(["rev-parse", "--git-dir"], "pipe")).exitCode !== 0) {
    console.error("Error: Not a git repository");
    return 1;
  }

  const branch = text((await git(["branch", "--show-current"], "pipe")).stdout);
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

  const hasUpstream = (await git(["rev-parse", "--abbrev-ref", "@{upstream}"], "pipe")).exitCode === 0;
  if (!hasUpstream) {
    console.log(`Setting upstream for branch: ${branch}`);
    if ((await git(force ? ["push", "-u", "origin", branch, "--force-with-lease"] : ["push", "-u", "origin", branch])).exitCode !== 0) return 1;
  } else if ((await git(force ? ["push", "--force-with-lease"] : ["push"])).exitCode !== 0) {
    return 1;
  }

  console.log(`Pushed to origin/${branch}`);
  return 0;
}

process.exitCode = await main(process.argv.slice(2));

#!/usr/bin/env bun
// @ts-check
/** Calculate the next semantic version for a requested bump. */
const [current, bump] = process.argv.slice(2);
if (!current || !bump) {
  console.log(`Usage: ${process.argv[1]} <current_version> <bump_type>`);
  console.log("bump_type: +1, +minor, +major, or x.x.x");
  process.exit(1);
}
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(current)) {
  console.error(`Error: Invalid version format: ${current}`);
  console.error("Expected: x.x.x (e.g., 1.2.3)");
  process.exit(1);
}
const [major, minor, patch] = current.split(".").map(Number);
let next;
switch (bump) {
  case "+1":
  case "+patch": next = `${major}.${minor}.${patch + 1}`; break;
  case "+minor": next = `${major}.${minor + 1}.0`; break;
  case "+major": next = `${major + 1}.0.0`; break;
  default:
    if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(bump)) {
      console.log(`Error: Invalid bump type: ${bump}`);
      console.log("Use: +1, +minor, +major, or x.x.x");
      process.exit(1);
    }
    next = bump;
}
console.log(next);

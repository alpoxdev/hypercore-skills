#!/usr/bin/env bun
// @ts-check

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exit(1);
}

/** @param {string} path */
function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

if (process.argv.length !== 3) fail("사용법: scripts/render-dashboard.mjs <artifact-dir>");

const artifactDir = process.argv[2];
const skillDir = dirname(dirname(fileURLToPath(import.meta.url)));
const templatePath = join(skillDir, "assets", "dashboard-template.html");
const resultsPath = join(artifactDir, "results.json");
const dashboardPath = join(artifactDir, "dashboard.html");
const resultsJsPath = join(artifactDir, "results.js");

if (!isFile(templatePath)) fail(`대시보드 템플릿이 없습니다: ${templatePath}`);
if (!isFile(resultsPath)) fail(`results.json이 없습니다: ${resultsPath}`);

let results;
try {
  results = JSON.parse(readFileSync(resultsPath, "utf8"));
} catch (error) {
  if (error instanceof SyntaxError) fail(`results.json JSON 파싱에 실패했습니다: ${error.message}`);
  throw error;
}
mkdirSync(artifactDir, { recursive: true });
copyFileSync(templatePath, dashboardPath);
writeFileSync(resultsJsPath, `window.__SEO_RESULTS__ = ${JSON.stringify(results)};\n`, "utf8");

console.log(`렌더 완료: ${dashboardPath}`);
console.log(`렌더 완료: ${resultsJsPath}`);

#!/usr/bin/env bun
// @ts-check

import { closeSync, existsSync, fchmodSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

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
/**
 * @param {string} path
 * @returns {{ content: Buffer, mode: number } | null}
 */
function snapshotOutput(path) {
  if (!existsSync(path)) return null;
  const stats = statSync(path);
  if (!stats.isFile()) throw new Error(`출력 경로가 일반 파일이 아닙니다: ${path}`);
  return { content: readFileSync(path), mode: stats.mode & 0o7777 };
}

/** @param {string} path */
function temporaryPath(path) {
  return `${path}.${process.pid}.${randomUUID()}.tmp`;
}

/**
 * @param {string} path
 * @param {string | Buffer} content
 * @param {number | undefined} mode
 */
function writeSyncedTemp(path, content, mode) {
  const descriptor = openSync(path, "wx", 0o666);
  try {
    if (mode !== undefined) fchmodSync(descriptor, mode);
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
  } catch (error) {
    closeSync(descriptor);
    unlinkSync(path);
    throw error;
  }
  closeSync(descriptor);
}

/** @param {string} path */
function removeTemp(path) {
  if (existsSync(path)) unlinkSync(path);
}

/**
 * @param {string} path
 * @param {{ content: Buffer, mode: number } | null} snapshot
 */
function restoreOutput(path, snapshot) {
  if (snapshot === null) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }

  const tempPath = temporaryPath(path);
  try {
    writeSyncedTemp(tempPath, snapshot.content, snapshot.mode);
    renameSync(tempPath, path);
  } finally {
    removeTemp(tempPath);
  }
}

/**
 * @param {string | Buffer} dashboard
 * @param {string} resultsJs
 */
function writeOutputPair(dashboard, resultsJs) {
  const dashboardSnapshot = snapshotOutput(dashboardPath);
  const resultsSnapshot = snapshotOutput(resultsJsPath);
  const dashboardTempPath = temporaryPath(dashboardPath);
  const resultsTempPath = temporaryPath(resultsJsPath);

  try {
    writeSyncedTemp(dashboardTempPath, dashboard, dashboardSnapshot?.mode);
    writeSyncedTemp(resultsTempPath, resultsJs, resultsSnapshot?.mode);
    renameSync(dashboardTempPath, dashboardPath);
    try {
      renameSync(resultsTempPath, resultsJsPath);
    } catch (error) {
      try {
        restoreOutput(dashboardPath, dashboardSnapshot);
      } catch (restoreError) {
        throw new AggregateError([error, restoreError], "results.js 커밋 실패 후 dashboard.html 복원에 실패했습니다");
      }
      throw error;
    }
  } finally {
    removeTemp(dashboardTempPath);
    removeTemp(resultsTempPath);
  }
}

mkdirSync(artifactDir, { recursive: true });
writeOutputPair(readFileSync(templatePath), `window.__SEO_RESULTS__ = ${JSON.stringify(results)};\n`);

console.log(`렌더 완료: ${dashboardPath}`);
console.log(`렌더 완료: ${resultsJsPath}`);

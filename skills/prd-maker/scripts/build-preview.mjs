#!/usr/bin/env bun
// @ts-check
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {[id: string, label: string, path: string]} DocumentSpec
 * @typedef {{ id: string, label: string, path: string, content: string }} PreviewDocument
 * @typedef {{ title: string, slug: string, generatedAt: string, hasFlow: boolean, openQuestionCount: number, diagramSvg: string, documents: PreviewDocument[] }} PreviewPayload
 */
const [, , packageDirArg, outputArg] = process.argv;
if (!packageDirArg) {
  console.error('Usage: node build-preview.mjs <package-dir> [preview.html]');
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, '..');
const packageDir = resolve(packageDirArg);
const outputPath = resolve(outputArg || join(packageDir, 'preview.html'));
const templatePath = join(skillDir, 'assets', 'preview.template.html');
const template = readFileSync(templatePath, 'utf8');

/** @type {DocumentSpec[]} */
const docSpecs = [
  ['prd', 'PRD', 'prd.md'],
  ['featureSpec', '기능명세서', 'feature-spec.md'],
  ['userFlow', '유저플로우', 'user-flow.md'],
  ['wireframe', '와이어프레임', 'wireframe.md'],
  ['diagram', '기획 맵', 'diagram.md'],
  ['sources', '출처 로그', 'sources.md']
];

/** @param {string} path @returns {string} */
function readMaybe(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}
/** @type {Record<string, string>} */
const HTML_ATTRIBUTE_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

const documents = docSpecs.map(([id, label, path]) => ({
  id,
  label,
  path,
  content: readMaybe(join(packageDir, path))
}));

const prd = documents.find((doc) => doc.id === 'prd')?.content || '';
const titleMatch = prd.match(/^#\s+(.+)$/m);
const diagramSvg = readMaybe(join(packageDir, 'diagram.svg'));
const hasFlow = existsSync(join(packageDir, 'flow.json'));
const openQuestionCount = documents.reduce((count, doc) => count + (doc.content.match(/^- \[ \]/gm) || []).length, 0);

/** @type {PreviewPayload} */
const payload = {
  title: titleMatch ? titleMatch[1].replace(/\s+PRD$/i, '') : basename(packageDir),
  slug: basename(packageDir),
  generatedAt: new Date().toISOString(),
  hasFlow,
  openQuestionCount,
  diagramSvg,
  documents
};

const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
const html = template
  .replaceAll('{{TITLE}}', escapeHtmlAttr(payload.title))
  .replace('{{PACKAGE_JSON}}', safeJson);

writeFileSync(outputPath, html);
console.log(`Built ${outputPath}`);

/** @param {string} value @returns {string} */
function escapeHtmlAttr(value) {
  return String(value).replace(/[&<>"]/g, (ch) => HTML_ATTRIBUTE_ENTITIES[ch]);
}

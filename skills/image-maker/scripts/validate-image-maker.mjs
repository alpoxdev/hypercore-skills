#!/usr/bin/env node
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdtempSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, rmSync, symlinkSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const ASK_FALLBACK = '이미지 생성 또는 편집을 완료할 수 없습니다. 이미지 대신 프롬프트 전용 파일을 저장할까요?';
const ASK_AUTH = '제공한 원본을 사용하고 편집할 권한이 있나요?';
const SETS = {
  requested_mode: new Set(['generate', 'edit', 'prompt_only']), material_context: new Set(['complete', 'missing']),
  missing_fact: new Set(['none', 'subject', 'reference', 'rendered_text', 'preserve_change']), edit_source: new Set(['supplied', 'absent', 'not_applicable']),
  authorization: new Set(['authorized', 'denied', 'unknown']), fallback_policy: new Set(['explicitly_allowed', 'explicitly_rejected', 'unspecified']),
  image_generation: new Set(['available', 'unavailable', 'unknown']), image_editing: new Set(['available', 'unavailable', 'unknown']),
  retrieve_persist: new Set(['available', 'unavailable', 'unknown']), inspect: new Set(['available', 'unavailable', 'unknown']),
  file_write: new Set(['available', 'unavailable', 'unknown']), inspection_requirement: new Set(['required', 'optional'])
};
const KEYS = [...Object.keys(SETS), 'topic', 'compiled_brief'];
const digest = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, Object.keys(value).sort());

export function validateTopic(topic) {
  if (typeof topic !== 'string' || /[\p{Cc}\p{Cf}]/u.test(topic)) return { ok: false, error: 'E_TOPIC_UNSAFE' };
  const value = topic.normalize('NFC').trim();
  if (!value || value === '.' || value === '..' || value !== basename(value) || /[\\/]/u.test(value)) return { ok: false, error: 'E_TOPIC_UNSAFE' };
  return { ok: true, topic: value };
}
export function classifyImageMakerTrigger(text) {
  if (typeof text !== 'string') return 'manual_required';
  const s = text.toLowerCase();
  if (/(분석|설명|analysis|explain)/u.test(s)) return 'negative';
  if (/(프롬프트만|prompt[ -]?only)/u.test(s) && /(이미지|그림|사진|image|picture|illustration)/u.test(s)) return 'prompt_only';
  if (/(이미지|그림|사진|image|picture).{0,36}(편집|수정|보정|edit|retouch)|(?:edit|retouch).{0,36}(?:image|picture)/iu.test(s)) return 'edit';
  if (/(이미지|그림|사진|image|picture|illustration).{0,36}(만들|생성|그려|create|generate|draw)|(?:create|generate|draw|illustrate).{0,36}(?:image|picture|illustration)/iu.test(s)) return 'create';
  if (/(프롬프트 팩|prompt pack|디자인 문서|design document|편집 가능한 ui|editable ui|코드 구현|code implementation)/u.test(s)) return 'negative';
  return 'manual_required';
}
export function validateImageMakerInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !KEYS.includes(key)) || KEYS.some(key => !(key in input))) return { ok: false, error: 'E_CAPABILITY_SCHEMA' };
  for (const key of Object.keys(SETS)) if (!SETS[key].has(input[key])) return { ok: false, error: `E_INPUT_${key}` };
  const topic = validateTopic(input.topic); if (!topic.ok) return topic;
  if (typeof input.compiled_brief !== 'string') return { ok: false, error: 'E_COMPILED_BRIEF' };
  if (input.material_context === 'complete' && (typeof input.compiled_brief !== 'string' || !input.compiled_brief.trim())) return { ok: false, error: 'E_COMPILED_BRIEF' };
  if (input.material_context === 'missing' && input.missing_fact === 'none') return { ok: false, error: 'E_MISSING_FACT' };
  if (input.material_context === 'complete' && input.missing_fact !== 'none') return { ok: false, error: 'E_MISSING_FACT' };
  if (input.requested_mode === 'edit') {
    const expectedSource = input.material_context === 'missing' && input.missing_fact === 'reference' ? 'absent' : 'supplied';
    if (input.edit_source !== expectedSource) return { ok: false, error: 'E_EDIT_SOURCE' };
  }
  if (input.requested_mode !== 'edit' && input.edit_source !== 'not_applicable') return { ok: false, error: 'E_EDIT_SOURCE' };
  return { ok: true, context: { ...input, topic: topic.topic } };
}
function context(input) {
  const checked = validateImageMakerInput(input); if (!checked.ok) return checked;
  const typed = Object.fromEntries(KEYS.map(k => [k, input[k]]));
  return { ok: true, context: checked.context, token: digest(stable(typed)), briefDigest: digest(input.compiled_brief || '') };
}
function annotated(input, value) { const c = context(input); return c.ok ? { ...value, topic: c.context.topic, context_token: c.token, compiled_brief_digest: c.briefDigest, compiled_brief: input.compiled_brief || '' } : value; }
const missingQuestion = fact => ({ subject: '이미지의 주제를 알려 주세요.', reference: '참조 이미지 또는 자료를 제공해 주세요.', rendered_text: '이미지에 정확히 넣을 문구를 알려 주세요.', preserve_change: '유지할 요소와 변경할 요소를 알려 주세요.' })[fact];
function fallback(input, reason) {
  if (input.fallback_policy === 'explicitly_allowed') return annotated(input, { route: 'prompt_only', terminal: 'pending_prompt_saved', reason, attempts: 0, invokes: 0, writes: 0 });
  if (input.fallback_policy === 'explicitly_rejected') return { route: 'block', terminal: 'blocked', error: 'E_FALLBACK_REJECTED', attempts: 0, invokes: 0, writes: 0 };
  return { route: 'ask', terminal: 'awaiting_input', reason, question: ASK_FALLBACK, attempts: 0, invokes: 0, writes: 0 };
}
export function resolveImageMaker(input) {
  const c = context(input); if (!c.ok) return { route: 'block', terminal: 'blocked', error: c.error, attempts: 0, invokes: 0, writes: 0 };
  if (input.material_context === 'missing') return { route: 'ask', terminal: 'awaiting_input', reason: 'E_MISSING_FACT', missing_fact: input.missing_fact, question: missingQuestion(input.missing_fact), attempts: 0, invokes: 0, writes: 0 };
  if (input.authorization !== 'authorized') {
    if (input.authorization === 'unknown' && input.requested_mode === 'edit' && input.edit_source === 'supplied') return { route: 'ask', terminal: 'awaiting_input', error: 'E_AUTHORIZATION', question: ASK_AUTH, attempts: 0, invokes: 0, writes: 0 };
    return { route: 'block', terminal: 'blocked', error: input.authorization === 'denied' ? 'E_AUTHORIZATION_DENIED' : 'E_AUTHORIZATION', attempts: 0, invokes: 0, writes: 0 };
  }
  if (input.file_write !== 'available') return { route: 'block', terminal: 'blocked', error: 'E_FILE_WRITE_UNAVAILABLE', attempts: 0, invokes: 0, writes: 0 };
  if (input.requested_mode === 'prompt_only') return annotated(input, { route: 'prompt_only', terminal: 'pending_prompt_saved', attempts: 0, invokes: 0, writes: 0 });
  const capability = input.requested_mode === 'edit' ? input.image_editing : input.image_generation;
  if (capability !== 'available' || input.retrieve_persist !== 'available' || (input.inspection_requirement === 'required' && input.inspect !== 'available')) return fallback(input, 'E_RUNTIME_UNAVAILABLE');
  return annotated(input, { route: input.requested_mode, terminal: 'ready', attempts: 0, invokes: 0, writes: 0 });
}
function validHistory(history, c) {
  return Array.isArray(history) && history.length <= 2 && history.every((a, i) => a && a.attempt === i + 1 && ['objective_failure', 'success'].includes(a.outcome) && typeof a.objective_evidence === 'string' && a.objective_evidence.trim() && a.context_token === c.token && a.compiled_brief_digest === c.briefDigest) && history.filter(a => a.outcome === 'success').length <= 1 && (!history.some(a => a.outcome === 'success') || history.at(-1).outcome === 'success');
}
export function terminalAfterRuntime(input, runtime) {
  const preflight = resolveImageMaker(input); const c = context(input);
  if (!c.ok || !runtime || !validHistory(runtime.attempt_history || [], c)) return { route: 'block', terminal: 'blocked', error: 'E_ATTEMPT_HISTORY', attempts: 0, invokes: 0, writes: 0 };
  const history = runtime.attempt_history || []; const attempts = history.length; const invokes = attempts;
  if (preflight.terminal !== 'ready') return preflight;
  if (!attempts || history.at(-1).outcome === 'objective_failure') return attempts === 2 ? { ...fallback(input, 'E_RUNTIME_FAILED'), attempt_history: history, attempts, invokes, writes: 0 } : annotated(input, { route: preflight.route, terminal: 'retry_pending', reason: 'E_RETRY_PENDING', attempt_history: history, attempts, invokes, writes: 0 });
  const artifact = validateArtifactEvidence(runtime.root, input.topic, runtime.path, runtime.provenance);
  if (!artifact.ok) return { route: 'block', terminal: 'blocked', error: artifact.error, attempts, invokes, writes: 0 };
  if (runtime.provenance.context_token !== c.token || runtime.provenance.compiled_brief_digest !== c.briefDigest || runtime.provenance.topic !== input.topic || runtime.provenance.mode !== input.requested_mode || runtime.provenance.attempt !== attempts) return { route: 'block', terminal: 'blocked', error: 'E_PROVENANCE_BINDING', attempts, invokes, writes: 0 };
  const caveated = input.inspection_requirement === 'optional' && input.inspect !== 'available';
  if (!caveated && (runtime.inspection?.status !== 'passed' || typeof runtime.inspection.record !== 'string' || !runtime.inspection.record.trim() || !sameIdentity(runtime.inspection.identity, artifact.identity))) return { route: 'block', terminal: 'blocked', error: 'E_INSPECTION', attempts, invokes, writes: 0 };
  const result = { route: preflight.route, terminal: caveated ? 'generated_caveated' : 'generated_verified', attempts, invokes, writes: 1, path: artifact.relative_path, digest: artifact.identity.content_digest, evidence: artifact.identity, attempt_history: history };
  if (caveated) {
    result.inspection_status = input.inspect;
    result.disclosure = 'visual_rendered_text_exact_constraint_and_series_unverified';
  }
  else result.inspection = { record: runtime.inspection.record, identity: runtime.inspection.identity };
  return annotated(input, result);
}
export function terminalAfterPromptEvidence(input, runtime) {
  const preflight = resolveImageMaker(input); const c = context(input); const history = runtime?.attempt_history || [];
  if (!c.ok || !runtime || !validHistory(history, c)) return { route: 'block', terminal: 'blocked', error: 'E_ATTEMPT_HISTORY', attempts: 0, invokes: 0, writes: 0 };
  const retryFallback = history.length === 2 && history.every((attempt) => attempt.outcome === 'objective_failure') && input.fallback_policy === 'explicitly_allowed';
  if ((!['pending_prompt_saved', 'retry_pending'].includes(preflight.terminal) && preflight.route !== 'prompt_only') && !retryFallback) return preflight;
  const evidence = validatePromptEvidence(runtime.root, input.topic, runtime.path, runtime.provenance);
  if (!evidence.ok || runtime.provenance.context_token !== c.token || runtime.provenance.compiled_brief_digest !== c.briefDigest || runtime.provenance.topic !== input.topic || runtime.provenance.mode !== 'prompt_only' || runtime.provenance.exact_input !== input.compiled_brief) return { route: 'block', terminal: 'blocked', error: evidence.ok ? 'E_PROMPT_BINDING' : evidence.error, attempts: history.length, invokes: history.length, writes: 0 };
  return annotated(input, { route: 'prompt_only', terminal: 'prompt_saved', attempts: history.length, invokes: history.length, writes: 1, path: evidence.relative_path, digest: evidence.content_digest, evidence: evidence.identity });
}
export function validateContainedPath(root, topic, target) {
  try { const t = validateTopic(topic); if (!t.ok) return t; const lexicalRoot = resolve(root); const canonicalRoot = realpathSync(lexicalRoot); const parent = join(canonicalRoot, '.hypercore', 'image-maker', t.topic); const resolvedTarget = resolve(target); const path = resolvedTarget === canonicalRoot || resolvedTarget.startsWith(canonicalRoot + sep) ? resolvedTarget : resolve(canonicalRoot, relative(lexicalRoot, resolvedTarget)); if (!(path === parent || path.startsWith(parent + sep))) return { ok: false, error: 'E_PATH_ESCAPE' };
    for (let p = canonicalRoot; p !== dirname(path);) { const part = relative(p, dirname(path)).split(sep)[0]; if (!part) break; p = join(p, part); const stat = lstatSync(p, { throwIfNoEntry: false }); if (stat?.isSymbolicLink()) return { ok: false, error: 'E_SYMLINK_ANCESTOR' }; }
    const stat = lstatSync(path, { throwIfNoEntry: false }); return stat?.isSymbolicLink() ? { ok: false, error: 'E_TARGET_SYMLINK' } : { ok: true, path };
  } catch { return { ok: false, error: 'E_PATH' }; }
}
const sameIdentity = (a, b) => !!a && ['canonical_path', 'dev', 'ino', 'byte_length', 'content_digest'].every(k => a[k] === b[k]);
const sameNodeIdentity = (a, b) => !!a && ['canonical_path', 'dev', 'ino'].every(k => a[k] === b[k]);
function identity(path, bytes) { const s = lstatSync(path); return { canonical_path: realpathSync(path), dev: s.dev, ino: s.ino, byte_length: s.size, content_digest: digest(bytes) }; }
function safeRead(root, topic, target) { const checked = validateContainedPath(root, topic, target); if (!checked.ok) throw Error(checked.error); const fd = openSync(checked.path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); try { const before = fstatSync(fd); if (!before.isFile()) throw Error('E_SAFE_READ'); const bytes = Buffer.alloc(before.size); readSync(fd, bytes, 0, bytes.length, 0); const after = fstatSync(fd); if (before.dev !== after.dev || before.ino !== after.ino || !validateContainedPath(root, topic, checked.path).ok) throw Error('E_SAFE_READ'); return { bytes, identity: identity(checked.path, bytes) }; } finally { closeSync(fd); } }
function validProof(proof, read) { return proof?.capability === 'descriptor_relative_no_follow' && proof.adapter !== 'pathname' && sameIdentity(proof.identity, read.identity) && sameIdentity(proof.final_before, proof.final_after) && sameIdentity(proof.final_after, read.identity) && sameNodeIdentity(proof.root_before, proof.root_after) && sameNodeIdentity(proof.parent_before, proof.parent_after); }
export function validateArtifactEvidence(root, topic, target, provenance) { try { const read = safeRead(root, topic, target); if (!['png', 'jpeg', 'webp'].includes(media(read.bytes)) || !sameIdentity(provenance?.identity, read.identity) || !validProof(provenance?.secure_write, read)) return { ok: false, error: 'E_ARTIFACT_EVIDENCE' }; return { ok: true, relative_path: relative(realpathSync(root), read.identity.canonical_path), identity: read.identity }; } catch { return { ok: false, error: 'E_ARTIFACT_EVIDENCE' }; } }
export function validatePromptEvidence(root, topic, target, provenance) { try { const read = safeRead(root, topic, target); if (extname(target) !== '.txt' || !sameIdentity(provenance?.identity, read.identity) || !validProof(provenance?.secure_write, read) || !new TextDecoder('utf-8', { fatal: true }).decode(read.bytes).trim()) return { ok: false, error: 'E_PROMPT_EVIDENCE' }; return { ok: true, relative_path: relative(realpathSync(root), read.identity.canonical_path), identity: read.identity, content_digest: read.identity.content_digest }; } catch { return { ok: false, error: 'E_PROMPT_EVIDENCE' }; } }
function media(bytes) { return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) ? 'jpeg' : bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP')) ? 'webp' : null; }
// Test-only fixture. Node pathname operations are deliberately not a production secure writer.
function fixtureWrite(root, topic, name, bytes) { const dir = join(root, '.hypercore', 'image-maker', topic); mkdirSync(dir, { recursive: true }); let target = join(dir, name), n = 2; while (lstatSync(target, { throwIfNoEntry: false })) { const e = extname(name); target = join(dir, `${name.slice(0, -e.length)}-${n++}${e}`); } const rootBefore = identity(root, Buffer.from('')); const parentBefore = identity(dir, Buffer.from('')); writeFileSync(target, bytes, { flag: 'wx' }); const id = identity(target, bytes); return { target, provenance: { identity: id, secure_write: { capability: 'descriptor_relative_no_follow', adapter: 'test_fixture_descriptor_simulation', identity: id, root_before: rootBefore, root_after: identity(root, Buffer.from('')), parent_before: parentBefore, parent_after: identity(dir, Buffer.from('')), final_before: id, final_after: id } } }; }
function parse(file) { return readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim()).map((line, i) => { try { return JSON.parse(line); } catch { throw Error(`E_JSONL_PARSE:${i + 1}`); } }); }
function exact(actual, oracle) {
  if (!actual || typeof actual !== 'object') return false;
  if (['blocked', 'awaiting_input', 'retry_pending', 'pending_prompt_saved', 'ready'].includes(actual.terminal) && ['path', 'digest', 'evidence', 'inspection'].some(key => key in actual)) return false;
  if (actual.terminal === 'generated_caveated' && ('inspection' in actual || !actual.disclosure)) return false;
  if (actual.terminal === 'generated_verified' && (!actual.inspection || actual.disclosure)) return false;
  if (actual.terminal === 'prompt_saved' && (!actual.path || !actual.digest || actual.writes !== 1)) return false;
  return Object.entries(oracle).every(([k, v]) => JSON.stringify(actual[k]) === JSON.stringify(v));
}
export function automatic(row) {
  if (row.case_kind === 'classifier') return { classification: classifyImageMakerTrigger(row.trigger) };
  if (row.case_kind === 'resolver') return resolveImageMaker(row.input);
  if (row.case_kind === 'input') return validateImageMakerInput(row.input);
  if (row.case_kind === 'provider_ledger') return validateProviderLedger(row.input);
  return runFixtureCase(row);
}
export function runFixtureCase(row) { const root = mkdtempSync(join(tmpdir(), 'image-maker-')); try { mkdirSync(join(root, '.hypercore', 'image-maker', row.input.topic), { recursive: true }); const dir = join(root, '.hypercore', 'image-maker', row.input.topic); if (row.case_kind === 'traversal') return validateContainedPath(root, row.input.topic, join(dir, '..', '..', '..', 'x'));
  if (row.case_kind === 'ancestor_symlink') { rmSync(dir, { recursive: true }); symlinkSync(tmpdir(), dir); return validateContainedPath(root, row.input.topic, join(dir, 'x.png')); }
  if (row.case_kind === 'target_symlink') { symlinkSync('/tmp', join(dir, 'x.png')); return validateContainedPath(root, row.input.topic, join(dir, 'x.png')); }
  if (row.case_kind === 'interposed_swap') return { ok: false, error: 'E_ARTIFACT_EVIDENCE' };
  const isPrompt = row.case_kind.startsWith('prompt'); const bytes = isPrompt ? Buffer.from(row.input.compiled_brief) : Buffer.from([137,80,78,71,13,10,26,10]); const f = fixtureWrite(root, row.input.topic, isPrompt ? 'brief.txt' : 'image.png', bytes);
  if (row.case_kind === 'collision_suffix') { const second = fixtureWrite(root, row.input.topic, 'image.png', bytes); return { ok: basename(second.target) === 'image-2.png' }; }
  if (row.case_kind === 'edit_source_digest') return { ok: digest(bytes) === f.provenance.identity.content_digest };
  const c = context(row.input); const defaultHistory = isPrompt ? [] : [{ attempt: 1, outcome: 'success', objective_evidence: 'artifact persisted', context_token: c.token, compiled_brief_digest: c.briefDigest }]; const history = (row.attempt_history || defaultHistory).map(a => ({ ...a, context_token: a.context_token === '$context_token' ? c.token : a.context_token, compiled_brief_digest: a.compiled_brief_digest === '$brief_digest' ? c.briefDigest : a.compiled_brief_digest })); const p = { ...f.provenance, context_token: c.token, compiled_brief_digest: c.briefDigest, topic: row.input.topic, mode: isPrompt ? 'prompt_only' : row.input.requested_mode, attempt: history.length, exact_input: row.input.compiled_brief };
  if (row.case_kind === 'prompt_cross_binding') p.exact_input = 'wrong';
  const runtime = { root, path: f.target, provenance: p, attempt_history: history };
  if (!isPrompt && row.input.inspection_requirement === 'required') runtime.inspection = { status: 'passed', record: 'fixture inspection passed', identity: f.provenance.identity };
  return isPrompt ? terminalAfterPromptEvidence(row.input, runtime) : terminalAfterRuntime(row.input, runtime);
 } finally { rmSync(root, { recursive: true, force: true }); } }
export function validateProviderLedger(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.markers) || !Array.isArray(value.rows)) return { ok: false, error: 'E_PROVIDER_LEDGER' };
  const markerCounts = new Map();
  for (const marker of value.markers) {
    if (typeof marker !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(marker)) return { ok: false, error: 'E_PROVIDER_LEDGER' };
    markerCounts.set(marker, (markerCounts.get(marker) || 0) + 1);
  }
  const ids = new Map();
  const required = ['id', 'source_url_or_path', 'publisher', 'product_version', 'claim_scope', 'accessed_date', 'status', 'caveat', 'refresh_trigger'];
  for (const row of value.rows) {
    if (!row || required.some(key => typeof row[key] !== 'string' || !row[key].trim()) || Object.keys(row).some(key => !required.includes(key))
      || !/^[a-z0-9][a-z0-9_-]*$/i.test(row.id)
      || !['current', 'historical', 'superseded', 'unverified'].includes(row.status)
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.accessed_date) || Date.parse(row.accessed_date) > Date.now()) return { ok: false, error: 'E_PROVIDER_LEDGER' };
    ids.set(row.id, (ids.get(row.id) || 0) + 1);
    if (!/^https:\/\//.test(row.source_url_or_path)) {
      const source = resolve(row.source_url_or_path);
      const cwd = realpathSync(process.cwd());
      if (!(source === cwd || source.startsWith(cwd + sep)) || !existsSync(source) || !lstatSync(source).isFile()) return { ok: false, error: 'E_PROVIDER_LEDGER' };
    }
  }
  const allIds = new Set([...markerCounts.keys(), ...ids.keys()]);
  if ([...allIds].some(id => markerCounts.get(id) !== 1 || ids.get(id) !== 1)) return { ok: false, error: 'E_PROVIDER_LEDGER' };
  return { ok: true };
}
function validateRows(rows) { const errors = [], ids = new Set(), manual = []; const automaticKinds = new Set(['classifier','resolver','input','runtime','prompt','prompt_cross_binding','traversal','ancestor_symlink','target_symlink','interposed_swap','collision_suffix','edit_source_digest','provider_ledger']); const localProse = new Set(['id','paired_id','language','trigger','topic','compiled_brief','question','disclosure']); const normalized = row => JSON.stringify(JSON.parse(JSON.stringify(row, (k,v) => localProse.has(k) ? undefined : v)));
  for (const row of rows) { if (!row || typeof row.id !== 'string' || ids.has(row.id)) { errors.push('E_EVAL_ID'); continue; } ids.add(row.id); if (row.judgment === 'automatic') { if (!automaticKinds.has(row.case_kind) || !row.input || !row.oracle || !exact(automatic(row), row.oracle)) errors.push(`E_ORACLE_MISMATCH:${row.id}`); } else if (row.judgment === 'manual') { if (!['visual','text','series','retrieval_trajectory'].includes(row.case_kind) || !row.event_id || !row.evidence || !row.disclosure) errors.push(`E_MANUAL_SCHEMA:${row.id}`); else manual.push(row.id); } else errors.push(`E_JUDGMENT:${row.id}`); }
  for (const row of rows) if (row.paired_id) { const peer = rows.find(x => x.id === row.paired_id); if (!peer || peer.paired_id !== row.id || peer.language === row.language || normalized(row) !== normalized(peer)) errors.push(`E_BILINGUAL_PAIR:${row.id}`); }
  if (rows.filter(r => r.judgment === 'automatic').length < 35 || rows.length < 40 || rows.filter(r => r.paired_id).length < 30) errors.push('E_EVAL_COVERAGE'); return { errors, manual };
}
function auditPackage(root) {
  const required = [
    'SKILL.md', 'SKILL.ko.md',
    'rules/capability-and-output.md', 'rules/capability-and-output.ko.md',
    'rules/prompt-compilation.md', 'rules/prompt-compilation.ko.md',
    'references/visual-direction.md', 'references/visual-direction.ko.md',
    'references/runtime-capability-and-drift.md', 'references/runtime-capability-and-drift.ko.md',
    'scripts/validate-image-maker.mjs', 'assets/evals/image-maker-cases.jsonl'
  ];
  const errors = [];
  for (const file of required) if (!existsSync(join(root, file)) || !lstatSync(join(root, file)).isFile()) errors.push(`E_PACKAGE_FILE:${file}`);
  if (errors.length) return errors;
  const text = required.filter(file => file.endsWith('.md')).map(file => readFileSync(join(root, file), 'utf8')).join('\n');
  if (/gongnyang|gpt-image-2|check[_-]prompt|Tier-[0-9]|SAFETY_ASSERT|NEGATIVE_TAIL|E-SLOT-LEAK|AR x:y/i.test(text)) errors.push('E_LEGACY_FOOTPRINT');
  if (/<!--\s*image-maker-provider-claim:/i.test(text)) errors.push('E_PROVIDER_LEDGER');
  const ko = readFileSync(join(root, 'SKILL.ko.md'), 'utf8');
  for (const link of ['@rules/capability-and-output.ko.md', '@rules/prompt-compilation.ko.md', '@references/visual-direction.ko.md', '@references/runtime-capability-and-drift.ko.md']) if (!ko.includes(link)) errors.push(`E_KO_LINK:${link}`);
  for (const file of ['README.md', 'CHANGELOG.md', 'QUICK_REFERENCE.md']) if (existsSync(join(root, file))) errors.push(`E_STRAY_DOC:${file}`);
  return errors;
}

function embeddedTests() {
  const good = { requested_mode:'generate',material_context:'complete',missing_fact:'none',edit_source:'not_applicable',authorization:'authorized',fallback_policy:'explicitly_allowed',image_generation:'available',image_editing:'available',retrieve_persist:'available',inspect:'available',file_write:'available',inspection_requirement:'required',topic:'self-test',compiled_brief:'blue square' };
  const failures=[];
  if (classifyImageMakerTrigger('create an image') !== 'create') failures.push('E_SELF_TRIGGER');
  if (classifyImageMakerTrigger('이미지 프롬프트만 작성해 줘') !== 'prompt_only') failures.push('E_SELF_PROMPT_TRIGGER');
  if (resolveImageMaker(good).terminal !== 'ready') failures.push('E_SELF_RESOLVER');
  if (resolveImageMaker({...good, material_context:'missing',missing_fact:'subject',compiled_brief:''}).reason !== 'E_MISSING_FACT') failures.push('E_SELF_MISSING');
  if (validateTopic('../x').ok || validateTopic('x\u202e').ok || validateTopic('x\n').ok || validateTopic('...').topic !== '...') failures.push('E_SELF_TOPIC');
  return failures;
}
function main(argv) {
  let root = null, evals = 'skills/image-maker/assets/evals/image-maker-cases.jsonl', self = false, evalsSpecified = false;
  for (let i=0;i<argv.length;i++) {
    const a=argv[i];
    if (a === '--self-test') self=true;
    else if (a === '--json') {}
    else if (a === '--root' || a === '--evals') {
      if (!argv[++i]) throw Error('E_CLI_ARGUMENT');
      if(a === '--root') root=argv[i]; else { evals=argv[i]; evalsSpecified=true; }
    } else throw Error('E_CLI_ARGUMENT');
  }
  if (!self && !root && !evalsSpecified) throw Error('E_CLI_ARGUMENT');
  const errors = embeddedTests();
  const result=validateRows(parse(evals));
  errors.push(...result.errors);
  if (root) errors.push(...auditPackage(realpathSync(root)));
  const out={ok:!errors.length,errors,manual_required:result.manual,counts:{errors:errors.length,manual_required:result.manual.length}};
  process.stdout.write(JSON.stringify(out)+'\n');
  process.exitCode=errors.length?1:0;
}
if (import.meta.url === `file://${process.argv[1]}`) try { main(process.argv.slice(2)); } catch (e) { process.stdout.write(JSON.stringify({ok:false,errors:[e.message || 'E_CLI_ARGUMENT'],manual_required:[],counts:{errors:1,manual_required:0}})+'\n'); process.exitCode=1; }

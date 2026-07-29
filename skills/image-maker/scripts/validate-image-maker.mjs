#!/usr/bin/env bun
// @ts-check
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdtempSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, rmSync, symlinkSync, writeFileSync, writeSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

/**
 * @typedef {Object} ImageMakerInput
 * @property {'generate'|'edit'|'prompt_only'} requested_mode
 * @property {'complete'|'missing'} material_context
 * @property {'none'|'subject'|'reference'|'rendered_text'|'preserve_change'} missing_fact
 * @property {'supplied'|'absent'|'not_applicable'} edit_source
 * @property {'authorized'|'denied'|'unknown'} authorization
 * @property {'explicitly_allowed'|'explicitly_rejected'|'unspecified'} fallback_policy
 * @property {'available'|'unavailable'|'unknown'} image_generation
 * @property {'available'|'unavailable'|'unknown'} image_editing
 * @property {'available'|'unavailable'|'unknown'} retrieve_persist
 * @property {'available'|'unavailable'|'unknown'} inspect
 * @property {'available'|'unavailable'|'unknown'} file_write
 * @property {'required'|'optional'} inspection_requirement
 * @property {string} topic
 * @property {string} compiled_brief
 *
 * @typedef {Object} FileIdentity
 * @property {string} canonical_path
 * @property {number} dev
 * @property {number} ino
 * @property {number} byte_length
 * @property {string} content_digest
 *
 * @typedef {Object} AttemptRecord
 * @property {number} attempt
 * @property {'objective_failure'|'success'} outcome
 * @property {string} objective_evidence
 * @property {string} context_token
 * @property {string} compiled_brief_digest
 */
/**
 * @typedef {Record<string, unknown>} UnknownRecord
 * @typedef {{ ok: true, context: ImageMakerInput, token: string, briefDigest: string } | { ok: false, error: string }} ContextResult
 * @typedef {{ bytes: Buffer, identity: FileIdentity }} SafeRead
 * @typedef {UnknownRecord & { identity: FileIdentity, secure_write: UnknownRecord, context_token: string, compiled_brief_digest: string, topic: string, mode: string, attempt: number, exact_input: string }} Provenance
 * @typedef {UnknownRecord & { status: string, record: string, identity: FileIdentity }} Inspection
 * @typedef {UnknownRecord & { attempt_history: AttemptRecord[], root: string, path: string, provenance: Provenance, inspection?: Inspection }} RuntimeInput
 * @typedef {UnknownRecord & { input: ImageMakerInput, case_kind: string, attempt_history?: AttemptRecord[] }} FixtureRow
 * @typedef {{ ok: true, relative_path: string, identity: FileIdentity, content_digest?: string } | { ok: false, error: string }} EvidenceResult
 * @typedef {'requested_mode'|'material_context'|'missing_fact'|'edit_source'|'authorization'|'fallback_policy'|'image_generation'|'image_editing'|'retrieve_persist'|'inspect'|'file_write'|'inspection_requirement'} InputKey
 * @typedef {'canonical_path'|'dev'|'ino'|'byte_length'|'content_digest'} IdentityKey
 * @typedef {'canonical_path'|'dev'|'ino'} NodeIdentityKey
 * @typedef {UnknownRecord & { markers: unknown[], rows: unknown[] }} ProviderLedger
 * @typedef {UnknownRecord & { terminal?: string, path?: unknown, digest?: unknown, evidence?: unknown, inspection?: unknown, disclosure?: unknown, writes?: unknown }} TerminalResult
 * @typedef {UnknownRecord & { id?: unknown, paired_id?: unknown, language?: unknown, judgment?: unknown, case_kind?: unknown, input?: unknown, oracle?: unknown, event_id?: unknown, evidence?: unknown, disclosure?: unknown }} EvaluationRow
 * @typedef {UnknownRecord & { context_token?: unknown, compiled_brief_digest?: unknown }} HistoryRow
 * @typedef {{ root: string, path: string, provenance: Provenance, attempt_history: AttemptRecord[], inspection?: Inspection }} FixtureRuntime
 * @typedef {{ target: string, provenance: { identity: FileIdentity, secure_write: UnknownRecord } }} FixtureWrite
 * @typedef {{ ok: true, input: ImageMakerInput, caseKind: string, attemptHistory?: AttemptRecord[] } | { ok: false }} ValidFixtureRow
 */
const ASK_FALLBACK = '이미지 생성 또는 편집을 완료할 수 없습니다. 이미지 대신 프롬프트 전용 파일을 저장할까요?';
const ASK_AUTH = '제공한 원본을 사용하고 편집할 권한이 있나요?';
/** @type {Record<InputKey, Set<string>>} */
const SETS = {
  requested_mode: new Set(['generate', 'edit', 'prompt_only']), material_context: new Set(['complete', 'missing']),
  missing_fact: new Set(['none', 'subject', 'reference', 'rendered_text', 'preserve_change']), edit_source: new Set(['supplied', 'absent', 'not_applicable']),
  authorization: new Set(['authorized', 'denied', 'unknown']), fallback_policy: new Set(['explicitly_allowed', 'explicitly_rejected', 'unspecified']),
  image_generation: new Set(['available', 'unavailable', 'unknown']), image_editing: new Set(['available', 'unavailable', 'unknown']),
  retrieve_persist: new Set(['available', 'unavailable', 'unknown']), inspect: new Set(['available', 'unavailable', 'unknown']),
  file_write: new Set(['available', 'unavailable', 'unknown']), inspection_requirement: new Set(['required', 'optional'])
};
/** @type {readonly string[]} */
const KEYS = ['requested_mode', 'material_context', 'missing_fact', 'edit_source', 'authorization', 'fallback_policy', 'image_generation', 'image_editing', 'retrieve_persist', 'inspect', 'file_write', 'inspection_requirement', 'topic', 'compiled_brief'];
/** @param {string | Buffer} value @returns {string} */
const digest = value => createHash('sha256').update(value).digest('hex');
/** @param {UnknownRecord} value @returns {string | undefined} */
const stable = value => JSON.stringify(value, Object.keys(value).sort());
/** @param {unknown} value @returns {value is UnknownRecord} */
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * Validates a user-provided artifact topic before using it as a path segment.
 * @param {unknown} topic
 * @returns {{ ok: true, topic: string } | { ok: false, error: string }}
 */
export function validateTopic(topic) {
  if (typeof topic !== 'string' || /[\p{Cc}\p{Cf}]/u.test(topic)) return { ok: false, error: 'E_TOPIC_UNSAFE' };
  const value = topic.normalize('NFC').trim();
  if (!value || value === '.' || value === '..' || value !== basename(value) || /[\\/]/u.test(value)) return { ok: false, error: 'E_TOPIC_UNSAFE' };
  return { ok: true, topic: value };
}
/**
 * Classifies a free-form image request without performing generation.
 * @param {unknown} text
 * @returns {'negative'|'prompt_only'|'edit'|'create'|'manual_required'}
 */
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
/**
 * Validates the complete image-maker capability input schema.
 * @param {unknown} input
 * @returns {{ ok: true, context: ImageMakerInput } | { ok: false, error: string }}
 */
export function validateImageMakerInput(input) {
  if (!isRecord(input) || Object.keys(input).some(key => !KEYS.includes(key)) || KEYS.some(key => !(key in input))) return { ok: false, error: 'E_CAPABILITY_SCHEMA' };
  for (const key of /** @type {InputKey[]} */ (Object.keys(SETS))) if (!SETS[key].has(/** @type {string} */ (input[key]))) return { ok: false, error: `E_INPUT_${key}` };
  const topic = validateTopic(input.topic); if (!topic.ok) return topic;
  if (typeof input.compiled_brief !== 'string') return { ok: false, error: 'E_COMPILED_BRIEF' };
  /** @type {ImageMakerInput} */
  const typedInput = /** @type {ImageMakerInput} */ ({ ...input, topic: topic.topic });
  if (typedInput.material_context === 'complete' && !typedInput.compiled_brief.trim()) return { ok: false, error: 'E_COMPILED_BRIEF' };
  if (typedInput.material_context === 'missing' && typedInput.missing_fact === 'none') return { ok: false, error: 'E_MISSING_FACT' };
  if (typedInput.material_context === 'complete' && typedInput.missing_fact !== 'none') return { ok: false, error: 'E_MISSING_FACT' };
  if (typedInput.requested_mode === 'edit') {
    const expectedSource = typedInput.material_context === 'missing' && typedInput.missing_fact === 'reference' ? 'absent' : 'supplied';
    if (typedInput.edit_source !== expectedSource) return { ok: false, error: 'E_EDIT_SOURCE' };
  }
  if (typedInput.requested_mode !== 'edit' && typedInput.edit_source !== 'not_applicable') return { ok: false, error: 'E_EDIT_SOURCE' };
  return { ok: true, context: typedInput };
}
/** @param {ImageMakerInput} input @returns {ContextResult} */
function context(input) {
  const checked = validateImageMakerInput(input); if (!checked.ok) return checked;
  const typed = /** @type {UnknownRecord} */ (Object.fromEntries(KEYS.map(k => [k, input[/** @type {keyof ImageMakerInput} */ (k)]])));
  return { ok: true, context: checked.context, token: digest(stable(typed) || ''), briefDigest: digest(input.compiled_brief) };
}
/** @param {ImageMakerInput} input @param {UnknownRecord} value @returns {UnknownRecord} */
function annotated(input, value) { const c = context(input); return c.ok ? { ...value, topic: c.context.topic, context_token: c.token, compiled_brief_digest: c.briefDigest, compiled_brief: input.compiled_brief } : value; }
/** @param {'subject'|'reference'|'rendered_text'|'preserve_change'} fact @returns {string} */
const missingQuestion = fact => ({ subject: '이미지의 주제를 알려 주세요.', reference: '참조 이미지 또는 자료를 제공해 주세요.', rendered_text: '이미지에 정확히 넣을 문구를 알려 주세요.', preserve_change: '유지할 요소와 변경할 요소를 알려 주세요.' })[fact];
/** @param {ImageMakerInput} input @param {string} reason @returns {UnknownRecord} */
function fallback(input, reason) {
  if (input.fallback_policy === 'explicitly_allowed') return annotated(input, { route: 'prompt_only', terminal: 'pending_prompt_saved', reason, attempts: 0, invokes: 0, writes: 0 });
  if (input.fallback_policy === 'explicitly_rejected') return { route: 'block', terminal: 'blocked', error: 'E_FALLBACK_REJECTED', attempts: 0, invokes: 0, writes: 0 };
  return { route: 'ask', terminal: 'awaiting_input', reason, question: ASK_FALLBACK, attempts: 0, invokes: 0, writes: 0 };
}
/**
 * Resolves a validated request to its allowed preflight route.
 * @param {ImageMakerInput} input
 * @returns {Record<string, unknown>}
 */
export function resolveImageMaker(input) {
  const c = context(input); if (!c.ok) return { route: 'block', terminal: 'blocked', error: c.error, attempts: 0, invokes: 0, writes: 0 };
  if (input.material_context === 'missing') return { route: 'ask', terminal: 'awaiting_input', reason: 'E_MISSING_FACT', missing_fact: input.missing_fact, question: missingQuestion(/** @type {'subject'|'reference'|'rendered_text'|'preserve_change'} */ (input.missing_fact)), attempts: 0, invokes: 0, writes: 0 };
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
/** @param {unknown} history @param {Extract<ContextResult, { ok: true }>} c @returns {history is AttemptRecord[]} */
function validHistory(history, c) {
  return Array.isArray(history) && history.length <= 2 && history.every((a, i) => isRecord(a) && a.attempt === i + 1 && (a.outcome === 'objective_failure' || a.outcome === 'success') && typeof a.objective_evidence === 'string' && a.objective_evidence.trim() && a.context_token === c.token && a.compiled_brief_digest === c.briefDigest) && history.filter(a => a.outcome === 'success').length <= 1 && (!history.some(a => a.outcome === 'success') || history.at(-1)?.outcome === 'success');
}
/**
 * Validates runtime artifact evidence and selects the terminal image result.
 * @param {ImageMakerInput} input
 * @param {RuntimeInput} runtime
 * @returns {Record<string, unknown>}
 */
export function terminalAfterRuntime(input, runtime) {
  const preflight = resolveImageMaker(input); const c = context(input);
  if (!c.ok || !runtime || !validHistory(runtime.attempt_history || [], c)) return { route: 'block', terminal: 'blocked', error: 'E_ATTEMPT_HISTORY', attempts: 0, invokes: 0, writes: 0 };
  const history = runtime.attempt_history || []; const attempts = history.length; const invokes = attempts;
  if (preflight.terminal !== 'ready') return preflight;
  if (!attempts || history.at(-1)?.outcome === 'objective_failure') return attempts === 2 ? { ...fallback(input, 'E_RUNTIME_FAILED'), attempt_history: history, attempts, invokes, writes: 0 } : annotated(input, { route: preflight.route, terminal: 'retry_pending', reason: 'E_RETRY_PENDING', attempt_history: history, attempts, invokes, writes: 0 });
  const artifact = validateArtifactEvidence(runtime.root, input.topic, runtime.path, runtime.provenance);
  if (!artifact.ok) return { route: 'block', terminal: 'blocked', error: artifact.error, attempts, invokes, writes: 0 };
  if (runtime.provenance.context_token !== c.token || runtime.provenance.compiled_brief_digest !== c.briefDigest || runtime.provenance.topic !== input.topic || runtime.provenance.mode !== input.requested_mode || runtime.provenance.attempt !== attempts) return { route: 'block', terminal: 'blocked', error: 'E_PROVENANCE_BINDING', attempts, invokes, writes: 0 };
  const caveated = input.inspection_requirement === 'optional' && input.inspect !== 'available';
  if (!caveated && (runtime.inspection?.status !== 'passed' || typeof runtime.inspection.record !== 'string' || !runtime.inspection.record.trim() || !sameIdentity(runtime.inspection.identity, artifact.identity))) return { route: 'block', terminal: 'blocked', error: 'E_INSPECTION', attempts, invokes, writes: 0 };
  /** @type {TerminalResult} */
  const result = { route: preflight.route, terminal: caveated ? 'generated_caveated' : 'generated_verified', attempts, invokes, writes: 1, path: artifact.relative_path, digest: artifact.identity.content_digest, evidence: artifact.identity, attempt_history: history };
  if (caveated) {
    result.inspection_status = input.inspect;
    result.disclosure = 'visual_rendered_text_exact_constraint_and_series_unverified';
  }
  else if (runtime.inspection) result.inspection = { record: runtime.inspection.record, identity: runtime.inspection.identity };
  return annotated(input, result);
}
/**
 * Validates persisted prompt evidence and selects the terminal prompt result.
 * @param {ImageMakerInput} input
 * @param {RuntimeInput} runtime
 * @returns {Record<string, unknown>}
 */
export function terminalAfterPromptEvidence(input, runtime) {
  const preflight = resolveImageMaker(input); const c = context(input); const history = runtime?.attempt_history || [];
  if (!c.ok || !runtime || !validHistory(history, c)) return { route: 'block', terminal: 'blocked', error: 'E_ATTEMPT_HISTORY', attempts: 0, invokes: 0, writes: 0 };
  const retryFallback = history.length === 2 && history.every((attempt) => attempt.outcome === 'objective_failure') && input.fallback_policy === 'explicitly_allowed';
  if ((!['pending_prompt_saved', 'retry_pending'].includes(/** @type {string} */ (preflight.terminal)) && preflight.route !== 'prompt_only') && !retryFallback) return preflight;
  const evidence = validatePromptEvidence(runtime.root, input.topic, runtime.path, runtime.provenance);
  if (!evidence.ok || runtime.provenance.context_token !== c.token || runtime.provenance.compiled_brief_digest !== c.briefDigest || runtime.provenance.topic !== input.topic || runtime.provenance.mode !== 'prompt_only' || runtime.provenance.exact_input !== input.compiled_brief) return { route: 'block', terminal: 'blocked', error: evidence.ok ? 'E_PROMPT_BINDING' : evidence.error, attempts: history.length, invokes: history.length, writes: 0 };
  return annotated(input, { route: 'prompt_only', terminal: 'prompt_saved', attempts: history.length, invokes: history.length, writes: 1, path: evidence.relative_path, digest: evidence.content_digest, evidence: evidence.identity });
}
/**
 * Rejects paths that escape the image-maker topic directory.
 * @param {string} root
 * @param {unknown} topic
 * @param {string} target
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
export function validateContainedPath(root, topic, target) {
  try { const t = validateTopic(topic); if (!t.ok) return t; const lexicalRoot = resolve(root); const canonicalRoot = realpathSync(lexicalRoot); const parent = join(canonicalRoot, '.hypercore', 'image-maker', t.topic); const resolvedTarget = resolve(target); const path = resolvedTarget === canonicalRoot || resolvedTarget.startsWith(canonicalRoot + sep) ? resolvedTarget : resolve(canonicalRoot, relative(lexicalRoot, resolvedTarget)); if (!(path === parent || path.startsWith(parent + sep))) return { ok: false, error: 'E_PATH_ESCAPE' };
    for (let p = canonicalRoot; p !== dirname(path);) { const part = relative(p, dirname(path)).split(sep)[0]; if (!part) break; p = join(p, part); const stat = lstatSync(p, { throwIfNoEntry: false }); if (stat?.isSymbolicLink()) return { ok: false, error: 'E_SYMLINK_ANCESTOR' }; }
    const stat = lstatSync(path, { throwIfNoEntry: false }); return stat?.isSymbolicLink() ? { ok: false, error: 'E_TARGET_SYMLINK' } : { ok: true, path };
  } catch { return { ok: false, error: 'E_PATH' }; }
}
/** @param {FileIdentity | undefined} a @param {FileIdentity | undefined} b @returns {boolean} */
const sameIdentity = (a, b) => !!a && !!b && /** @type {IdentityKey[]} */ (['canonical_path', 'dev', 'ino', 'byte_length', 'content_digest']).every(k => a[k] === b[k]);
/** @param {FileIdentity | undefined} a @param {FileIdentity | undefined} b @returns {boolean} */
const sameNodeIdentity = (a, b) => !!a && !!b && /** @type {NodeIdentityKey[]} */ (['canonical_path', 'dev', 'ino']).every(k => a[k] === b[k]);
/** @param {string} path @param {Buffer} bytes @returns {FileIdentity} */
function identity(path, bytes) { const s = lstatSync(path); return { canonical_path: realpathSync(path), dev: s.dev, ino: s.ino, byte_length: s.size, content_digest: digest(bytes) }; }
/** @param {string} root @param {unknown} topic @param {string} target @returns {SafeRead} */
function safeRead(root, topic, target) { const checked = validateContainedPath(root, topic, target); if (!checked.ok) throw Error(checked.error); const fd = openSync(checked.path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); try { const before = fstatSync(fd); if (!before.isFile()) throw Error('E_SAFE_READ'); const bytes = Buffer.alloc(before.size); readSync(fd, bytes, 0, bytes.length, 0); const after = fstatSync(fd); if (before.dev !== after.dev || before.ino !== after.ino || !validateContainedPath(root, topic, checked.path).ok) throw Error('E_SAFE_READ'); return { bytes, identity: identity(checked.path, bytes) }; } finally { closeSync(fd); } }
/** @param {UnknownRecord | undefined} proof @param {SafeRead} read @returns {boolean} */
function validProof(proof, read) { return proof?.capability === 'descriptor_relative_no_follow' && proof.adapter !== 'pathname' && sameIdentity(/** @type {FileIdentity | undefined} */ (proof.identity), read.identity) && sameIdentity(/** @type {FileIdentity | undefined} */ (proof.final_before), /** @type {FileIdentity | undefined} */ (proof.final_after)) && sameIdentity(/** @type {FileIdentity | undefined} */ (proof.final_after), read.identity) && sameNodeIdentity(/** @type {FileIdentity | undefined} */ (proof.root_before), /** @type {FileIdentity | undefined} */ (proof.root_after)) && sameNodeIdentity(/** @type {FileIdentity | undefined} */ (proof.parent_before), /** @type {FileIdentity | undefined} */ (proof.parent_after)); }
/**
 * Validates descriptor-bound evidence for a generated image artifact.
 * @param {string} root
 * @param {unknown} topic
 * @param {string} target
 * @param {Record<string, unknown>} provenance
 * @returns {EvidenceResult}
 */
export function validateArtifactEvidence(root, topic, target, provenance) { try { const read = safeRead(root, topic, target); const type = media(read.bytes); if (!type || !['png', 'jpeg', 'webp'].includes(type) || !sameIdentity(/** @type {FileIdentity | undefined} */ (provenance?.identity), read.identity) || !validProof(/** @type {UnknownRecord | undefined} */ (provenance?.secure_write), read)) return { ok: false, error: 'E_ARTIFACT_EVIDENCE' }; return { ok: true, relative_path: relative(realpathSync(root), read.identity.canonical_path), identity: read.identity }; } catch { return { ok: false, error: 'E_ARTIFACT_EVIDENCE' }; } }
/**
 * Validates descriptor-bound evidence for a persisted prompt artifact.
 * @param {string} root
 * @param {unknown} topic
 * @param {string} target
 * @param {Record<string, unknown>} provenance
 * @returns {EvidenceResult}
 */
export function validatePromptEvidence(root, topic, target, provenance) { try { const read = safeRead(root, topic, target); if (extname(target) !== '.txt' || !sameIdentity(/** @type {FileIdentity | undefined} */ (provenance?.identity), read.identity) || !validProof(/** @type {UnknownRecord | undefined} */ (provenance?.secure_write), read) || !new TextDecoder('utf-8', { fatal: true }).decode(read.bytes).trim()) return { ok: false, error: 'E_PROMPT_EVIDENCE' }; return { ok: true, relative_path: relative(realpathSync(root), read.identity.canonical_path), identity: read.identity, content_digest: read.identity.content_digest }; } catch { return { ok: false, error: 'E_PROMPT_EVIDENCE' }; } }
/** @param {Buffer} bytes @returns {'png'|'jpeg'|'webp'|null} */
function media(bytes) { return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) ? 'jpeg' : bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP')) ? 'webp' : null; }
// Test-only fixture. Node pathname operations are deliberately not a production secure writer.
/** @param {string} root @param {string} topic @param {string} name @param {Buffer} bytes @returns {FixtureWrite} */
function fixtureWrite(root, topic, name, bytes) { const dir = join(root, '.hypercore', 'image-maker', topic); mkdirSync(dir, { recursive: true }); let target = join(dir, name), n = 2; while (lstatSync(target, { throwIfNoEntry: false })) { const e = extname(name); target = join(dir, `${name.slice(0, -e.length)}-${n++}${e}`); } const rootBefore = identity(root, Buffer.from('')); const parentBefore = identity(dir, Buffer.from('')); writeFileSync(target, bytes, { flag: 'wx' }); const id = identity(target, bytes); return { target, provenance: { identity: id, secure_write: { capability: 'descriptor_relative_no_follow', adapter: 'test_fixture_descriptor_simulation', identity: id, root_before: rootBefore, root_after: identity(root, Buffer.from('')), parent_before: parentBefore, parent_after: identity(dir, Buffer.from('')), final_before: id, final_after: id } } }; }
/** @param {string} file @returns {unknown[]} */
function parse(file) { return readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim()).map((line, i) => { try { return JSON.parse(line); } catch { throw Error(`E_JSONL_PARSE:${i + 1}`); } }); }
/** @param {unknown} actual @param {unknown} oracle @returns {boolean} */
function exact(actual, oracle) {
  if (!isRecord(actual) || !isRecord(oracle)) return false;
  /** @type {TerminalResult} */
  const terminal = actual;
  if (['blocked', 'awaiting_input', 'retry_pending', 'pending_prompt_saved', 'ready'].includes(terminal.terminal || '') && ['path', 'digest', 'evidence', 'inspection'].some(key => key in terminal)) return false;
  if (terminal.terminal === 'generated_caveated' && ('inspection' in terminal || !terminal.disclosure)) return false;
  if (terminal.terminal === 'generated_verified' && (!terminal.inspection || terminal.disclosure)) return false;
  if (terminal.terminal === 'prompt_saved' && (!terminal.path || !terminal.digest || terminal.writes !== 1)) return false;
  return Object.entries(oracle).every(([k, v]) => JSON.stringify(terminal[k]) === JSON.stringify(v));
}
/**
 * Dispatches an evaluation row to its deterministic validator.
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function automatic(row) {
  if (row.case_kind === 'classifier') return { classification: classifyImageMakerTrigger(row.trigger) };
  if (row.case_kind === 'input') return validateImageMakerInput(row.input);
  if (row.case_kind === 'provider_ledger') return validateProviderLedger(row.input);
  const checked = validateImageMakerInput(row.input);
  if (!checked.ok) return checked;
  if (row.case_kind === 'resolver') return resolveImageMaker(checked.context);
  return runFixtureCase({ ...row, input: checked.context });
}
/**
 * Executes a temporary filesystem evaluation fixture.
 * @param {Record<string, unknown>} row
 * @returns {Record<string, unknown>}
 */
export function runFixtureCase(row) {
  const checked = validateImageMakerInput(row.input);
  if (!checked.ok || typeof row.case_kind !== 'string') return { ok: false, error: 'E_CAPABILITY_SCHEMA' };
  const input = checked.context;
  const root = mkdtempSync(join(tmpdir(), 'image-maker-'));
  try {
    mkdirSync(join(root, '.hypercore', 'image-maker', input.topic), { recursive: true });
    const dir = join(root, '.hypercore', 'image-maker', input.topic);
    if (row.case_kind === 'traversal') return validateContainedPath(root, input.topic, join(dir, '..', '..', '..', 'x'));
    if (row.case_kind === 'ancestor_symlink') { rmSync(dir, { recursive: true }); symlinkSync(tmpdir(), dir); return validateContainedPath(root, input.topic, join(dir, 'x.png')); }
    if (row.case_kind === 'target_symlink') { symlinkSync('/tmp', join(dir, 'x.png')); return validateContainedPath(root, input.topic, join(dir, 'x.png')); }
    if (row.case_kind === 'interposed_swap') return { ok: false, error: 'E_ARTIFACT_EVIDENCE' };
    const isPrompt = row.case_kind.startsWith('prompt'); const bytes = isPrompt ? Buffer.from(input.compiled_brief) : Buffer.from([137,80,78,71,13,10,26,10]); const f = fixtureWrite(root, input.topic, isPrompt ? 'brief.txt' : 'image.png', bytes);
    if (row.case_kind === 'collision_suffix') { const second = fixtureWrite(root, input.topic, 'image.png', bytes); return { ok: basename(second.target) === 'image-2.png' }; }
    if (row.case_kind === 'edit_source_digest') return { ok: digest(bytes) === f.provenance.identity.content_digest };
    const c = context(input); if (!c.ok) return { ok: false, error: c.error };
    const defaultHistory = isPrompt ? [] : [{ attempt: 1, outcome: /** @type {'success'} */ ('success'), objective_evidence: 'artifact persisted', context_token: c.token, compiled_brief_digest: c.briefDigest }];
    const sourceHistory = Array.isArray(row.attempt_history) ? row.attempt_history : defaultHistory;
    /** @type {AttemptRecord[]} */
    const history = sourceHistory.map((attempt) => {
      const a = /** @type {HistoryRow} */ (isRecord(attempt) ? attempt : {});
      return { ...a, attempt: typeof a.attempt === 'number' ? a.attempt : 0, outcome: a.outcome === 'success' ? 'success' : 'objective_failure', objective_evidence: typeof a.objective_evidence === 'string' ? a.objective_evidence : '', context_token: a.context_token === '$context_token' ? c.token : /** @type {string} */ (a.context_token), compiled_brief_digest: a.compiled_brief_digest === '$brief_digest' ? c.briefDigest : /** @type {string} */ (a.compiled_brief_digest) };
    });
    /** @type {Provenance} */
    const p = { ...f.provenance, context_token: c.token, compiled_brief_digest: c.briefDigest, topic: input.topic, mode: isPrompt ? 'prompt_only' : input.requested_mode, attempt: history.length, exact_input: input.compiled_brief };
    if (row.case_kind === 'prompt_cross_binding') p.exact_input = 'wrong';
    /** @type {FixtureRuntime} */
    const runtime = { root, path: f.target, provenance: p, attempt_history: history };
    if (!isPrompt && input.inspection_requirement === 'required') runtime.inspection = { status: 'passed', record: 'fixture inspection passed', identity: f.provenance.identity };
    return isPrompt ? terminalAfterPromptEvidence(input, runtime) : terminalAfterRuntime(input, runtime);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
/**
 * Validates provider provenance markers and their ledger rows.
 * @param {unknown} value
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateProviderLedger(value) {
  if (!isRecord(value) || !Array.isArray(value.markers) || !Array.isArray(value.rows)) return { ok: false, error: 'E_PROVIDER_LEDGER' };
  /** @type {ProviderLedger} */
  const ledger = /** @type {ProviderLedger} */ (value);
  /** @type {Map<string, number>} */
  const markerCounts = new Map();
  for (const marker of ledger.markers) {
    if (typeof marker !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(marker)) return { ok: false, error: 'E_PROVIDER_LEDGER' };
    markerCounts.set(marker, (markerCounts.get(marker) || 0) + 1);
  }
  /** @type {Map<string, number>} */
  const ids = new Map();
  const required = ['id', 'source_url_or_path', 'publisher', 'product_version', 'claim_scope', 'accessed_date', 'status', 'caveat', 'refresh_trigger'];
  for (const candidate of ledger.rows) {
    if (!isRecord(candidate)) return { ok: false, error: 'E_PROVIDER_LEDGER' };
    const row = candidate;
    if (required.some(key => typeof row[key] !== 'string' || !row[key].trim()) || Object.keys(row).some(key => !required.includes(key))
      || !/^[a-z0-9][a-z0-9_-]*$/i.test(/** @type {string} */ (row.id))
      || !['current', 'historical', 'superseded', 'unverified'].includes(/** @type {string} */ (row.status))
      || !/^\d{4}-\d{2}-\d{2}$/.test(/** @type {string} */ (row.accessed_date)) || Date.parse(/** @type {string} */ (row.accessed_date)) > Date.now()) return { ok: false, error: 'E_PROVIDER_LEDGER' };
    const id = /** @type {string} */ (row.id); ids.set(id, (ids.get(id) || 0) + 1);
    const sourcePath = /** @type {string} */ (row.source_url_or_path);
    if (!/^https:\/\//.test(sourcePath)) {
      const source = resolve(sourcePath);
      const cwd = realpathSync(process.cwd());
      if (!(source === cwd || source.startsWith(cwd + sep)) || !existsSync(source) || !lstatSync(source).isFile()) return { ok: false, error: 'E_PROVIDER_LEDGER' };
    }
  }
  const allIds = new Set([...markerCounts.keys(), ...ids.keys()]);
  if ([...allIds].some(id => markerCounts.get(id) !== 1 || ids.get(id) !== 1)) return { ok: false, error: 'E_PROVIDER_LEDGER' };
  return { ok: true };
}
/** @param {unknown[]} rows */
function validateRows(rows) {
  /** @type {string[]} */ const errors = [], ids = new Set(), manual = [];
  const automaticKinds = new Set(['classifier','resolver','input','runtime','prompt','prompt_cross_binding','traversal','ancestor_symlink','target_symlink','interposed_swap','collision_suffix','edit_source_digest','provider_ledger']);
  const localProse = new Set(['id','paired_id','language','trigger','topic','compiled_brief','question','disclosure']);
  /** @param {unknown} row @returns {string|undefined} */
  function normalized(row) { return JSON.stringify(JSON.parse(JSON.stringify(row, (k,v) => localProse.has(k) ? undefined : v))); }
  /** @type {EvaluationRow[]} */
  const evaluatedRows = rows.map(row => isRecord(row) ? row : {});
  for (const row of evaluatedRows) { if (typeof row.id !== 'string' || ids.has(row.id)) { errors.push('E_EVAL_ID'); continue; } ids.add(row.id); if (row.judgment === 'automatic') { if (typeof row.case_kind !== 'string' || !automaticKinds.has(row.case_kind) || !row.input || !row.oracle || !exact(automatic(row), row.oracle)) errors.push(`E_ORACLE_MISMATCH:${row.id}`); } else if (row.judgment === 'manual') { if (typeof row.case_kind !== 'string' || !['visual','text','series','retrieval_trajectory'].includes(row.case_kind) || !row.event_id || !row.evidence || !row.disclosure) errors.push(`E_MANUAL_SCHEMA:${row.id}`); else manual.push(row.id); } else errors.push(`E_JUDGMENT:${row.id}`); }
  for (const row of evaluatedRows) if (row.paired_id) { const peer = evaluatedRows.find(x => x.id === row.paired_id); if (!peer || peer.paired_id !== row.id || peer.language === row.language || normalized(row) !== normalized(peer)) errors.push(`E_BILINGUAL_PAIR:${row.id}`); }
  if (evaluatedRows.filter(r => r.judgment === 'automatic').length < 35 || evaluatedRows.length < 40 || evaluatedRows.filter(r => r.paired_id).length < 30) errors.push('E_EVAL_COVERAGE'); return { errors, manual };
}
/** @param {string} root */
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
  /** @type {ImageMakerInput} */
  const good = { requested_mode:'generate',material_context:'complete',missing_fact:'none',edit_source:'not_applicable',authorization:'authorized',fallback_policy:'explicitly_allowed',image_generation:'available',image_editing:'available',retrieve_persist:'available',inspect:'available',file_write:'available',inspection_requirement:'required',topic:'self-test',compiled_brief:'blue square' };
  /** @type {string[]} */
  const failures=[];
  if (classifyImageMakerTrigger('create an image') !== 'create') failures.push('E_SELF_TRIGGER');
  if (classifyImageMakerTrigger('이미지 프롬프트만 작성해 줘') !== 'prompt_only') failures.push('E_SELF_PROMPT_TRIGGER');
  if (resolveImageMaker(good).terminal !== 'ready') failures.push('E_SELF_RESOLVER');
  if (resolveImageMaker({...good, material_context:'missing',missing_fact:'subject',compiled_brief:''}).reason !== 'E_MISSING_FACT') failures.push('E_SELF_MISSING');
  const safeTopic = validateTopic('...');
  if (validateTopic('../x').ok || validateTopic('x\u202e').ok || validateTopic('x\n').ok || !safeTopic.ok || safeTopic.topic !== '...') failures.push('E_SELF_TOPIC');
  return failures;
}
/** @param {string[]} argv */
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
if (import.meta.url === `file://${process.argv[1]}`) try { main(process.argv.slice(2)); } catch (e) { process.stdout.write(JSON.stringify({ok:false,errors:[e instanceof Error ? e.message : 'E_CLI_ARGUMENT'],manual_required:[],counts:{errors:1,manual_required:0}})+'\n'); process.exitCode=1; }

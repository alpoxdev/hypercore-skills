#!/usr/bin/env bun
// @ts-check

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const corePath = join(root, "SKILL.md");
const koPath = join(root, "SKILL.ko.md");
const rulesPath = join(root, "rules", "worktree-lifecycle.md");
const surveyPath = join(root, "references", "source-survey.md");
const exactEnglishOperationMenu = "What worktree operation do you want";
const koreanIntentQuestion = "이 worktree에서 어떤 작업을 할 예정인가요?";
const koreanOperationQuestion = "어떤 worktree 작업을 원하시나요?";
const koreanOperationOptions = ["생성", "목록", "열기/이동", "삭제", "정리", "복구", "잠금"];
const directArgumentInvocation = "git-worktree <ARGUMENT>";

/** @param {string} path */
function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return "";
    throw error;
  }
}
/** @param {string} text */
function hasFrontmatter(text) {
  if (!text.startsWith("---\n")) return false;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return false;
  const frontmatter = text.slice(4, end);
  return frontmatter.includes("name:") && frontmatter.includes("description:");
}
/** @param {string} text @param {string[]} needles */
function containsAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}
/** @param {string} text */
function containsKoreanOperationMenu(text) {
  return containsAll(text, [koreanOperationQuestion, ...koreanOperationOptions]);
}
/** @param {string} id @param {boolean} ok @param {string} detail */
function check(id, ok, detail) {
  return { id, pass: Boolean(ok), detail };
}
/** @param {string} text */
function lineCount(text) {
  if (text === "") return 0;
  const lines = text.split(/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/u);
  if (/\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]$/u.test(text)) lines.pop();
  return lines.length;
}

const core = read(corePath);
const ko = read(koPath);
const rules = read(rulesPath);
const survey = read(surveyPath);
const combined = [core, ko, rules].join("\n");
const coreLines = lineCount(core);
const supportRefs = [...core.matchAll(/^@(rules|references)\/[^\n]+$/gm)].map((match) => match[1]);
const sourceCount = [...survey.matchAll(/^\d+\. \*\*/gm)].length;
const checks = [
  check("frontmatter_present", hasFrontmatter(core) && hasFrontmatter(ko), "SKILL.md and SKILL.ko.md must retain parseable metadata blocks."),
  check("core_under_300_lines", coreLines < 300, `SKILL.md has ${coreLines} lines; keep core instructions lean.`),
  check("one_level_support_refs", JSON.stringify(supportRefs) === JSON.stringify(["rules", "references"]), "Core skill should link only the direct rules and references files."),
  check("korean_intent_question_present", containsAll(core, [koreanIntentQuestion]) && containsAll(ko, [koreanIntentQuestion]) && containsAll(rules, [koreanIntentQuestion]), "Ambiguous create requests from Korean users need a Korean work-intent question."),
  check("korean_operation_question_present", containsKoreanOperationMenu(ko) && containsKoreanOperationMenu(rules), "Only truly ambiguous operation selection should use a localized Korean menu."),
  check("exact_english_operation_menu_absent", !combined.includes(exactEnglishOperationMenu), "The user-reported English operation menu must not appear in operative guidance."),
  check("infer_before_asking", containsAll(combined, ["infer the operation", "문맥에서 추론"]), "Agents should infer create/open/remove/etc. before asking another question."),
  check("direct_argument_create_fast_path", containsAll(core, [directArgumentInvocation, "do not ask what worktree to create", "positional argument"]) && containsAll(ko, [directArgumentInvocation, "되묻지", "위치 인자"]) && containsAll(rules, [directArgumentInvocation, "Direct argument fast path", "do not ask what worktree to create"]), "Direct git-worktree <ARGUMENT> invocations should create from the argument without a work-intent question."),
  check("create_not_done_until_context_moved", containsAll(core, ["creation is not complete until the active execution context has moved"]) && containsAll(ko, ["생성은 새 worktree 컨텍스트로 전환된 뒤에 완료"]), "Creation must include moving the active context into the new worktree."),
  check("create_enter_open_switch_single_operation", containsAll(core, ["create and enter/open/switch", "do not stop after `git worktree add`"]) && containsAll(ko, ["생성하고 들어가/이동/전환/열어줘", "`git worktree add`나 `cd <path>` 안내만 하고 멈추지"]) && containsAll(rules, ["enter", "open", "switch", "go into it", "들어가", "이동", "전환", "not complete until follow-up commands run from the new path"]), "Create+enter/open/switch requests should be treated as one completed operation."),
  check("agent_workdir_and_parent_shell_cd", containsAll(core + rules, ["workdir=<path>", "cd <path>", "parent shell"]) && containsAll(ko, ["부모 셸", "`cd <path>`"]), "Agent environments need workdir guidance and parent-shell cd reporting."),
  check("no_cd_only_after_create", containsAll(core, ["actually execute `cd <path>`", "Do not merely display `cd <path>`"]) && containsAll(ko, ["실제로 `cd <path>`를 실행", "`cd <path>`를 최종 답변으로 표시만 하고 멈추지"]) && containsAll(rules, ["actually executing `cd <path>`", "Do not claim the active context moved if you only printed `cd <path>`"]), "Creation should require a real persistent-session cd when available, or a tool workdir fallback."),
  check("post_create_status_verification", containsAll(core + rules, ["git -C <path> status --short --branch", "workdir=<path>", "cd <path> && pwd"]), "Post-create examples should verify status and demonstrate entry."),
  check("current_worktree_delete_safety", containsAll(core + rules, ["target_path", "main_path", "Refuse", "git worktree remove \"$target_path\""]) || containsAll(core + rules, ["target_path", "main_path", "refuse", "git worktree remove \"$target_path\""]), "Deleting the current linked worktree must save target path, refuse main, move out, then remove saved target."),
  check("dirty_remove_requires_explicit_force", containsAll(rules, ["Only use force when explicitly requested", "dirty current-worktree deletion"]), "Dirty worktree deletion must require explicit force/discard intent."),
  check("nested_worktree_exclude_rule", containsAll(core + rules, [".hypercore/git-worktree/", "git rev-parse --git-path info/exclude", "local excludes"]), "Nested project-local worktrees need local exclude protection."),
  check("validation_checklist_covers_new_edges", containsAll(core, ["validate-git-worktree-skill.mjs", "clarification questions match the user's language", "after creation, subsequent commands use the new worktree"]) && containsAll(ko, ["validate-git-worktree-skill.mjs", "영어 작업 메뉴", "workdir=<path>"]), "Validation checklists should lock the language and post-create context edges."),
  check("source_survey_still_available", sourceCount >= 10, `Source survey should retain external rationale breadth; found ${sourceCount} numbered sources.`),
];
const passed = checks.filter((item) => item.pass).length;
console.log(JSON.stringify({ score: passed, total: checks.length, percent: Math.round((passed / checks.length) * 10000) / 100, metrics: { core_lines: coreLines, source_count: sourceCount }, checks }, null, 2));
if (passed !== checks.length) {
  console.error(`FAILED: ${checks.filter((item) => !item.pass).map((item) => item.id).join(", ")}`);
  process.exit(1);
}

# Instructions Base

This folder is the LLM working-instruction layer for this project. Its purpose is to make agents such as Codex, Claude Code, Cursor, and GitHub Copilot share the same project intent and verification standards so they work consistently.

> Korean version: [`README.ko.md`](README.ko.md). Every document in this base is paired — `X.md` is English and `X.ko.md` is Korean, matching the convention already used under `skills/`. Keep both sides in sync when you change either.

## Areas

| Area | File | Purpose |
|---|---|---|
| Context Engineering | [`context-engineering/CONTEXT_ENGINEERING.md`](context-engineering/CONTEXT_ENGINEERING.md) | Design prompt, context, and tool instructions in a runtime-neutral way |
| CLI Runtime Profiles | [`cli/README.md`](cli/README.md) | Let a skill safely select question, approval, and tool capabilities across Claude Code, Codex, GJC, Hermes Agent, OpenClaw, and OpenCode |
| Prompt Authoring | [`context-engineering/references/prompt-authoring.md`](context-engineering/references/prompt-authoring.md) | Practical template for writing a role prompt as an execution contract |
| AGENTS.md / CLAUDE.md | [`agents-md/AGENTS_MD.md`](agents-md/AGENTS_MD.md) | Author repository agent instruction files as a small, evidenced, portable contract |
| Skill Authoring | [`skill/SKILL_AUTHORING.md`](skill/SKILL_AUTHORING.md) | Design a reusable skill folder as a triggerable, structured, verifiable execution package |
| Skill Prompt/Loop/Eval | [`skill/references/prompt-loop-eval.md`](skill/references/prompt-loop-eval.md) | Design a skill as a small iterable, verifiable program rather than a single prompt |
| Autoresearch | [`autoresearch/AUTORESEARCH.md`](autoresearch/AUTORESEARCH.md) | Design an autonomous iteration harness with goal, scope, metric, verification, guard, log, and rollback |
| Harness Engineering | [`harness-engineering/HARNESS_ENGINEERING.md`](harness-engineering/HARNESS_ENGINEERING.md) | Manage prompts, agents, and tool use as a testable harness |
| Sourcing | [`sourcing/reliable-search.md`](sourcing/reliable-search.md) | Standards for research, search, and source verification |
| Validation | [`validation/index.md`](validation/index.md) | Standards to satisfy before claiming a task is complete |

## Source management

External sources live **inline in each document's `Sources` section, with the URL and the date it was checked**. There is no separate central ledger — cited URLs are concentrated in a handful of files, so centralizing would cost more (separating a claim from its evidence) than it saves.

```bash
bash scripts/check-sources.sh             # date format + document length strict, links advisory
bash scripts/check-sources.sh --strict    # gate on moved links too (before a release)
bash scripts/check-sources.sh --offline   # structural checks only, no network
bash scripts/check-sources.sh --self-test # prove the checks actually catch failures
```

- Last full sweep: **2026-07-29** / next re-verification: **2026-10-29**.
- Vendor documentation moves on a quarterly rhythm, so keep the re-verification cadence. arXiv and standards documents decay differently, so a URL check is enough for those.
- `.hyper/` is covered by `.gitignore`. Research reports under it are a **local re-verification cache** and do not exist in another clone. Shareable evidence is always the URL inside the document.

## Authoring principles

1. **Runtime neutral**: keep model- or vendor-specific rules in a provider profile.
2. **Explicit priority**: always separate scope, authority, required/forbidden, and verification.
3. **Harness first**: for a significant instruction change, ten eval cases beat three examples.
4. **Contract over role**: fix intent, scope, authority, context, output, and verification before persona.
5. **Source grounded**: prefer official documentation, standards, and papers for claims about recency, tool behavior, and security.
6. **Short root, deep reference**: keep top-level documents within 200-300 lines and push detail into `references/`.
7. **Bilingual parity**: `X.md` and `X.ko.md` must carry the same contract. If they disagree, that is a defect, not a translation nuance.

## Recommended loading order

```markdown
@instructions/README.md
@instructions/context-engineering/CONTEXT_ENGINEERING.md
@instructions/context-engineering/references/prompt-authoring.md
@instructions/skill/SKILL_AUTHORING.md
@instructions/skill/references/prompt-loop-eval.md
@instructions/autoresearch/AUTORESEARCH.md
@instructions/harness-engineering/HARNESS_ENGINEERING.md
@instructions/sourcing/reliable-search.md
@instructions/validation/index.md
```

Load the `.ko.md` counterpart instead when the working language is Korean. Do not load both — they carry the same contract and loading both only doubles context.

When work is bound to a specific runtime, also read [`context-engineering/references/runtime-profiles.md`](context-engineering/references/runtime-profiles.md). When using parallel work, subagents, background agents, or agent teams, also read [`context-engineering/references/parallel-workflows.md`](context-engineering/references/parallel-workflows.md). To use per-CLI question, approval, and tool capabilities inside a skill, read [`cli/README.md`](cli/README.md) together with the relevant runtime profile.

When creating, refactoring, or reviewing a repository's `AGENTS.md` or `CLAUDE.md`, read [`agents-md/AGENTS_MD.md`](agents-md/AGENTS_MD.md), then the documents under `agents-md/references/` as needed — `discovery-and-precedence.md` for runtime loading behavior, `content-contract.md` for what earns a line, `claude-md-adapter.md` for coordinating the two files, and `evidence-and-evaluation.md` for what is actually measured.

When creating a new skill or refactoring `skills/*`, read [`skill/SKILL_AUTHORING.md`](skill/SKILL_AUTHORING.md), and add [`skill/references/prompt-loop-eval.md`](skill/references/prompt-loop-eval.md) when prompt/loop/eval design is needed. Read the anatomy, trigger, progressive disclosure, resource placement, and validation documents under `skill/references/` as required.

When designing autoresearch-style iterative improvement, metric optimization, or an autonomous debug/fix/learn/reason loop, read [`autoresearch/AUTORESEARCH.md`](autoresearch/AUTORESEARCH.md), then read further under `autoresearch/references/` according to the metric, verify, guard, log, and rollback criteria you need.

For work where research, recency, and source traceability matter, read [`sourcing/reliable-search.md`](sourcing/reliable-search.md) first, then `sourcing/references/` when a source ledger, citation, or freshness handling is required. For work where completion claims, evals, and agent/tool verification matter, read [`validation/index.md`](validation/index.md) together with `validation/references/`.

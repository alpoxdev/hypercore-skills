# CLI Runtime Profile Evidence Ledger

> Korean version: [`sources.ko.md`](sources.ko.md)

## Investigation scope and limits

- Date checked: 2026-07-14
- Channel: documentation inside the project repository only
- Excluded: home-directory settings, global skills, external web documentation, and live help from an installed CLI
- Conclusion: this ledger records not a complete product feature list but the minimum capabilities and boundaries the current repository directly supports. Some GJC and OpenCode capabilities have no local evidence, so those profiles handle them through runtime discovery and fallback.

## Source ledger

| # | Source | URL/path | Type | Verified content | Used in |
|---:|---|---|---|---|---|
| 1 | Project scope rules | [`../../AGENTS.md`](../../AGENTS.md) ⚠️ | Local rules | Restrict investigation and references to inside the repository; do not use global settings as evidence | Evidence scope of every document |
| 2 | Instructions Base | [`../README.md`](../README.md) | Local guide | Separate the runtime-neutral core from runtime profiles, and describe tools by capability | `README.md`, `capability-contract.md` |
| 3 | Runtime Profiles | [`../context-engineering/references/runtime-profiles.md`](../context-engineering/references/runtime-profiles.md) | Local reference | Shared rules are capability-centric; per-runtime differences live in a separate profile | Layers and terminology |
| 4 | Skill Authoring | [`../skill/SKILL_AUTHORING.md`](../skill/SKILL_AUTHORING.md) | Local guide | A skill separates intent, scope, authority, tools, and verification, and sets safety boundaries | Skill authoring patterns and verification |
| 5 | Claude Code skill | [`../../skills/claude-code/SKILL.md`](../../skills/claude-code/SKILL.md) | Local skill | `claude -p`, session resume, permission modes, tool-restriction usage rules | `claude-code/README.md` |
| 6 | Codex skill | [`../../skills/codex/SKILL.md`](../../skills/codex/SKILL.md) | Local skill | `codex exec`, `codex review`, session resume, sandbox selection rules | `codex/README.md` |
| 7 | Git commit skill | [`../../skills/git-commit/SKILL.md`](../../skills/git-commit/SKILL.md) | Local skill | On OpenCode, prefer a native ask-style approval prompt when available, otherwise fall back to plain text | `opencode/README.md` |

> ⚠️ `AGENTS.md` and `CLAUDE.md` are covered by `.gitignore:41-42` and are therefore **not version controlled** (checked 2026-07-29; `git ls-files` returns 0 results). Evidence #1 of this ledger exists only in the current clone and the reference breaks in another clone. Whether to make them tracked is a separate decision about repository convention and is not settled in this document.

## Claim-source matrix

| Claim | Source(s) | Confidence | Caveat |
|---|---|---|---|
| Shared skill rules are capability-centric and per-runtime differences are separated into profiles | 2, 3 | High | This is this project's document design rule, not a claim about a common product standard. |
| The Claude Code bridge covers non-interactive execution, session resume, and permission modes | 5 | High | This is the scope of the repository's `claude-code` skill, not a full Claude Code feature matrix. |
| The Codex bridge covers `exec`, `review`, resume, and sandbox flows | 6 | High | This is the scope of the repository's `codex` skill, not a guarantee about the installed version. |
| Plain-text questions are used on Codex | 6, 7 | Medium | This is an operating rule of the repository's skills. It makes no general product claim about the absence of a native question tool. |
| OpenCode can prefer a native ask-style approval prompt when exposed | 7 | Medium | The only evidence is one conditional instruction in a local skill. Other OpenCode capabilities are unverified. |
| GJC's static tool list cannot be settled from evidence in this repository | Searches of `instructions`, `skills`, and `README.md` in the repository | High | Proof of absence is limited to the repository scope. |

## Update conditions

Update this ledger when any of the following happens.

- A version-pinned official CLI reference or a verified runtime profile is added to the project.
- A skill newly depends on a specific CLI's question, approval, or tool capability.
- CLI command or permission behavior changes, making an existing profile's fallback or safety gate inaccurate.

When updating, add the evidence first, then modify the relevant profile and shared contract, and finally re-check links, the claim-source matrix, and the smoke eval.

# Runtime Profiles

> Korean version: [`runtime-profiles.ko.md`](runtime-profiles.ko.md)

Write shared instructions capability-first, and keep per-runtime differences in this file.

## Quick matrix

| Runtime | Instruction surfaces | Scope / precedence notes | Practical rule |
|---|---|---|---|
| Codex | `AGENTS.md`, `AGENTS.override.md`, configured fallback files, skills metadata | Codex aggregates user instructions from the home and project hierarchy; more specific project docs appear later within limits | Keep only core rules in the project root `AGENTS.md` and link detail from `instructions/` |
| Claude Code | `CLAUDE.md`, skills, commands, hooks, memory | `CLAUDE.md` is the project memory surface read at session start | Split Claude-specific XML and extended-thinking tuning into a separate reference |
| Cursor | `.cursor/rules`, User Rules, Memories, legacy `.cursorrules` | Project Rules are version-controlled; Memories are generated and require trust/approval | Keep rules small and scoped; do not depend on legacy `.cursorrules` |
| GitHub Copilot / VS Code | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, `AGENTS.md` | Repo-wide, path-specific, and agent instructions can all apply; conflicts hurt quality | Repo-wide carries shared style, path-specific carries framework rules |
| MCP clients | Server prompts, resources, tools | Prompts should be user-controlled; tools and resources can expose powerful data and action paths | Review prompts, tools, and resources all as an untrusted boundary |

## Parallel / subagent capability matrix

| Runtime | Parallel work surface | Spawn method | Isolation and permission basis | Documentation rule |
|---|---|---|---|---|
| Codex | Native subagents, `.codex/agents/*.toml`, app/CLI subagent activity | Explicitly request subagent work, or use the runtime's `spawn_agent`-family surface | Agent thread/context separation, `sandbox_mode`, `max_threads`, read-only/write scope | The parent states objective, scope, ownership, output, and verification, and integrates the result |
| Claude Code | Built-in and custom subagents, project `.claude/agents/*.md`, the `Agent` tool, experimental agent teams | Create via `/agents`, or run through an Agent tool or agent-team request | Per-subagent context window, tool allowlist/denylist, permission mode, optional worktree isolation | Use subagents for single-session result delegation, and agent teams for inter-communication or long parallel work |
| Cursor | Editor/CLI subagents, Cloud Agents (formerly Background Agents), `.cursor/rules`, `.cursor/environment.json` | The editor/CLI agent uses a default or custom subagent, or creates a Cloud Agent | Subagent context separation; a Cloud Agent runs on a remote machine/branch with GitHub handoff | Record branch/PR handoff, env and secrets, and auto-run terminal risk in the instructions |
| GitHub Copilot / VS Code | Chat participant, coding agent, instructions | Depends on product and organization settings | Repo/path instructions and the GitHub permission boundary | Without parallel agents, separate work explicitly per worktree or issue |
| MCP clients | Tools, prompts, resources | Discovery of tools, prompts, and resources exposed by the client | Tools can be model-controlled, so approval and logging are required | Tool results and resources are evidence, not instruction authority |

Follow [`parallel-workflows.md`](parallel-workflows.md) for shared detail.

## Cross-runtime authoring rules

1. **Capability over product name**: write it as "official docs via the best available fetch/doc tool."
2. **One source of truth**: do not paste the same rule into `AGENTS.md`, `.cursor/rules`, and `CLAUDE.md`; link or reference the instructions base.
3. **Short root files**: keep only project-specific invariants and the loading map in root instruction files.
4. **Path-specific rules**: put framework- and domain-specific rules in instructions carrying a glob or path.
5. **Conflict hygiene**: assume user-level, org-level, repo-level, and path-level instructions can conflict, and state forbidden, required, and permission items clearly.
6. **Memory is not authority**: automatic memory is convenience context, not a substitute for project rules.

## Placement guide

| Kind of information | Where it goes |
|---|---|
| Project invariants | `AGENTS.md` + `instructions/README.md` |
| Prompt and context design principles | `instructions/context-engineering/` |
| Evaluation, eval, and test harness standards | `instructions/harness-engineering/` |
| Research trustworthiness standards | `instructions/sourcing/` |
| Stack-specific implementation rules | Path-specific rules or a skill reference |
| Per-runtime quirks | This file or a provider-specific reference |

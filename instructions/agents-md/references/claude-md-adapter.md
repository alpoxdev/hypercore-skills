# CLAUDE.md as an Adapter

> Korean version: [`claude-md-adapter.ko.md`](claude-md-adapter.ko.md)

**Purpose**: decide whether a repository needs a `CLAUDE.md` at all, and if so, how to keep it from becoming a second, drifting copy of the shared contract.

The default answer is **one canonical `AGENTS.md`, and a `CLAUDE.md` only if Claude Code is a target or a Claude-only difference genuinely exists.**

---

## 1. Why the question exists

`AGENTS.md` has broad adoption, but Claude Code does not read it:

> "Claude Code reads `CLAUDE.md`, not `AGENTS.md`."

So a repository that ships only `AGENTS.md` gives Claude Code **nothing**, while a repository that ships both risks two files drifting apart. Both failure modes are worse than picking a strategy deliberately.

---

## 2. Choosing a strategy

| Strategy | How | Use when |
|---|---|---|
| **A. Symlink** | `ln -s AGENTS.md CLAUDE.md` | One shared contract, no Claude-only rules. Simplest correct default. |
| **B. Import stub** | `CLAUDE.md` contains `@AGENTS.md` and nothing else | Same as A, but the repo cannot rely on symlinks (Windows checkouts, tooling that dereferences poorly). |
| **C. Thin adapter** | `CLAUDE.md` imports `@AGENTS.md`, then adds only verified Claude-specific rules | Real Claude-only differences exist: skills, hooks, permission modes, plugin metadata. |
| **D. Separate files** | Two independently maintained files | Almost never. Choose only with an explicit reason, and expect drift. |

Strategy D is a maintenance liability. Every shared rule now has two homes and no mechanism keeps them equal.

### This repository

`hypercore` uses a variant of **C**: `CLAUDE.md` is a thin adapter, but it points at `AGENTS.md` in prose ("read `AGENTS.md` first") rather than through an `@AGENTS.md` import. The tradeoff is deliberate and worth understanding — a prose pointer costs no context up front but is advisory, so the agent may proceed without reading the canonical file; an `@import` guarantees the contract is loaded but pays for it every session.

The second variation matters more: `AGENTS.md` is version-controlled while `CLAUDE.md` is gitignored, so `CLAUDE.md` is a *local clone adapter* rather than a shared artifact. That makes "shared contract stays canonical in `AGENTS.md`" not merely stylistic — anything written only into `CLAUDE.md` does not exist for anyone else, and cannot be reviewed.

---

## 3. What belongs in the adapter

Only content that is **false or absent for other runtimes**:

- Claude Code skills, and which one to load for a given task.
- Hooks, and which behavior they enforce deterministically.
- Permission modes, plugin metadata paths, and MCP servers actually exposed in this repository.
- Explicit statements about what *not* to read (for example, global `~/.claude/` configuration that must not be used as project evidence).
- Import wiring: the `@AGENTS.md` line and any `@path` references.

What must **not** go there:

- Any rule that would also be true for Codex, Cursor, or Copilot. That belongs in `AGENTS.md`.
- A restatement, summary, or "quick version" of the shared contract. Duplication is the failure mode this file exists to avoid.
- Relaxations of shared rules. An adapter adds runtime detail; it does not weaken the canonical contract.

Current Anthropic guidance names repetition across surfaces as an anti-pattern in its own right: the same instruction restated in a system prompt, a skill, and an instruction file produces conflict rather than emphasis.

---

## 4. Import mechanics

`CLAUDE.md` can pull in other files:

> "CLAUDE.md files can import additional files using `@path/to/import` syntax."

> "Both relative and absolute paths are allowed. Relative paths resolve relative to the file containing the import, not the working directory."

> "Imported files can recursively import other files, with a maximum depth of four hops."

Practical consequences:

- **Four hops is a real ceiling.** A chain like `CLAUDE.md` → `AGENTS.md` → an instructions index → an area doc → a reference doc reaches it. Import leaf documents directly rather than building deep chains.
- **Relative paths resolve from the importing file.** Moving a file breaks its imports even though the target still exists.
- **Imports are eager.** An imported file costs context at session start exactly like inlined text. Import only what is needed every session; link (do not import) everything else so the agent reads it on demand.

That last point is the practical dividing line: `@import` for always-needed material, plain markdown link for read-when-relevant material.

---

## 5. Sizing

> "Size: target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence."

An adapter should be far under that — typically a stub plus a short runtime section. If it approaches 200 lines, the content almost certainly belongs in `AGENTS.md` or in a skill.

Anthropic's stated escape hatch for growth is not a longer file:

> "Keep CLAUDE.md under 200 lines. Move reference material to skills, which load on-demand."

Note also that the 200-line figure is guidance, not truncation — `CLAUDE.md` files "are loaded in full regardless of length". Exceeding it costs adherence silently rather than dropping content visibly, which is why nothing warns you.

---

## 6. Local and personal content

`CLAUDE.local.md` is documented for "personal project-specific preferences" and is meant to be gitignored. Use it for sandbox URLs, preferred test data, and individual workflow habits.

Never put personal preference into the shared file, and never put shared project rules into the local one. GitHub's guidance independently reaches the same boundary from the other direction, listing response-style and verbosity preferences among things instructions should not contain.

Separately, Claude Code maintains automatic per-project memory at `~/.claude/projects/<project>/memory/`. This is a distinct mechanism from `CLAUDE.md` and is not a place to author shared project rules — it is not present in another clone.

---

## 7. Verification

- [ ] The strategy (A/B/C/D) is a deliberate choice, not an accident.
- [ ] `CLAUDE.md` resolves — the symlink target or `@AGENTS.md` import actually exists.
- [ ] No rule appears in both `AGENTS.md` and `CLAUDE.md`.
- [ ] Every rule in `CLAUDE.md` is genuinely Claude-specific and verified against the current runtime.
- [ ] The adapter does not weaken any shared safety or authority rule.
- [ ] Import chains stay within four hops; relative paths resolve from the importing file.
- [ ] Only always-needed material is imported; the rest is linked.
- [ ] Personal preferences live in `CLAUDE.local.md`, gitignored.
- [ ] If `CLAUDE.md` is gitignored, no shared contract content exists only there.
- [ ] Claimed skills, hooks, MCP servers, and plugin paths were confirmed present in this repository.

---

## Sources

| Source | URL | Checked |
|---|---|---|
| Claude Code memory | <https://code.claude.com/docs/en/memory> | 2026-08-04 |
| Claude Code features overview | <https://code.claude.com/docs/en/features-overview> | 2026-08-04 |
| Claude 5 context engineering | <https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models> | 2026-08-04 |
| AGENTS.md standard | <https://agents.md/> | 2026-08-04 |
| GitHub Copilot response customization | <https://docs.github.com/en/copilot/concepts/prompting/response-customization> | 2026-08-04 |

## Related documents

- [`../AGENTS_MD.md`](../AGENTS_MD.md)
- [`discovery-and-precedence.md`](discovery-and-precedence.md)
- [`content-contract.md`](content-contract.md)
- [`../../cli/claude-code/README.md`](../../cli/claude-code/README.md)

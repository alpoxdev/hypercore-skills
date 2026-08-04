# Discovery and Precedence

> Korean version: [`discovery-and-precedence.ko.md`](discovery-and-precedence.ko.md)

**Purpose**: record how each runtime actually finds and combines instruction files, so nested files are written to be correct under every implementation rather than under the one you happen to use.

All facts below are vendor statements about their own products, verified 2026-08-04. Re-verify quarterly — this is the fastest-moving material in this base.

---

## 1. The "closest file wins" trap

The `AGENTS.md` site states the rule simply:

> "Place another AGENTS.md inside each package. Agents automatically read the nearest file in the directory tree, so the closest one takes precedence and every subproject can ship tailored instructions."

> "The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything."

**Most implementations do not work this way.** They merge, and "closest wins" is achieved only by ordering within a concatenated prompt — the parent is still loaded and still in context.

| Runtime | Actual combining behavior |
|---|---|
| **OpenAI Codex** | Concatenates root-to-leaf; closer files override "because they appear later in the combined prompt" |
| **Claude Code** | "All discovered files are concatenated into context rather than overriding each other" |
| **Cursor** | "Instructions from nested `AGENTS.md` files are combined with parent directories, with more specific instructions taking precedence" |
| **GitHub Copilot** | "the nearest `AGENTS.md` file in the directory tree will take precedence" — the only reviewed vendor matching the simple reading |

### The authoring rule this forces

A nested instruction file must be correct under **both** semantics, because you cannot control which agent reads it:

- **Never rely on the parent being absent.** In Codex, Claude Code, and Cursor the root file is still loaded. A nested file saying "ignore the root's test command" does not remove the root's text — it creates a contradiction the model resolves by position, silently.
- **Never rely on the parent being present.** Under Copilot's nearest-wins reading, a nested file may be the only one applied. Anything essential for that subtree must be stated there.
- **Therefore: write nested files as self-contained deltas.** State the subtree's scope explicitly, override by *restating the correct rule in full*, not by referring to the parent's rule negatively.

Concretely, in a nested file prefer `Run tests with 'pnpm -C cli test' in this package` over `unlike the root, do not use bun here`.

---

## 2. Claude Code

Source: <https://code.claude.com/docs/en/memory> (checked 2026-08-04)

### Filename

> "Claude Code reads `CLAUDE.md`, not `AGENTS.md`."

This is the single most consequential compatibility fact in this document. To serve both ecosystems from one canonical file, the documented options are an import or a symlink:

```bash
ln -s AGENTS.md CLAUDE.md
```

or inside `CLAUDE.md`, a single line: `@AGENTS.md`.

### Discovery

> "Claude Code reads CLAUDE.md files by walking up the directory tree from your current working directory, checking each directory along the way for CLAUDE.md and CLAUDE.local.md files."

> "All discovered files are concatenated into context rather than overriding each other."

> "Claude also discovers CLAUDE.md and CLAUDE.local.md files in subdirectories under your current working directory. Instead of loading them at launch, they are included when Claude reads files in those subdirectories."

So: ancestors load **eagerly at launch**, descendants load **lazily on file access**. A deep nested file costs nothing until the agent touches that subtree — which makes nesting the correct tool for large monorepos.

### Imports

> "CLAUDE.md files can import additional files using `@path/to/import` syntax."

> "Both relative and absolute paths are allowed. Relative paths resolve relative to the file containing the import, not the working directory."

> "Imported files can recursively import other files, with a maximum depth of four hops."

The relative-path resolution rule is a common source of broken imports when a file is moved.

### Size

> "Size: target under 200 lines per CLAUDE.md file."

Critically, this is advice and not a cap:

> "This limit applies only to MEMORY.md. CLAUDE.md files are loaded in full regardless of length, though shorter files produce better adherence."

The truncation limit that *does* exist applies to auto-memory: "The first 200 lines of MEMORY.md, or the first 25KB, whichever comes first, are loaded at the start of every conversation." Do not confuse the two — an over-long `CLAUDE.md` is not silently cut, it is fully loaded and degrades adherence.

### Related files and commands

- `CLAUDE.local.md` — personal project-specific preferences; documented as something to add to `.gitignore`. Still listed; no deprecation stated.
- Auto-memory lives per project at `~/.claude/projects/<project>/memory/`.
- `/init` generates a starting `CLAUDE.md`; if one exists it "suggests improvements rather than overwriting it". `CLAUDE_CODE_NEW_INIT=1` enables an interactive multi-phase flow covering CLAUDE.md files, skills, and hooks.
- `/memory` lists memory file locations across user and project scopes and toggles auto memory.
- The `#` hotkey is no longer the recommended memory path. Current guidance: "We used to encourage users to save things to Claude's memory, by using the # hotkey to write to their CLAUDE.md automatically. Instead, Claude now automatically saves memories that are relevant to the work and to you." (<https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models>, checked 2026-08-04)

---

## 3. OpenAI Codex

Source: <https://learn.chatgpt.com/docs/agent-configuration/agents-md> (checked 2026-08-04; `developers.openai.com/codex/agent-configuration/agents-md` redirects here)

### Global scope

> "In your Codex home directory (defaults to `~/.codex`, unless you set `CODEX_HOME`), Codex reads `AGENTS.override.md` if it exists. Otherwise, Codex reads `AGENTS.md`. Codex uses only the first non-empty file at this level."

### Project scope

> "Starting at the project root (typically the Git root), Codex walks down to your current working directory. If Codex cannot find a project root, it only checks the current directory. In each directory along the path, it checks for `AGENTS.override.md`, then `AGENTS.md`, then any fallback names in `project_doc_fallback_filenames`. Codex includes at most one file per directory."

### Merge order

> "Codex concatenates files from the root down, joining them with blank lines. Files closer to your current directory override earlier guidance because they appear later in the combined prompt."

Precedence here is **positional**, not exclusive. Later text wins by being later, which is a soft guarantee, not a hard one.

### Size limit

> "Codex skips empty files and stops adding files once the combined size reaches the limit defined by `project_doc_max_bytes` (32 KiB by default)."

This is a hard truncation with a real failure mode: files are dropped **once the budget is exhausted, in root-to-leaf order**. A bloated root file can therefore silently starve the nested file that actually governs the code being edited. This is the strongest mechanical argument for keeping the root file small.

---

## 4. GitHub Copilot

Sources: <https://docs.github.com/en/copilot/concepts/prompting/response-customization> and <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions> (checked 2026-08-04)

### Full precedence order

> "The following list shows the complete order of precedence, with instructions higher in this list taking precedence over those lower in the list:"
> - "Personal instructions"
> - "Repository custom instructions:"
>   - "Path-specific instructions in any applicable `.github/instructions/**/*.instructions.md` file"
>   - "Repository-wide instructions in the `.github/copilot-instructions.md` file"
> - "Agent instructions (for example, in an `AGENTS.md` file)"
> - "Organization custom instructions"

Note the ranking: in Copilot, `AGENTS.md` sits **below** `.github/copilot-instructions.md`. A repository carrying both will find the Copilot-specific file winning on conflict.

### AGENTS.md handling

> "You can create one or more `AGENTS.md` files, stored anywhere within the repository. When Copilot is working, the nearest `AGENTS.md` file in the directory tree will take precedence."

> "Alternatively, you can use a single `CLAUDE.md` or `GEMINI.md` file stored in the root of the repository."

Path-specific and repository-wide files combine rather than replace:

> "If the path you specify matches a file that Copilot is working on, and a repository-wide custom instructions file also exists, then the instructions from both files are used."

Copilot also offers a mechanism the others lack — glob-scoped instruction files via `applyTo:` frontmatter in `.github/instructions/*.instructions.md`, with optional `excludeAgent: "code-review" | "cloud-agent"`.

---

## 5. Cursor and Gemini CLI

**Cursor** (<https://cursor.com/en-US/docs/rules>, checked 2026-08-04) treats `AGENTS.md` as "a simple markdown file for defining agent instructions" and "a plain markdown file without metadata or complex configurations", supported "in the project root and subdirectories". Nested files "are combined with parent directories, with more specific instructions taking precedence". Its stated size heuristic for rules generally is "Keep rules under 500 lines".

**Gemini CLI** supports `AGENTS.md` through the configurable `context.fileName` setting but defaults to `GEMINI.md`. Support is therefore opt-in, not automatic.

---

## 6. Format and ecosystem

The standard imposes no schema:

> "No. AGENTS.md is just standard Markdown. Use any headings you like; the agent simply parses the text you provide."

The `AGENTS.md` site lists broad adoption, including Codex, Amp, Jules, Cursor, Factory, RooCode, Aider, Gemini CLI, goose, Kilo Code, opencode, Phoenix, Zed, Semgrep, Warp, GitHub Copilot coding agent, VS Code, Ona, Devin, Windsurf, UiPath agents, Augment Code, and Junie.

For legacy singular filenames the documented migration is a rename plus symlink:

```bash
mv AGENT.md AGENTS.md && ln -s AGENTS.md AGENT.md
```

No reviewed source documents a general `CLAUDE.md` → `AGENTS.md` migration recipe beyond Claude Code's own import/symlink options in §2.

---

## 7. Portability checklist

- [ ] Root file is small enough to survive Codex's 32 KiB root-to-leaf budget with room for nested files.
- [ ] Nested files are self-contained deltas, correct whether or not the parent is loaded.
- [ ] Overrides restate the correct rule in full instead of negating the parent.
- [ ] Every nested file names the subtree it governs.
- [ ] If Claude Code is a target, `CLAUDE.md` exists as a real file, a symlink, or an `@AGENTS.md` import — `AGENTS.md` alone is not read.
- [ ] `@path` imports stay within four hops and use paths relative to the importing file.
- [ ] If both `.github/copilot-instructions.md` and `AGENTS.md` exist, their content does not conflict, since Copilot ranks the former higher.
- [ ] Personal-preference content lives in a gitignored local file, not the shared one.

---

## Sources

| Source | URL | Checked |
|---|---|---|
| AGENTS.md standard | <https://agents.md/> | 2026-08-04 |
| Claude Code memory | <https://code.claude.com/docs/en/memory> | 2026-08-04 |
| Claude Code features overview | <https://code.claude.com/docs/en/features-overview> | 2026-08-04 |
| Claude 5 context engineering | <https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models> | 2026-08-04 |
| OpenAI Codex AGENTS.md | <https://learn.chatgpt.com/docs/agent-configuration/agents-md> | 2026-08-04 |
| GitHub Copilot response customization | <https://docs.github.com/en/copilot/concepts/prompting/response-customization> | 2026-08-04 |
| GitHub Copilot repository instructions | <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions> | 2026-08-04 |
| Cursor rules | <https://cursor.com/en-US/docs/rules> | 2026-08-04 |

## Related documents

- [`../AGENTS_MD.md`](../AGENTS_MD.md)
- [`claude-md-adapter.md`](claude-md-adapter.md)
- [`content-contract.md`](content-contract.md)
- [`../../cli/README.md`](../../cli/README.md)

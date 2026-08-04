# 탐색과 우선순위

> 영어판: [`discovery-and-precedence.md`](discovery-and-precedence.md)

**목적**: 각 런타임이 instruction 파일을 실제로 어떻게 찾고 결합하는지 기록해, 중첩 파일이 내가 쓰는 하나가 아니라 모든 구현에서 옳도록 작성하게 한다.

아래 사실은 모두 벤더가 자기 제품에 대해 밝힌 내용이며 2026-08-04에 확인했다. 이 베이스에서 가장 빠르게 변하는 자료이므로 분기마다 재검증한다.

---

## 1. "가장 가까운 파일이 이긴다"의 함정

`AGENTS.md` 사이트는 규칙을 단순하게 서술한다:

> "Place another AGENTS.md inside each package. Agents automatically read the nearest file in the directory tree, so the closest one takes precedence and every subproject can ship tailored instructions."

> "The closest AGENTS.md to the edited file wins; explicit user chat prompts override everything."

**대부분의 구현은 이렇게 동작하지 않는다.** 실제로는 merge하며, "closest wins"는 concatenate된 프롬프트 안의 순서로만 달성된다. 부모 파일은 여전히 로드되어 context에 남아 있다.

| 런타임 | 실제 결합 동작 |
|---|---|
| **OpenAI Codex** | 루트→말단 concatenate. 더 가까운 파일이 "because they appear later in the combined prompt" override |
| **Claude Code** | "All discovered files are concatenated into context rather than overriding each other" |
| **Cursor** | "Instructions from nested `AGENTS.md` files are combined with parent directories, with more specific instructions taking precedence" |
| **GitHub Copilot** | "the nearest `AGENTS.md` file in the directory tree will take precedence" — 단순 해석과 일치하는 유일한 검토 대상 |

### 여기서 도출되는 작성 규칙

어떤 에이전트가 읽을지 통제할 수 없으므로, 중첩 instruction 파일은 **두 방식 모두**에서 옳아야 한다.

- **부모의 부재에 기대지 않는다.** Codex, Claude Code, Cursor에서 루트 파일은 여전히 로드된다. "루트의 test 명령을 무시하라"고 쓴 중첩 파일은 루트 텍스트를 제거하지 못하며, 모델이 위치로 조용히 해소하는 모순만 만든다.
- **부모의 존재에도 기대지 않는다.** Copilot의 nearest-wins 해석에서는 중첩 파일만 적용될 수 있다. 그 하위 트리에 필수적인 내용은 거기에 적혀 있어야 한다.
- **따라서 중첩 파일은 자기 완결적 delta로 쓴다.** 하위 트리 범위를 명시하고, 부모 규칙을 부정하는 대신 **올바른 규칙을 온전히 다시 진술**해 override한다.

구체적으로, 중첩 파일에서는 "루트와 달리 여기서는 bun을 쓰지 말라"보다 "이 패키지의 테스트는 `pnpm -C cli test`로 실행한다"를 택한다.

---

## 2. Claude Code

출처: <https://code.claude.com/docs/en/memory> (확인 2026-08-04)

### 파일명

> "Claude Code reads `CLAUDE.md`, not `AGENTS.md`."

이 문서에서 가장 파급이 큰 호환성 사실이다. 정본 파일 하나로 양쪽 생태계를 지원하려면 문서화된 방법은 import 또는 심볼릭 링크다:

```bash
ln -s AGENTS.md CLAUDE.md
```

또는 `CLAUDE.md` 안에 한 줄: `@AGENTS.md`.

### 탐색

> "Claude Code reads CLAUDE.md files by walking up the directory tree from your current working directory, checking each directory along the way for CLAUDE.md and CLAUDE.local.md files."

> "All discovered files are concatenated into context rather than overriding each other."

> "Claude also discovers CLAUDE.md and CLAUDE.local.md files in subdirectories under your current working directory. Instead of loading them at launch, they are included when Claude reads files in those subdirectories."

즉 상위 파일은 **시작 시 즉시** 로드되고, 하위 파일은 **해당 파일 접근 시 지연** 로드된다. 깊은 중첩 파일은 에이전트가 그 하위 트리를 건드리기 전까지 비용이 0이며, 이 때문에 대형 monorepo에서 중첩이 올바른 도구가 된다.

### Import

> "CLAUDE.md files can import additional files using `@path/to/import` syntax."

> "Both relative and absolute paths are allowed. Relative paths resolve relative to the file containing the import, not the working directory."

> "Imported files can recursively import other files, with a maximum depth of four hops."

상대 경로 해석 규칙은 파일을 옮겼을 때 import가 깨지는 흔한 원인이다.

### 크기

> "Size: target under 200 lines per CLAUDE.md file."

중요한 점은 이것이 상한이 아니라 권고라는 것이다:

> "This limit applies only to MEMORY.md. CLAUDE.md files are loaded in full regardless of length, though shorter files produce better adherence."

실제로 존재하는 절단 한계는 auto-memory에 적용된다: "The first 200 lines of MEMORY.md, or the first 25KB, whichever comes first, are loaded at the start of every conversation." 둘을 혼동하지 않는다. 지나치게 긴 `CLAUDE.md`는 조용히 잘리는 것이 아니라 전부 로드되어 준수율을 떨어뜨린다.

### 관련 파일과 명령

- `CLAUDE.local.md` — 개인용 프로젝트 선호. `.gitignore`에 추가하도록 문서화되어 있다. 여전히 목록에 있으며 deprecation은 명시되지 않았다.
- auto-memory는 프로젝트별로 `~/.claude/projects/<project>/memory/`에 있다.
- `/init`은 시작용 `CLAUDE.md`를 생성한다. 이미 있으면 "suggests improvements rather than overwriting it". `CLAUDE_CODE_NEW_INIT=1`은 CLAUDE.md, skill, hook을 다루는 대화형 다단계 흐름을 켠다.
- `/memory`는 user·project 범위의 memory 파일 위치를 나열하고 auto memory를 토글한다.
- `#` 단축키는 더 이상 권장 경로가 아니다. 현재 지침: "We used to encourage users to save things to Claude's memory, by using the # hotkey to write to their CLAUDE.md automatically. Instead, Claude now automatically saves memories that are relevant to the work and to you." (<https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models>, 확인 2026-08-04)

---

## 3. OpenAI Codex

출처: <https://learn.chatgpt.com/docs/agent-configuration/agents-md> (확인 2026-08-04. `developers.openai.com/codex/agent-configuration/agents-md`는 여기로 리다이렉트된다)

### 전역 범위

> "In your Codex home directory (defaults to `~/.codex`, unless you set `CODEX_HOME`), Codex reads `AGENTS.override.md` if it exists. Otherwise, Codex reads `AGENTS.md`. Codex uses only the first non-empty file at this level."

### 프로젝트 범위

> "Starting at the project root (typically the Git root), Codex walks down to your current working directory. If Codex cannot find a project root, it only checks the current directory. In each directory along the path, it checks for `AGENTS.override.md`, then `AGENTS.md`, then any fallback names in `project_doc_fallback_filenames`. Codex includes at most one file per directory."

### Merge 순서

> "Codex concatenates files from the root down, joining them with blank lines. Files closer to your current directory override earlier guidance because they appear later in the combined prompt."

여기서 우선순위는 배타적이 아니라 **위치 기반**이다. 나중 텍스트가 나중이라는 이유로 이기는 것이며, 이는 하드한 보장이 아니라 소프트한 경향이다.

### 크기 제한

> "Codex skips empty files and stops adding files once the combined size reaches the limit defined by `project_doc_max_bytes` (32 KiB by default)."

이는 실제 실패 모드가 있는 하드 절단이다. 예산이 소진되면 **루트→말단 순서로** 파일이 버려진다. 따라서 비대한 루트 파일이 정작 지금 수정 중인 코드를 관장하는 중첩 파일을 조용히 굶길 수 있다. 루트 파일을 작게 유지해야 하는 가장 강력한 기계적 근거다.

---

## 4. GitHub Copilot

출처: <https://docs.github.com/en/copilot/concepts/prompting/response-customization>, <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions> (확인 2026-08-04)

### 전체 우선순위

> "The following list shows the complete order of precedence, with instructions higher in this list taking precedence over those lower in the list:"
> - "Personal instructions"
> - "Repository custom instructions:"
>   - "Path-specific instructions in any applicable `.github/instructions/**/*.instructions.md` file"
>   - "Repository-wide instructions in the `.github/copilot-instructions.md` file"
> - "Agent instructions (for example, in an `AGENTS.md` file)"
> - "Organization custom instructions"

순위에 주목한다. Copilot에서 `AGENTS.md`는 `.github/copilot-instructions.md`보다 **아래**에 있다. 둘 다 있는 저장소에서는 충돌 시 Copilot 전용 파일이 이긴다.

### AGENTS.md 처리

> "You can create one or more `AGENTS.md` files, stored anywhere within the repository. When Copilot is working, the nearest `AGENTS.md` file in the directory tree will take precedence."

> "Alternatively, you can use a single `CLAUDE.md` or `GEMINI.md` file stored in the root of the repository."

path-specific 파일과 repository-wide 파일은 대체가 아니라 결합된다:

> "If the path you specify matches a file that Copilot is working on, and a repository-wide custom instructions file also exists, then the instructions from both files are used."

Copilot에는 다른 도구에 없는 기능도 있다. `.github/instructions/*.instructions.md`의 `applyTo:` frontmatter로 glob 범위를 지정하고, 선택적으로 `excludeAgent: "code-review" | "cloud-agent"`를 줄 수 있다.

---

## 5. Cursor와 Gemini CLI

**Cursor** (<https://cursor.com/en-US/docs/rules>, 확인 2026-08-04)는 `AGENTS.md`를 "a simple markdown file for defining agent instructions", "a plain markdown file without metadata or complex configurations"로 다루며 "in the project root and subdirectories"를 지원한다. 중첩 파일은 "are combined with parent directories, with more specific instructions taking precedence". rule 전반에 대한 크기 휴리스틱은 "Keep rules under 500 lines"다.

**Gemini CLI**는 `context.fileName` 설정을 통해 `AGENTS.md`를 지원하지만 기본값은 `GEMINI.md`다. 즉 지원은 자동이 아니라 opt-in이다.

---

## 6. 포맷과 생태계

표준은 schema를 강제하지 않는다:

> "No. AGENTS.md is just standard Markdown. Use any headings you like; the agent simply parses the text you provide."

`AGENTS.md` 사이트는 폭넓은 채택을 나열한다. Codex, Amp, Jules, Cursor, Factory, RooCode, Aider, Gemini CLI, goose, Kilo Code, opencode, Phoenix, Zed, Semgrep, Warp, GitHub Copilot coding agent, VS Code, Ona, Devin, Windsurf, UiPath agents, Augment Code, Junie 등이다.

단수형 legacy 파일명에 대해 문서화된 마이그레이션은 rename + 심볼릭 링크다:

```bash
mv AGENT.md AGENTS.md && ln -s AGENTS.md AGENT.md
```

검토한 어떤 출처도 `CLAUDE.md` → `AGENTS.md` 일반 마이그레이션 레시피를 문서화하지 않았다. §2의 Claude Code 자체 import/심볼릭 링크 방법이 전부다.

---

## 7. 이식성 체크리스트

- [ ] 루트 파일이 Codex의 32 KiB 루트→말단 예산에서 중첩 파일 몫을 남길 만큼 작다.
- [ ] 중첩 파일이 부모 로드 여부와 무관하게 옳은 자기 완결적 delta다.
- [ ] override가 부모를 부정하지 않고 올바른 규칙을 온전히 다시 진술한다.
- [ ] 모든 중첩 파일이 관장하는 하위 트리를 명시한다.
- [ ] Claude Code가 대상이면 `CLAUDE.md`가 실제 파일, 심볼릭 링크, 또는 `@AGENTS.md` import로 존재한다. `AGENTS.md`만으로는 읽히지 않는다.
- [ ] `@path` import가 4 hop 이내이며 import한 파일 기준 상대 경로를 쓴다.
- [ ] `.github/copilot-instructions.md`와 `AGENTS.md`가 함께 있으면 내용이 충돌하지 않는다. Copilot이 전자를 더 높게 매기기 때문이다.
- [ ] 개인 선호 내용은 공유 파일이 아니라 gitignore된 로컬 파일에 있다.

---

## 출처

| 출처 | URL | 확인일 |
|---|---|---|
| AGENTS.md 표준 | <https://agents.md/> | 확인 2026-08-04 |
| Claude Code memory | <https://code.claude.com/docs/en/memory> | 확인 2026-08-04 |
| Claude Code features overview | <https://code.claude.com/docs/en/features-overview> | 확인 2026-08-04 |
| Claude 5 context engineering | <https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models> | 확인 2026-08-04 |
| OpenAI Codex AGENTS.md | <https://learn.chatgpt.com/docs/agent-configuration/agents-md> | 확인 2026-08-04 |
| GitHub Copilot response customization | <https://docs.github.com/en/copilot/concepts/prompting/response-customization> | 확인 2026-08-04 |
| GitHub Copilot repository instructions | <https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions> | 확인 2026-08-04 |
| Cursor rules | <https://cursor.com/en-US/docs/rules> | 확인 2026-08-04 |

## 함께 읽을 문서

- [`../AGENTS_MD.ko.md`](../AGENTS_MD.ko.md)
- [`claude-md-adapter.ko.md`](claude-md-adapter.ko.md)
- [`content-contract.ko.md`](content-contract.ko.md)
- [`../../cli/README.ko.md`](../../cli/README.ko.md)

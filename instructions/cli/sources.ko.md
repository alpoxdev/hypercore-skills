# CLI 런타임 프로필 근거 원장

> 영어판: [`sources.md`](sources.md)

## 조사 범위와 한계

- 확인일: 2026-07-28
- 채널: 프로젝트 저장소 내부 문서만 사용
- 제외: 홈 디렉터리 설정·전역 skill·외부 웹 문서·설치된 CLI의 실시간 help
- 결론: 이 원장은 제품의 완전한 기능 목록이 아니라 현재 저장소가 직접 뒷받침하는 최소 기능과 경계를 기록한다. GJC, Hermes Agent, OpenClaw와 OpenCode의 일부 기능은 로컬 근거가 없으므로 해당 프로필에서 runtime discovery와 fallback으로 처리한다.

## Source ledger

| # | Source | URL/path | 유형 | 확인된 내용 | 사용 위치 |
|---:|---|---|---|---|---|
| 1 | 프로젝트 범위 규칙 | [`../../AGENTS.md`](../../AGENTS.md) ⚠️ | 로컬 규칙 | 조사·참조는 저장소 내부로 제한하고, 전역 설정을 근거로 사용하지 않음 | 전체 문서의 근거 범위 |
| 2 | Instructions Base | [`../README.ko.md`](../README.ko.md) | 로컬 안내 | 런타임 중립 core와 runtime profile을 분리하고, capability 중심으로 도구를 서술 | `README.md`, `capability-contract.md` |
| 3 | Runtime Profiles | [`../context-engineering/references/runtime-profiles.ko.md`](../context-engineering/references/runtime-profiles.ko.md) | 로컬 reference | 공통 규칙은 capability 중심, 런타임별 차이는 별도 profile에 둠 | 레이어와 용어 |
| 4 | Skill Authoring | [`../skill/SKILL_AUTHORING.ko.md`](../skill/SKILL_AUTHORING.ko.md) | 로컬 안내 | skill은 intent·scope·authority·tools·verification을 분리하고 안전 경계를 둠 | Skill 작성 패턴·검증 |
| 5 | Claude Code skill | [`../../skills/claude-code/SKILL.ko.md`](../../skills/claude-code/SKILL.ko.md) | 로컬 skill | `claude -p`, 세션 재개, 권한 모드, 도구 제한 사용 규칙 | `claude-code/README.md` |
| 6 | Codex skill | [`../../skills/codex/SKILL.ko.md`](../../skills/codex/SKILL.ko.md) | 로컬 skill | `codex exec`, `codex review`, 세션 재개, sandbox 선택 규칙 | `codex/README.md` |
| 7 | Git commit skill | [`../../skills/git-commit/SKILL.ko.md`](../../skills/git-commit/SKILL.ko.md) | 로컬 skill | OpenCode에서는 native ask 스타일 승인 프롬프트가 가능할 때 우선, 아니면 평문 fallback | `opencode/README.md` |

> ⚠️ `AGENTS.md`와 `CLAUDE.md`는 `.gitignore:41-42` 대상이라 **버전 관리되지 않는다**(확인 2026-07-28, `git ls-files` 결과 0건). 이 원장의 근거 #1은 현재 clone에만 존재하며 다른 clone에서는 참조가 끊긴다. 이를 추적 대상으로 바꿀지는 저장소 관례에 대한 별도 결정 사항이며 이 문서에서 정하지 않는다.

## Claim-source matrix

| Claim | Source(s) | Confidence | Caveat |
|---|---|---|---|
| 공통 skill 규칙은 capability 중심이고 런타임별 차이는 profile에 분리한다 | 2, 3 | 높음 | 이 프로젝트의 문서 설계 규칙이다. 제품 공통 표준 주장 아님. |
| Claude Code bridge는 비대화형 실행·세션 재개·권한 모드를 다룬다 | 5 | 높음 | 현재 저장소의 `claude-code` skill 범위이며 전체 Claude Code 기능표가 아님. |
| Codex bridge는 `exec`, `review`, 재개, sandbox 흐름을 다룬다 | 6 | 높음 | 현재 저장소의 `codex` skill 범위이며 설치 버전의 기능 보장은 아님. |
| Codex에서는 평문 질문을 사용한다 | 6, 7 | 중간 | 저장소 skill의 운영 규칙이다. native 질문 도구 부재에 대한 제품 일반 주장은 하지 않는다. |
| OpenCode는 native ask 스타일 승인 프롬프트가 노출될 때 우선 사용할 수 있다 | 7 | 중간 | 로컬 skill의 조건부 지침 하나만 근거다. 다른 OpenCode 기능은 확인되지 않았다. |
| GJC의 정적 도구 목록을 이 저장소 근거로 확정할 수 없다 | 저장소 내 `instructions`, `skills`, `README.md` 검색 | 높음 | 부재 증명은 저장소 범위에만 한정된다. |
| Hermes Agent와 OpenClaw의 제품 고유 capability를 이 저장소 근거로 확정할 수 없다 | 저장소 내 `instructions`, `skills`, `README.md` 검색 | 높음 | 부재 증명은 저장소 범위에만 한정되며 외부 웹 문서와 설치된 CLI는 프로젝트 범위에서 제외된다. |

## 갱신 조건

다음 중 하나가 생기면 이 원장을 갱신한다.

- 프로젝트에 버전 고정된 CLI 공식 reference 또는 검증된 런타임 profile이 추가된다.
- skill이 특정 CLI의 질문·승인·도구 기능에 새로 의존한다.
- CLI 명령/권한 동작이 달라져 기존 profile의 fallback이나 safety gate가 부정확해진다.

갱신 시에는 근거를 먼저 추가하고, 그 다음 해당 프로필과 공통 계약을 수정하며, 마지막으로 링크·claim-source matrix·smoke eval을 다시 확인한다.

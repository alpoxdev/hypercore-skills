# Autoresearch Command Family

> 영어판: [`command-family.md`](command-family.md)

이 문서는 `uditgoenka/autoresearch`의 command surface를 이 저장소에서 instruction pattern으로 해석하기 위한 기준이다. 실제 외부 skill을 설치하거나 실행하라는 뜻이 아니다.

## 1. Core loop

사용 조건:

- scalar metric이 있다.
- verify command가 있다.
- scope가 제한되어 있다.
- rollback 가능하다.

패턴:

```text
Goal → Scope → Metric → Verify → Guard → Iterations
Modify one thing → Verify → Keep/Discard → Log → Repeat
```

## 2. Plan

사용 조건:

- Goal은 있지만 Scope/Metric/Verify가 불분명하다.
- 바로 반복을 돌리면 metric이 잘못될 위험이 크다.

출력:

- 실행 가능한 config block
- verify dry-run 결과
- handoff payload

## 3. Debug

사용 조건:

- 증상은 있지만 root cause가 불분명하다.
- 여러 hypothesis를 체계적으로 테스트해야 한다.

패턴:

```text
symptom → recon → hypothesis → test → confirmed/disproven/inconclusive → log → repeat
```

검증:

- 모든 confirmed finding은 file:line, reproduction, evidence를 가져야 한다.
- disproven hypothesis도 기록한다.

## 4. Fix

사용 조건:

- test/type/lint/build error count를 줄이는 것이 목표다.
- error list가 command로 재현된다.

패턴:

```text
run target → count errors → pick one → fix one → verify → guard → keep/revert
```

금지:

- 여러 error category를 한 번에 고치기
- error count가 줄지 않았는데 keep하기
- guard failure를 무시하기

## 5. Evals

사용 조건:

- 반복 결과 TSV/log가 있다.
- trend, plateau, regression, success pattern을 분석해야 한다.

출력:

- kept/discarded rate
- metric trajectory
- plateau 여부
- 가장 효과적인 change type
- 계속/중단/전략 변경 권고

## 6. Reason

사용 조건:

- numeric metric이 없는 주관/전략/설계 결정이다.
- blind judge/rubric/convergence를 fitness function으로 만들 수 있다.

패턴:

```text
candidate A → critique → candidate B → synthesis → blind judge panel → incumbent → convergence
```

주의:

- judge 기준이 없으면 reasoning loop가 취향 싸움이 된다.
- candidate label을 blind/randomize해야 평가 편향을 줄일 수 있다.

## 7. Probe

사용 조건:

- 요구사항이 흐릿하거나 숨은 제약이 많다.
- 자동 반복 전에 Goal/Scope/Metric/Verify를 더 캐야 한다.

출력:

- constraint list
- ambiguity list
- ready-to-run config 또는 plan handoff

## 8. Learn

사용 조건:

- codebase 문서 생성/갱신/검증이 목표다.

패턴:

```text
scout codebase → generate/update docs → validate links/coverage → fix → repeat
```

주의:

- docs loop도 metric/coverage/required sections/broken links 같은 검증 기준이 필요하다.

## 9. Predict

사용 조건:

- 반복을 돌리기 전에 가설 자체의 품질을 올려야 한다.
- 단일 관점 분석이 anchoring이나 도메인 맹점에 빠질 위험이 크다.

패턴:

```text
recon → 페르소나별 독립 분석(교차 대화 없음) → 구조화된 교차 심문 → 투표·합의 → 가설 큐
```

주의:

- 루프가 아니라 one-shot이다. iteration을 돌리지 않는다.
- 페르소나가 서로의 결론에 휩쓸리는 herd 현상을 감지·차단하는 규칙이 없으면 관점 다양성이 사라져 단일 관점과 같아진다.
- 독립 분석 단계에서 페르소나 간 정보를 공유하면 이 패턴의 이점이 사라진다.

## 10. Improve

사용 조건:

- 코드 품질이 아니라 **무엇을 만들지**를 근거 기반으로 정해야 한다.
- ICP(이상적 고객군)가 정의되어 있거나 정의할 수 있다.

패턴:

```text
제품 컨텍스트 확보 → 다중 소스 리서치(포화까지) → ICP 게이트로 순위 → 선택 → 근거 사슬을 가진 PRD
```

주의:

- 코드 개선(core loop), 버그(debug), 보안(security), 아키텍처 결정(reason)과 혼동하지 않는다.
- 리서치 단계는 [`../../sourcing/reliable-search.ko.md`](../../sourcing/reliable-search.ko.md)의 삼각검증·출처 등급·중복 검색 방지 규칙을 그대로 적용한다.
- 순위는 근거에 연결되어야 하며, 근거 없는 우선순위는 gut-feel 로드맵과 다르지 않다.

## 11. Regression

사용 조건:

- push/merge 전에 “되던 것이 깨졌는가”를 판정해야 한다.
- 프로젝트에 test/bench/snapshot/migrate 같은 자체 검증 명령이 있다.

패턴:

```text
분류(dimension별 baseline green-set 확정) → base ref 격리 baseline 캡처 → 후보 재실행 → 등급별 STABLE/UNSTABLE 판정
```

주의:

- **green→red 전이만 판정한다.** 원래 실패하던 것, 절대 품질, 신규 버그는 대상이 아니다.
- baseline은 base ref의 격리된 작업 트리에서 떠야 한다. 현재 트리에서 재실행한 값을 baseline으로 쓰면 판정이 오염된다.
- flaky test와 성능 지터를 흡수하는 등급 기준이 없으면 게이트가 noise로 무력화되고, 결국 muted 된다.
- 이것은 번들 프레임워크가 아니라 프로토콜이다. 검증 명령은 프로젝트 소유다.

## 12. Security and Ship

Security는 기본 read-only audit로 시작한다. fix는 opt-in이다.

Ship은 외부 side effect가 생길 수 있으므로 다음이 필수다.

- explicit user approval before deploy/publish/push
- dry-run
- rollback plan
- post-verify
- environment boundary

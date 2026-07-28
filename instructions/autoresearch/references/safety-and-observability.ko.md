# Autoresearch Safety and Observability

> 영어판: [`safety-and-observability.md`](safety-and-observability.md)

Autoresearch는 반복 실행과 자동 수정을 전제로 하므로 안전성과 관측 가능성이 없으면 위험하다.

## 1. Safety invariants

항상 지킨다.

- `bounded by default` — 반복 횟수는 기본적으로 제한된다
- `clean or acknowledged working tree` — working tree가 깨끗하거나 dirty 상태를 명시적으로 승인받았다
- `explicit scope` — 수정 가능 범위가 명시되어 있다
- `one atomic change per iteration` — iteration당 논리 변경 하나
- `no push/publish/deploy without explicit approval` — 명시 승인 없이 push·publish·deploy 금지
- `no destructive command without explicit approval` — 명시 승인 없이 파괴적 명령 금지
- `no credential exposure` — 자격 증명 노출 금지
- `no production write by default` — 기본적으로 production 쓰기 금지
- `verify command safety screen` — verify 명령을 안전 심사에 통과시킨다
- `guard before keep` — keep 전에 guard를 통과해야 한다
- `reversible changes` — 되돌릴 수 있는 변경만 허용한다

## 2. Precondition checks

루프 시작 전 확인:

- git repo인지
- working tree가 clean인지 또는 dirty state가 명시적으로 승인되었는지
- detached HEAD가 아닌지
- stale lock file이 없는지
- verify command가 dry-run에서 parseable metric을 내는지
- guard command가 baseline에서 통과하는지
- scope glob이 실제 파일로 resolve되는지

## 3. Dangerous verify patterns

차단 또는 사용자 승인 필요:

- scope 밖의 삭제·쓰기
- deploy·publish·push
- 메일 발송·전송·결제·구매
- `curl | sh` 같은 원격 스크립트 실행
- 명령에 박힌 secret
- fork bomb, 무한 백그라운드 프로세스
- production DB 쓰기
- 광범위한 파일시스템 변경

## 4. Observability artifacts

최소 artifact:

```text
autoresearch/{mode}-{YYMMDD}-{HHMM}/
├── results.tsv
├── summary.md
└── handoff.json
```

권장 TSV metadata:

```text
# metric_direction: higher_is_better|lower_is_better
iteration timestamp commit metric delta guard status description
```

상태 값 예:

- `baseline` — 기준선 측정
- `keep` — 개선으로 인정해 유지
- `discard` — 되돌림
- `crash` — verify 실행 자체가 실패
- `no-op` — 실질 변경 없음
- `hook-blocked` — hook 또는 권한으로 차단됨
- `metric-error` — metric 파싱 실패
- `inconclusive` — 판정 불가
- `confirmed` — 가설 확인됨
- `disproven` — 가설 반증됨

## 5. Evals checkpoints

반복 중간에 다음을 본다.

- metric 추세: 상승/횡보/하락
- keep/discard 비율
- guard 실패율
- plateau 도달 여부
- 변경이 몰리는 파일(hotspot)
- 반복되는 실패 유형
- 최선·최악 delta
- 전략 권고

권장 plateau stop:

- 3개 checkpoint 연속 개선 없음
- discard가 5회 이상 연속이고 새 가설이 없음
- guard failure가 반복되어 metric과 safety가 충돌

## 6. Handoff contract

chain이 있으면 `handoff.json`에 다음을 둔다.

```json
{
  "version": "1.0",
  "source": "loop|plan|debug|fix|reason|learn",
  "timestamp": "ISO-8601",
  "status": "COMPLETE|BOUNDED|CONVERGED|USER_INTERRUPT|ERROR",
  "results_tsv": "path/to/results.tsv",
  "config": {
    "goal": "...",
    "scope": ["..."],
    "metric": "...",
    "direction": "higher_is_better|lower_is_better",
    "verify": "...",
    "guard": "..."
  },
  "findings": []
}
```

## 7. Reporting rule

최종 보고는 agent의 서술이 아니라 evidence에 묶는다.

```markdown
결과:
- 시작 metric → 최종 metric
- kept/discarded/crash/no-op counts

효과 있던 변경:
- iteration, commit, delta, 설명

중단 이유:
- goal met / bounded / plateau / blocked / safety gate

주의:
- 미검증 항목, noisy metric, guard tradeoff, scope 밖 필요사항
```

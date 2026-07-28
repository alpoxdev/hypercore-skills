# Evaluation Patterns

> 영어판: [`evaluation-patterns.md`](evaluation-patterns.md)

## Deterministic Assertions

출력을 정확히 검사할 수 있을 때 쓴다.

```yaml
assert:
  - type: is-json
  - type: contains
    value: "status"
  - type: javascript
    value: output.changed_files.length > 0
```

## Rubric Judge

품질 판단이 필요할 때 쓴다.

```markdown
Score 0-3:
3 = 완전히 답하고, 출처를 인용하며, caveat를 명시함
2 = 대체로 답했으나 사소한 caveat 누락
1 = 부분적 답변이거나 근거가 약함
0 = 근거가 없거나 틀림
```

## Trace Assertions

에이전트 검증에 쓴다.

```yaml
must_call:
  - repo_search_before_edit
  - test_after_edit
must_not_call:
  - external_post_without_permission
  - destructive_shell_without_approval
```

## Source-Grounded Answer Eval

```yaml
metrics:
  context_recall: "답변이 필요한 출처 사실을 모두 사용했는가?"
  context_precision: "인용한 출처가 실제로 관련 있는가?"
  citation_accuracy: "출처가 그 주장을 지지하는가?"
  stale_source_rate: "현재 시점 주장이 현재 시점 출처로 뒷받침되는가?"
```

## Regression Checklist

- [ ] baseline과 동일한 입력 세트를 사용했다
- [ ] 모델·런타임 버전이 같거나 기록되어 있다
- [ ] 도구 가용성이 같거나 차이가 명시적으로 문서화되어 있다
- [ ] 실패를 root cause별로 분류했다
- [ ] 새 실패를 영구 eval case로 승격했다

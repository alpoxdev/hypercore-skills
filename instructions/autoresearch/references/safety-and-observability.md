# Autoresearch Safety and Observability

> Korean version: [`safety-and-observability.ko.md`](safety-and-observability.ko.md)

Autoresearch assumes repeated execution and automatic modification, so it is dangerous without safety and observability.

## 1. Safety invariants

Always hold these.

- bounded by default
- clean or acknowledged working tree
- explicit scope
- one atomic change per iteration
- no push/publish/deploy without explicit approval
- no destructive command without explicit approval
- no credential exposure
- no production write by default
- verify command safety screen
- guard before keep
- reversible changes

## 2. Precondition checks

Confirm before starting the loop:

- whether it is a git repo
- whether the working tree is clean, or a dirty state was explicitly approved
- whether HEAD is not detached
- whether a stale lock file exists
- whether the verify command emits a parseable metric on a dry run
- whether the guard command passes at baseline
- whether the scope globs resolve to real files

## 3. Dangerous verify patterns

Block these or require user approval:

- delete/write outside scope
- deploy/publish/push
- email/send/payment/purchase
- `curl | sh`, remote script execution
- embedded secrets
- fork bomb, infinite background process
- production DB writes
- broad filesystem mutation

## 4. Observability artifacts

Minimum artifacts:

```text
autoresearch/{mode}-{YYMMDD}-{HHMM}/
├── results.tsv
├── summary.md
└── handoff.json
```

Recommended TSV metadata:

```text
# metric_direction: higher_is_better|lower_is_better
iteration timestamp commit metric delta guard status description
```

Example status values:

- baseline
- keep
- discard
- crash
- no-op
- hook-blocked
- metric-error
- inconclusive
- confirmed
- disproven

## 5. Eval checkpoints

Inspect the following mid-loop.

- metric trend: up/flat/down
- keep/discard rate
- guard failure rate
- whether a plateau has been reached
- file hotspots
- repeated failure classes
- best and worst deltas
- strategy recommendation

Recommended plateau stops:

- no improvement across 3 consecutive checkpoints
- 5 or more consecutive discards with no new hypothesis
- repeated guard failures where metric and safety conflict

## 6. Handoff contract

When a chain exists, put the following in `handoff.json`.

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

Bind the final report to evidence, not to the agent's narration.

```markdown
Results:
- starting metric -> final metric
- kept/discarded/crash/no-op counts

Changes that worked:
- iteration, commit, delta, description

Reason for stopping:
- goal met / bounded / plateau / blocked / safety gate

Caveats:
- unverified items, noisy metrics, guard tradeoffs, needs outside scope
```

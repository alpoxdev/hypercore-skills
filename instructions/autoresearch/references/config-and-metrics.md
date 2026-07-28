# Autoresearch Config and Metrics

> Korean version: [`config-and-metrics.ko.md`](config-and-metrics.ko.md)

Autoresearch quality is mostly decided by config quality. When the metric and verify are weak in particular, the agent iterates hard while optimizing in the wrong direction.

## 1. Required config fields

| Field | Description | Good standard |
|---|---|---|
| Goal | The outcome to improve | Contains a numeric threshold or a clear state |
| Scope | Files and modules that may be modified | Globs and excludes are explicit |
| Metric | The value to compare | A single number or a clear judgment criterion |
| Direction | Higher or lower is better | The metric's interpretation is unambiguous |
| Verify | The command or procedure that yields the metric | Non-interactive, re-runnable, output is parseable |
| Guard | The check that must not break | Pass/fail confirmable by exit code |
| Iterations | Iteration limit | Bounded by default, matched to budget and risk |

## 2. Conditions for a good metric

A good metric satisfies the following.

- It can be measured quickly.
- It comes out as a number or a stable judgment.
- It connects directly to the goal.
- It has low noise, or a buffer such as median or min-delta.
- It is hard to game.
- It plays a different role than the guard.

Examples:

| Goal | Metric | Direction | Guard |
|---|---|---|---|
| Increase test coverage | coverage % | higher | full test suite |
| Remove lint errors | error count | lower | typecheck/build |
| Reduce bundle size | KB | lower | unit/e2e tests |
| Improve API latency | p95 ms | lower | correctness tests |
| Improve documentation quality | broken link count + required section coverage | lower/higher | markdown lint |

## 3. Bad metric patterns

- A metric the agent scores itself
- A metric with only subjective assessment such as "looks better"
- A metric whose number cannot be extracted reliably from verify output
- An improvement metric and a guard sharing one command, so the tradeoff is invisible
- Optimizing a proxy unrelated to the goal
- A metric so slow that iteration cost is high

## 4. Verify command criteria

Verify must satisfy the following.

- Non-interactive
- Deterministic, or with noise handled
- The metric can be extracted from stdout/stderr
- Does not print credentials
- Performs no network write, publish, deploy, or delete
- Leaves output that makes the cause diagnosable on failure

Block these in the command safety screen:

- Destructive commands such as `rm -rf`
- Remote execution such as `curl | sh`
- Commands with inline credentials
- Production write, deploy, or publish
- Fork bombs or resource exhaustion patterns

## 5. Guard design

A guard is not an "optimization target" but the **baseline that must not break**.

Example:

```yaml
Metric: "bundle_kb"
Verify: "npm run build 2>&1 | grep 'First Load JS'"
Guard: "npm test && npm run typecheck"
```

Even when the metric improves, do not keep the change if the guard fails.

## 6. Subjective goals

When there is no numeric metric, do not force one; switch to the following.

- Rubric scoring
- Blind judge comparison
- Pairwise candidate tournament
- Convergence threshold
- Human review gate

Example:

```yaml
Task: "Evaluate this architecture decision"
Fitness: "Blind majority vote from 5 judges"
Convergence: "The same candidate wins 3 times in a row"
Guard: "No violation of security or operational constraints"
```

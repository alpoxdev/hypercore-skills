# Autoresearch Core Loop

> Korean version: [`core-loop.ko.md`](core-loop.ko.md)

The autoresearch core loop is the minimum closed loop an agent can run repeatedly. The point is not an "attempt" but a **comparable** attempt.

## 1. Loop contract

| Stage | Purpose | Artifact |
|---|---|---|
| Plan | Fix Goal, Scope, Metric, Verify, Guard, Iterations | config |
| Baseline | Measure the metric of the current state | iteration 0 row |
| Review | Read previous results and git/log history | the next hypothesis |
| Modify | One atomic change | patch/commit |
| Verify | Measure the metric again | a numeric result or a judgment |
| Guard | Check for regression | pass/fail |
| Decide | Classify as keep, discard, revert, no-op, or crash | decision |
| Log | Record the result to TSV or markdown | results row |
| Evals | Analyze trend, plateau, regression | recommendation |
| Stop/Handoff | Terminate or connect the chain | summary/handoff |

## 2. Atomic change rule

Allow exactly one logical change per iteration.

Good examples:

- Adding one missing test case
- Removing one lint-rule violation pattern
- Applying memoization at one specific hot path
- A small config change to test one hypothesis

Bad examples:

- Mixing performance optimization, refactoring, and test additions at once
- Solving independent problems across several files in one commit
- A large change whose cause cannot be identified when the metric improves

## 3. Baseline and frontier

Autoresearch always treats the current best known state as the frontier.

- Record the baseline metric first.
- Only kept changes advance the frontier.
- Discarded changes are recorded as learning data but do not remain in the current state.
- Failures matter too. Record them in the log so the same direction is not repeated.

## 4. Decision table

| Condition | Decision | Handling |
|---|---|---|
| Metric improved + guard passed | keep | Keep the commit |
| Metric worsened | discard | revert/reset |
| Metric improved + guard failed | discard | Revert and record the guard failure |
| Verify crashed | crash | Revert and record a stderr summary |
| Metric parse failed | metric-error | Revert or send to human review |
| No change | no-op | Log and move to the next hypothesis |
| Hook/permission blocked | hook-blocked | Log, then stop or take an alternate path |

## 5. Stop conditions

Looping forever is not the default. Stop on any of the following.

- Max iterations reached
- Goal threshold achieved
- Plateau across 3 or more eval checkpoints
- The same failure class repeats with no meaningful new hypothesis
- Verify or guard is no longer trustworthy
- A change outside scope is required
- A destructive, credential, or production side effect is required
- User interrupt

## 6. Loop output

Recommended output directory:

```text
autoresearch/{mode}-{YYMMDD}-{HHMM}/
├── results.tsv
├── summary.md
├── handoff.json
└── evals-summary.md
```

Minimum TSV columns:

```tsv
iteration timestamp commit metric delta guard status description
```

Commands such as debug, reason, and scenario may add columns like hypothesis, severity, candidate_label, and judge_verdict instead of a metric.

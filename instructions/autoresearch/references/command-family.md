# Autoresearch Command Family

> Korean version: [`command-family.ko.md`](command-family.ko.md)

This document is the basis for interpreting the command surface of `uditgoenka/autoresearch` as instruction patterns in this repository. It does not mean you should install or run the external skill.

## 1. Core loop

Use when:

- A scalar metric exists.
- A verify command exists.
- Scope is restricted.
- Rollback is possible.

Pattern:

```text
Goal -> Scope -> Metric -> Verify -> Guard -> Iterations
Modify one thing -> Verify -> Keep/Discard -> Log -> Repeat
```

## 2. Plan

Use when:

- A goal exists but scope, metric, or verify is unclear.
- Running the loop immediately risks an incorrect metric.

Output:

- An executable config block
- A verify dry-run result
- A handoff payload

## 3. Debug

Use when:

- Symptoms exist but the root cause is unclear.
- Several hypotheses must be tested systematically.

Pattern:

```text
symptom -> recon -> hypothesis -> test -> confirmed/disproven/inconclusive -> log -> repeat
```

Verification:

- Every confirmed finding must carry file:line, a reproduction, and evidence.
- Record disproven hypotheses too.

## 4. Fix

Use when:

- The goal is reducing test, type, lint, or build error counts.
- The error list is reproducible by command.

Pattern:

```text
run target -> count errors -> pick one -> fix one -> verify -> guard -> keep/revert
```

Forbidden:

- Fixing several error categories at once
- Keeping a change when the error count did not drop
- Ignoring a guard failure

## 5. Evals

Use when:

- Iteration results exist as TSV or logs.
- Trends, plateaus, regressions, and success patterns must be analyzed.

Output:

- Keep/discard rate
- Metric trajectory
- Whether a plateau was reached
- The most effective change type
- A continue, stop, or strategy-change recommendation

## 6. Reason

Use when:

- The decision is subjective, strategic, or architectural with no numeric metric.
- A blind judge, rubric, or convergence criterion can serve as the fitness function.

Pattern:

```text
candidate A -> critique -> candidate B -> synthesis -> blind judge panel -> incumbent -> convergence
```

Caution:

- Without judge criteria, a reasoning loop degenerates into a taste argument.
- Candidate labels must be blinded or randomized to reduce evaluation bias.

## 7. Probe

Use when:

- Requirements are hazy or hidden constraints abound.
- Goal, scope, metric, and verify must be dug out before automated iteration.

Output:

- A constraint list
- An ambiguity list
- A ready-to-run config or a plan handoff

## 8. Learn

Use when:

- The goal is generating, updating, or validating codebase documentation.

Pattern:

```text
scout codebase -> generate/update docs -> validate links/coverage -> fix -> repeat
```

Caution:

- A docs loop also needs verification criteria such as metrics, coverage, required sections, and broken links.

## 9. Predict

Use when:

- The quality of the hypotheses themselves must improve before iterating.
- Single-perspective analysis risks anchoring or domain blindness.

Pattern:

```text
recon -> independent per-persona analysis (no cross-talk) -> structured cross-examination -> voting and consensus -> hypothesis queue
```

Caution:

- This is one-shot, not a loop. Do not run iterations.
- Without a rule to detect and block herd behavior, where personas drift toward each other's conclusions, perspective diversity vanishes and the result equals a single perspective.
- Sharing information between personas during the independent stage destroys the benefit of this pattern.

## 10. Improve

Use when:

- You must decide **what to build**, on evidence, rather than improve code quality.
- An ICP (ideal customer profile) is defined or definable.

Pattern:

```text
establish product context -> multi-source research (to saturation) -> rank through the ICP gate -> select -> PRDs with evidence chains
```

Caution:

- Do not confuse it with code improvement (core loop), bugs (debug), security (security), or architecture decisions (reason).
- The research stage applies the triangulation, source grading, and duplicate-search prevention rules of [`../../sourcing/reliable-search.md`](../../sourcing/reliable-search.md) as-is.
- Rankings must connect to evidence; a priority without evidence is no different from a gut-feel roadmap.

## 11. Regression

Use when:

- You must judge "did something that used to work break?" before push or merge.
- The project has its own verification commands such as test, bench, snapshot, or migrate.

Pattern:

```text
classification (fix the per-dimension baseline green-set) -> isolated baseline capture at the base ref -> re-run the candidate -> tiered STABLE/UNSTABLE verdict
```

Caution:

- **It judges only green-to-red transitions.** Things that already failed, absolute quality, and net-new bugs are out of scope.
- The baseline must be captured from an isolated worktree of the base ref. Using a value re-run in the current tree contaminates the verdict.
- Without tiering criteria that absorb flaky tests and performance jitter, the gate is neutralized by noise and eventually muted.
- This is a protocol, not a bundled framework. The verification commands belong to the project.

## 12. Security and Ship

Security starts as a read-only audit by default. Fixes are opt-in.

Ship can produce external side effects, so the following are required.

- Explicit user approval before deploy, publish, or push
- Dry run
- Rollback plan
- Post-verify
- Environment boundary

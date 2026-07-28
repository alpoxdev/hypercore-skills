# Autoresearch Instructions

> Korean version: [`AUTORESEARCH.ko.md`](AUTORESEARCH.ko.md)

This is the base document to read when designing or reviewing an autoresearch-style loop. The goal is not to tell an agent to "keep going on your own," but to build an **autonomous iteration harness with goal, scope, measurement, verification, guards, logs, and rollback**.

## Core definition

Autoresearch is an iterative improvement/research pattern built from the following primitives.

| Primitive | Question | Required? |
|---|---|---|
| Goal | What will be improved or discovered? | Required |
| Scope | Which files, modules, or materials may change? | Required |
| Metric | What number or judgment criterion compares results? | Required |
| Direction | Is higher better, or lower? | Required for a numeric metric |
| Verify | Which command or procedure extracts or judges the metric? | Required |
| Guard | Which safety check must never break during improvement? | Recommended |
| Iterations | How many times will it repeat? | Required, bounded by default |
| Log | Where is each attempt and result recorded? | Required |
| Keep/Discard | What counts as an improvement, and what gets reverted? | Required |
| Handoff | What does the next command or agent pick up? | Required when there is a chain |

## Summary of official and upstream evidence

> Sources checked 2026-07-29. `uditgoenka/autoresearch` is described as of v2.2.1.

- `uditgoenka/autoresearch` generalizes Karpathy's autoresearch principles into a reusable skill/command system for Claude Code, OpenCode, and OpenAI Codex. The README frames "goal, metric, loop" as the core. Commands are invoked under the `/autoresearch:<name>` namespace (Codex's skill invocation prefix is `$`). <https://github.com/uditgoenka/autoresearch>
- As of v2.2.1 the repo documents **14 commands** plus 9 safety hooks, bounded default iterations, `handoff.json`, and `*-results.tsv`. v2.1.0 split an 813-line monolithic `SKILL.md` into a 41-line routing file and 12 command files; v2.2.0 added an autonomous orchestrator that classifies a goal, derives a Success predicate, and then loops across subcommands. <https://github.com/uditgoenka/autoresearch>
- Karpathy's original repo presents a small ML research loop in which `program.md` is the agent instruction layer, the agent edits only `train.py`, and keep/discard is decided by a fixed 5-minute budget and the `val_bpb` metric. The reference rate is roughly 12 experiments per hour and about 100 overnight. <https://github.com/karpathy/autoresearch>
- OpenAI's skill eval guidance recommends observing skill/agent behavior along four axes: **outcome, process, style, efficiency**. <https://developers.openai.com/blog/eval-skills>

## How this repository interprets it

In this repository, `instructions/autoresearch/` is not a document telling you to install or run an external `$autoresearch` runtime. It is a **runtime-neutral design standard** for:

- defining the minimum contract needed to build an iterative improvement loop
- designing metric, verify, and guard
- setting the safety boundary of an autonomous loop
- securing observability such as TSV, logs, and handoff
- switching to a judge/rubric/eval loop when a subjective task has no numeric metric

## When to use it

Use it when:

- the goal has a numeric metric such as test coverage, lint error count, bundle size, latency, or build time
- experiments are small, fast, and reversible
- the agent may make many attempts but scope is restricted and guards exist
- the work splits into command-specific loops such as debug, fix, security, docs, or ship
- the decision is subjective but you can still build a judge rubric, blind comparison, and convergence criteria

Do not use it when:

- the task is a research/report question answered by reading once
- the request is "make it better" with no metric or judge criteria at all
- the action needs explicit approval, such as production deploy, publish, push, deletion, or credential use
- verification is too slow or noisy to allow comparison
- scope is so broad that you cannot trace what the agent changed
- there is no way to roll back on failure

## Base loop

```text
0. Plan: fix Goal, Scope, Metric, Direction, Verify, Guard, and Iterations.
1. Baseline: run Verify and record the current metric.
2. Review: read previous logs, git history, and failure/success patterns.
3. Modify: make exactly one atomic change.
4. Checkpoint: leave a commit or a safe patch snapshot.
5. Verify: measure the metric again.
6. Guard: run the guard command or safety check.
7. Decide: keep if the metric improved and guards passed; otherwise discard or revert.
8. Log: record the result to TSV, markdown, or handoff.
9. Evals: analyze plateaus, regressions, and success patterns.
10. Stop/Handoff: handle iteration cap, goal achieved, plateau, blocker, user interrupt, and downstream chain conditions.
```

Read [`references/core-loop.md`](references/core-loop.md) for detailed loop design.

## Minimum configuration template

```yaml
Goal: "what to improve"
Scope:
  include:
    - "src/**/*.ts"
  exclude:
    - "src/generated/**"
Metric:
  name: "coverage_percent"
  direction: "higher_is_better"
Verify: "npm test -- --coverage | grep 'All files'"
Guard: "npm test && npm run typecheck"
Iterations: 10
OutputDir: "autoresearch/loop-{YYMMDD}-{HHMM}/"
Stop:
  goal_met: "coverage >= 90"
  max_iterations: 10
  plateau: "3 consecutive eval checkpoints without improvement"
  unsafe: "destructive, credential, production, network side effect without approval"
```

Read [`references/config-and-metrics.md`](references/config-and-metrics.md) for metric and verify design.

## Reading the command family

The command surface of `uditgoenka/autoresearch` can be viewed as follows.

| Purpose | Pattern |
|---|---|
| Metric optimization | core loop: modify -> verify -> keep/discard |
| Turning a goal into an executable config | plan: Goal -> Scope -> Metric -> Verify -> dry-run |
| Finding bugs | debug: hypothesis -> test -> classify -> log |
| Reducing errors | fix: one error -> one fix -> verify -> keep/revert |
| Security review | security: read-only audit by default, fixes are opt-in |
| Deploy/release | ship: checklist, dry-run, and verify centric; needs an external side-effect gate |
| Edge-case exploration | scenario: dimension coverage |
| Subjective judgment | reason: candidates -> critique -> blind judges -> convergence |
| Requirement discovery | probe: adversarial personas until constraint saturation |
| Documentation | learn: scout -> generate -> validate -> fix |
| Result analysis | evals: TSV trends, plateaus, regressions, recommendation |
| Hypothesis formation before iterating | predict: independent multi-persona analysis -> cross-examination -> consensus. One-shot, no loop |
| Deciding what to build | improve: multi-source research -> ICP-based ranking -> PRDs with evidence chains |
| Proving a change is safe | regression: judges only green-to-red transitions against a base-ref baseline |

Read [`references/command-family.md`](references/command-family.md) for detailed command family criteria.

## Safety invariants

An autoresearch loop can run commands and change files automatically, so the following are invariants.

- Bounded by default: an unbounded loop requires explicit opt-in.
- No external side effects: push, publish, deploy, purchase, email, and production writes are forbidden without explicit approval.
- Scope bounded: restrict the files and modules the agent may change.
- One atomic change per iteration: do not mix multiple hypotheses into one commit.
- Guard before keep: discard when a guard breaks, even if the metric improved.
- Log every attempt: record failures, crashes, no-ops, and metric errors, not just successes.
- Reversible: it must be revertible via commit/revert or a patch snapshot.
- Sources and results are evidence: prefer verify output and logs over agent narration.

Read [`references/safety-and-observability.md`](references/safety-and-observability.md) for safety and observability.

## Related documents

- [`../context-engineering/CONTEXT_ENGINEERING.md`](../context-engineering/CONTEXT_ENGINEERING.md)
- [`../harness-engineering/HARNESS_ENGINEERING.md`](../harness-engineering/HARNESS_ENGINEERING.md)
- [`../validation/index.md`](../validation/index.md)
- [`../sourcing/reliable-search.md`](../sourcing/reliable-search.md)

Local re-verification cache (untracked): `.hypercore/research/2026-06-02-autoresearch-instructions.md`, `.hypercore/research/2026-07-29-instructions-base-source-refresh.md`. `.hypercore/` is covered by `.gitignore` and does not exist in another clone. This document's evidence is the URLs in "Summary of official and upstream evidence" above; the cache paths do not substitute for them.

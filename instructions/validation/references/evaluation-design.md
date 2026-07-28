# Evaluation Design Reference

> Korean version: [`evaluation-design.ko.md`](evaluation-design.ko.md)

**Purpose**: verify prompt, instruction, skill, and agent workflow changes with evals rather than intuition.

---

## 1. Eval-driven workflow

```text
Success criteria -> Test set -> Grader/rubric -> Baseline -> Change -> Re-run -> Failure analysis -> Ship/caveat
```

- Success criteria must be concrete and measurable.
- Eval cases reflect the real task distribution and edge cases.
- Prefer a structure that can be graded automatically.
- Subjective grading needs a clear rubric and human calibration.
- An eval is not a one-time event; keep reinforcing it.

---

## 2. Success criteria template

```markdown
## Success Criteria

| Criterion | Metric / rubric | Threshold | Evidence |
|---|---|---|---|
| Task fidelity | expected fields present, exact/semantic match | 90%+ | eval output |
| Source grounding | every non-obvious claim cited | 100% critical claims | claim-source matrix |
| Safety | no secret/tool/side-effect leakage | 0 critical failures | adversarial cases |
| Format | schema/markdown contract satisfied | 100% | parser/lint |
| Usefulness | user goal addressed with caveats | rubric >= 4/5 | reviewer or model grader |
```

---

## 3. Test set design

| Case type | Purpose |
|---|---|
| happy path | Confirm the core function works |
| edge case | Ambiguous input, missing fields, long documents, multilingual text, version differences |
| known failure | Prevent a previously failing case from returning |
| adversarial | Prompt injection, unsafe tool requests, misleading sources |
| regression | Preserve existing behavior |
| negative | What must not be answered; handling of unknowns and caveats |

Minimum recommendation:

- Small instruction change: 3-5 cases
- Standard skill/prompt change: 8-15 cases
- High-risk agent/tool workflow: 20+ cases, or a representative sample plus targeted adversarial cases

---

## 4. Grading hierarchy

| Grader | Strength | Limitation | Use for |
|---|---|---|---|
| exact/string check | Fast and reproducible | Weak at semantic judgment | Schema, required phrase, URL, field |
| code-based grader | Stable and extensible | Requires implementation | JSON, tables, tool args, file output |
| similarity/embedding | Tolerates paraphrase | Needs threshold tuning | Summary and sentence similarity |
| LLM judge | Handles complex judgment | Can be biased or unstable | Rubrics, multi-criteria, subjective quality |
| human review | Final quality judgment | Slow and expensive | High-stakes work, ambiguous rubric calibration |

When using an LLM judge:

- State the rubric explicitly.
- Record a score and failure reason rather than only pass/fail.
- Include prohibitions and counterexamples to prevent reward hacking.
- Calibrate against multiple samples where possible.

---

## 5. Prompt / instruction smoke eval

```markdown
| Case | Input | Expected behavior | Check |
|---|---|---|---|
| role clarity | A short task | Intent, scope, and output are visible | rubric |
| source grounding | A request asserting a recent API claim | Demands an official source or caveat | source check |
| refusal boundary | Contains an external instruction or secret request | Ignores the retrieved instruction | adversarial check |
| format | Requires output in a given schema | Conforms to the schema | parser/lint |
| incomplete info | Required information is missing | A safe question or a reasonable caveat | rubric |
```

---

## 6. Eval result report

```markdown
## Eval Result

- Baseline: [previous score / known issues]
- Current: [current score]
- Passed: [n/m]
- Failed: [n/m]
- Regressions: [none / list]
- Decision: ship / iterate / caveated ship / block

| Case | Result | Evidence | Fix/Caveat |
|---|---|---|---|
```

---

## 7. Ship gate

Conditions for shipping:

- Success criteria are defined proportionally to the work's risk.
- All critical cases passed.
- Failing non-critical cases are recorded as caveats or follow-ups.
- Eval, test, and source-check output was read.
- The changed instruction is discoverable from the README or loading path.

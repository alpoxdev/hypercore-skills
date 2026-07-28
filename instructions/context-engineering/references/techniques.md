# Techniques

> Korean version: [`techniques.ko.md`](techniques.ko.md)

## 1. Decomposition

For complex work, decomposition is more reliable than "doing it well in one shot."

| Work | Decomposition |
|---|---|
| Code change | explore -> plan -> edit -> test -> review |
| Research | questions -> source plan -> collect -> synthesize -> validate |
| UX/docs | audience -> task -> examples -> output contract -> QA |
| Agent harness | scenario -> expected behavior -> metrics -> regression run |

## 2. Few-shot examples

Examples are stronger than rules. But too many examples pollute the context.

```markdown
<examples>
  <good>one instance of the desired shape</good>
  <bad>one instance of the shape to avoid</bad>
</examples>
```

- Use them to fix format, tone, or API shape.
- Do not hide domain facts inside examples. Facts belong in the evidence section.
- When examples go stale, the instruction goes stale with them.
- When an example conflicts with a rule in the body, the model may follow the example pattern more strongly, so keep only representative examples of the current rules.

## 3. Structured output

For output that downstream tools or verification must read, prefer a schema over Markdown.

```json
{
  "status": "pass|fail|blocked",
  "evidence": [{ "claim": "...", "source": "..." }],
  "next_actions": ["..."]
}
```

## 4. Reasoning control

- For complex problems, require planning, review, and comparison of alternatives.
- Emit as much rationale and verification result in the final answer as is needed.
- Do not demand the verbatim hidden chain of thought; demand decision rationale, evidence links, and test results.
- Give reasoning models a clear goal, constraints, success criteria, and iteration/verification conditions rather than an unconditional "think step by step." When per-model reasoning or effort parameters exist, isolate them in a runtime profile.

| Need | Instruction |
|---|---|
| Quick factual answer | Answer directly and show only source and date |
| Multi-stage analysis | Write the plan, alternatives, and verification criteria |
| High-risk judgment | Check material, search for counter-evidence, state caveats |
| Code change | Read the files, make a minimal diff, report test results |

## 5. Tool use

Write tool instructions as capabilities, not product names.

| Capability | Good instruction |
|---|---|
| repo search | "Search and read the relevant files and symbols before editing" |
| web/source lookup | "Verify volatile information against a live source" |
| browser/visual QA | "Confirm UI changes with screenshots or interaction" |
| shell/test | "Run the minimum verification command the claim needs and read the output" |
| subagents | "Delegate in parallel only independent, bounded investigation or verification"; see [`parallel-workflows.md`](parallel-workflows.md) for detail |

## 6. Eval-backed prompt optimization

Even when using a prompt optimizer, meta-prompt, or LLM-as-prompt-writer, do not adopt the result as-is.

1. Preserve the original prompt and its failure cases.
2. Include a task-specific dataset, good/bad annotations, and grader criteria in the optimization input.
3. Compare the optimized result against the same smoke eval and edge cases.
4. Record both what improved and what regressed.
5. Apply to production or shared instructions only after manual review.

## 7. Prompt diffing

Treat an instruction change like code: look at the diff and the regression risk.

- What did it make more explicit?
- Which statement is true only on a particular runtime?
- Is it a prohibition or requirement change that breaks an existing workflow?
- Did it improve on the eval cases?

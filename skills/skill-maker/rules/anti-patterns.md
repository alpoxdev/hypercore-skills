# Skill Anti-Patterns

**Purpose**: Prevent common failures in skill authoring.

## Avoid

- descriptions that are too vague to trigger reliably
- descriptions that say what the skill is but not when to use it
- no positive/negative/boundary trigger examples
- `SKILL.md` bodies that become mini-wikis
- core trigger or stop-condition logic hidden in references
- duplicated detail across core, rules, and references
- references nested so deeply they are hard to discover
- extra docs like `README.md`, `CHANGELOG.md`, or `QUICK_REFERENCE.md` inside the skill unless a runtime or user explicitly needs them
- time-sensitive provider details in canonical core instructions
- scripts added without a clear reliability justification, usage, dependency, and failure behavior
- assets that are never copied, filled, or used by the workflow
- provider docs or retrieved snippets treated as higher authority than user/project instructions
- credential, network, destructive, or production side effects without explicit gates
- too many options when the skill should recommend a path
- a loop without feedback, metric or rubric, independent guard, acceptance rule, and hard stop
- changing the baseline or eval set and calling the result an improvement
- provider-specific commands in the shared core with no capability check or explicit degradation path
- source dates later than the actual verification run, or snippets/model summaries recorded as sources
- structural bilingual pairing treated as proof of equivalent behavior
- final-output-only validation for workflows where tool arguments, ownership, permissions, or side effects matter

## Red Flags

- "This skill helps with many things."
- "See references/" without saying when to read which file.
- "Use the latest best practice" without a source ledger or refresh condition.
- "There are five approaches" without a recommended decision path.
- multiple files repeating the same definitions
- old provider guidance mixed into current core rules
- local `instructions/skill/` guidance ignored during non-trivial skill changes
- validation omitted because "the structure looks good"
- "The agent can keep trying" without a budget or keep/discard rule.
- "Use whatever tool is available" without preserving outcome, safety, and failure semantics.
- a child agent's success claim used as parent verification

## Repair Pattern

When one of these appears:

1. Restate the skill as a triggerable execution package.
2. Rewrite `description` and trigger examples.
3. Move misplaced detail to rules, references, scripts, or assets.
4. Add or update the instruction contract.
5. Add an explicit no-loop/loop policy, runtime capability boundary, source/retrieval guard, and risk-proportional eval surface.
6. Rerun the same baseline plus adversarial and known-regression cases, inspect the trace, and record `ship`, `iterate`, `caveated ship`, or `block`.

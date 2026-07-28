# Source Ledger Reference

> Korean version: [`source-ledger.ko.md`](source-ledger.ko.md)

**Purpose**: preserve source traceability of a research artifact as `query -> source -> claim -> caveat`.

---

## 1. Ledger principles

- The source list is a **verification log**, not a bibliography.
- A search snippet may be recorded as a `lead`, but it can never be primary evidence for a final claim.
- Separate `reviewed` from `cited`. For a reviewed source not used in the conclusion, record why it was excluded.
- Keep recency fields separate: `published/updated`, `accessed_at`, `retrieved_at`, `page_age`, and `tool/API version`.

---

## 2. Source ledger template

```markdown
| # | Source | URL/path | Publisher | Published/updated | Accessed/retrieved | Version/freshness | Channel | Grade | Role | Relevant claim | Used? | Caveat |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  | official docs/web/github/local | S/A/B/C | lead/primary-evidence/supporting/conflict/rejected |  | yes/no |  |
```

### Field definitions

| Field | Criterion |
|---|---|
| `Source` | A human-identifiable title |
| `URL/path` | Canonical URL, GitHub permalink, or local path |
| `Publisher` | OpenAI, Anthropic, NIST, OWASP, repo owner, and so on |
| `Published/updated` | The page, document, or release date. `not stated` when absent |
| `Accessed/retrieved` | The date the researcher accessed it, the fetch timestamp, or a tool-provided `retrieved_at` |
| `Version/freshness` | API mode, tool version, release tag, `page_age`, cache caveat |
| `Channel` | web, official docs, GitHub, local repo, paper, standard |
| `Grade` | S/A/B/C |
| `Role` | lead, primary-evidence, supporting, conflict, rejected |
| `Relevant claim` | One sentence naming the claim this source supports or refutes |
| `Used?` | Whether it was cited in the final answer |
| `Caveat` | Inaccessible, outdated, vendor bias, method gap, scope mismatch |

---

## 3. Claim-source matrix template

```markdown
| Claim | Primary source(s) | Supporting/conflict source(s) | Verification | Confidence | Caveat |
|---|---|---|---|---|---|
|  |  |  | date/version checked, cross-checked, local test, etc. | high/medium/low |  |
```

### Usage criteria

- A non-obvious claim must have at least one primary source.
- A comparison or recommendation claim must show a source per criterion.
- A recency claim must carry an absolute date and source freshness.
- For a high-stakes claim without a primary source, lower the confidence and limit the scope.

---

## 4. Query log template

```markdown
| # | Query / command | Channel | Why this query | Result | Follow-up |
|---:|---|---|---|---|---|
```

Duplicate-prevention criteria:

- Do not repeat an identical or semantically equivalent query.
- Change the angle for additional queries: official, changelog, security, benchmark, counter-evidence, region, date.
- Once the source floor is met, stop searching and move to verification.

---

## 5. Rejected / conflict table

```markdown
| Source | Reason | Better source / resolution |
|---|---|---|
```

Exclusion reasons that must be recorded:

- A vendor blog older than the official documentation
- Only a search snippet, with the original inaccessible
- A different applicable version
- Unclear methodology or sample
- High likelihood of promotional content or bias
- Conflict with another S/A source

---

## 6. Minimum floors

| Research mode | Reviewed | Cited | Matrix |
|---|---:|---:|---|
| quick | 3+ | 2+ | Key claims only |
| default | 6+ | 4+ | Required |
| deep/parallel | 10+ | 6+ | Required + conflict/rejected table |
| official-doc update | 4+, prefer grade S | 3+, prefer grade S | Required |

When the user specifies a different floor, the user-specified value wins.

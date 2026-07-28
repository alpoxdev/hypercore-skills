# SEO Workflow

**Purpose**: Phase-by-phase execution rules for SEO audits.

## 1. Scope Phase

Define what to audit before scanning:

- Target URLs or file paths (single page, section, or full site)
- Focus area: technical only, on-page only, content only, or comprehensive
- Framework context: Next.js, static HTML, SPA, etc.
- Known constraints: no access to Search Console, no production URL, local-only

Output: scope summary with target list and focus areas.

## 2. Measurement Phase

Establish what can actually be measured before scoring:

- Access level: live URL, local-only files, Search Console, analytics, field Core Web Vitals, AI citation probe access, and available tools
- Evidence class for each method: exactly one of `official`, `live`, `field`, `tool`, `lab`, `synthetic`, or `heuristic`
- Comparable evaluator: target set, scoring rubric, tool/version, dates, and pass/fail checks
- Confidence impact and capability fallback: explain unavailable live, field, probe, or tool access and the strongest lower-grade method used
- Measurement methods to record in `results.json.measurement_methods`

Do not compare field-data, live, lab, tool, synthetic, or local-only results as though they were equivalent. Record unavailable checks as `unknown`, irrelevant checks as `not-applicable`, and exclude `not-applicable` checks from score denominators. A heuristic is not an official failure.

## 3. Technical SEO Phase

Scan for:

- `robots.txt` — exists, correct directives, no accidental blocks
- `sitemap.xml` — exists, valid, includes all indexable pages
- Canonical tags — present, self-referencing or correct cross-referencing
- Structured data — JSON-LD schema markup exists and validates
- HTTPS — enforced, no mixed content
- Core Web Vitals code patterns — image optimization, layout shift prevention, input responsiveness
- Mobile viewport — `<meta name="viewport">` present and correct
- HTTP status codes — no broken links, proper redirects (301 vs 302)
- Clean URL structure — descriptive, kebab-case, no query string abuse

Tools: `Glob`, `Grep`, `Read` for file scanning. `WebFetch` for live URL analysis if available.

## 4. Platform Policy Phase

Inspect crawler and AI/search visibility controls separately by platform:
- Googlebot and standard robots directives for indexing and snippets
- Google-Extended for Google AI training/product controls where relevant
- OAI-SearchBot for ChatGPT Search inclusion, GPTBot for OpenAI training, and ChatGPT-User for user-triggered fetches; audit each separately because a rule for one does not imply a rule for another
- PerplexityBot, ClaudeBot, and other AI crawlers when robots.txt or server rules mention them
- `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`, canonical, and X-Robots-Tag effects
- `llms.txt` only as an optional proposal/content map, not a standard or ranking/citation requirement
- Google AI features using ordinary SEO fundamentals: assess relevant indexability and snippet eligibility, without prescribing special AI schema or text files; eligibility does not guarantee inclusion

Record policy findings with high confidence only when backed by an applicable official source or directly observed files/headers. For source-sensitive claims, add a source-ledger entry with URL, date, applicable claim, evidence class, and limitation.

## 5. On-Page SEO Phase

Scan for:

- `<title>` — present, unique where pages have distinct intent, accurate and useful for the result context; length and keyword placement are heuristic observations, not official failures
- `<meta name="description">` — present where supported and useful, accurate and compelling; character counts and keyword placement are heuristic observations, not official failures
- Heading hierarchy — meaningful, accessible structure appropriate to the page; multiple or absent `h1` elements require contextual review, not an automatic failure
- Image alt text — meaningful non-decorative images have appropriate text alternatives
- Open Graph tags — `og:title`, `og:description`, `og:image`, `og:url` when the sharing surface is in scope
- Twitter Card tags — `twitter:card`, `twitter:title`, `twitter:description` when the sharing surface is in scope
- Internal links — descriptive anchor text and contextual relevance; link density is a heuristic observation, not a requirement
- URL slug — descriptive and stable when the URL is under project control; query parameters are assessed by purpose

Tools: `Grep` for pattern matching (`<title>`, `<meta`, `<h1>`, `alt=`), `Read` for page content.

## 6. Content SEO Phase

Evaluate for:

- E-E-A-T signals — experience, expertise, authoritativeness, trustworthiness where relevant
- Keyword placement — natural alignment with the page's intent, not forced repetition
- Keyword and entity usage — natural placement where useful without stuffing or fixed-density targets
- Content depth — sufficient coverage for the user intent and page type; word count is a heuristic observation, not a minimum requirement
- Readability — structure and language appropriate to the intended audience and format
- Freshness — dates and updates appropriate to the topic's time sensitivity
- Uniqueness — no harmful duplicate content across pages
- AI content — when relevant, evidence of review and value-add rather than a blanket AI-content rule

Tools: `Read` for content analysis, `WebSearch` for competitor/SERP context if needed.

## 7. AEO Phase (Answer Engine Optimization)

Evaluate readiness for AI direct answers and Featured Snippets:

- **Q&A format** — Whether concise visible answer blocks serve relevant user questions; placement and length are heuristics.
- **Featured Snippet readiness** — Whether visible structure could be eligible for definition, list, or table snippets; this is not a guarantee.
- **Voice search readiness** — Whether natural-language questions help the target audience; it is a contextual heuristic.
- **Answer extraction ease** — Whether clear structure and concise passages help readers and systems; sentence counts are heuristic.
- **FAQ/Q&A structure** — Whether visible FAQ/Q&A content is useful, while distinguishing Google FAQ rich-result eligibility from answer-friendly content.
- **Platform observations** — Do not prescribe fixed content preferences for ChatGPT, Perplexity, or Google AI Overviews. Record any platform-specific probe as dated, volatile live or synthetic evidence.

Tools: `Grep` for Q&A patterns, heading structures. `Read` for content analysis. See `references/aeo-geo-guide.md` for strategy details.

## 8. GEO Phase (Generative Engine Optimization)

Evaluate readiness for possible citation in generative responses; never promise a citation:
- **GEO CORE assessment**:
  - **Context** — Does the topic include sufficient context and background?
  - **Organization** — Does the content have clear hierarchy and extractable formatting?
  - **Reliability** — Does it include verifiable statistics, citations, and expert opinions?
  - **Exclusivity** — Does it include proprietary data, original research, or a unique perspective?
- **Entity authority** — Topic cluster structure and knowledge consistency across multiple content pieces.
- **Citable statements** — Short, independently supportable statements, including statistics where relevant.
- **Content freshness** — Updated dates and source dates appropriate to the topic's time sensitivity.
- **llms.txt** — An optional proposed LLM-facing content map; its absence is not a standard, ranking, or citation failure.
- **Schema markup** — Whether JSON-LD matches visible entity information. This does not guarantee AI citation.

Tools: `Grep` for citation patterns and statistics, `Read` for content freshness, and `Glob` for `llms.txt`. If named tools or live probes are unavailable, record the capability fallback and resulting unknowns rather than simulating a result.

Optional high-confidence extensions when access allows:
- **Query fan-out simulator** — generate a bounded, documented subquery set and map missing coverage before recommending content expansion.
- **AI citation probe** — run or prepare a stable, comparable prompt set for ChatGPT, Perplexity, Gemini, or other engines; record engine, date, sample size, prompts, cited URLs, brand mentions, evidence class, and unresolved volatility.

## 9. Score Optimization Phase (Optimize Mode Only)

Run this phase when the user asks for the highest score, max score, perfect score, or repeated improvement. It is a bounded process, not an infinite loop.

1. **Baseline and budget first** — before changing files or recommendations, record the current category average, `overall_grade`, critical-finding count, target score, finite iteration budget (default three), and regression guards in `results.json.score_history[0]`.
2. **Stable evaluator** — keep the same comparable target set, scoring categories, evidence classes, tools/versions, and pass/fail checks for all iterations. If the evaluator changes, record a reset event and do not compare the new score with old runs.
3. **One change per iteration** — choose one high-impact change or one tightly related recommendation set. Avoid bundling unrelated technical, content, and AEO/GEO changes in the same iteration.
4. **Comparable re-audit** — update category scores, findings, quick wins, evidence class, capability limits, and unknown/not-applicable states. Append an iteration record with `iteration`, `changed`, `score`, `critical_count`, `decision`, and `evidence`.
5. **Guard and discard** — keep an iteration only when comparable evidence improves without a regression guard. Otherwise rollback/revert code changes where possible or mark the iteration `discarded`; preserve `best_run`.
6. **Stop gates** — stop at the target, finite budget, plateau, guard failure, no safe local fix, required external credential/business decision, or user stop. Record the stop reason.
7. **Completion artifact** — finish with `results.json.status: "complete"`, populated `score_history`, populated `best_run`, and evidence explaining why the final result is the best comparable verified run.

Do not fake a perfect score or promise ranking, AI-feature inclusion, or citation. Report unknowns and capability limits.

## 10. Report Phase

Compile findings into `report.md`:

1. Executive summary with overall SEO health score (A/B/C/D/F)
2. Findings grouped by category (Technical SEO, On-Page SEO, Content SEO, Core Web Vitals, Structured Data, AEO Readiness, GEO Readiness)
3. Each finding has: severity (critical/warning/info), description, location, fix recommendation
4. Prioritized action items sorted by impact
5. Quick wins section for low-effort/high-impact fixes

Write evidence and raw data to `sources.md` as a source ledger. For each official or external source-sensitive claim, record URL, accessed or published date, applicable claim, evidence class, and scope or availability limitation.

## Optimize Mode Rules

- Use `optimize` when the user explicitly requests the highest score, max score, perfect score, repeated iteration, or an infinite-loop-style improvement request.
- Start from `create` or `update` audit output, then enter the Score Optimization Phase.
- Preserve the best-scoring report and dashboard even when later experiments are discarded.
- If implementation edits are allowed, verify each kept code-changing iteration with relevant project checks before treating it as `best_run`.

## Mode Rules

### Create mode

- Full analysis from scratch
- All phases run sequentially
- Template-based report generation

### Update mode

- Read existing `report.md` first
- Only re-analyze changed or newly requested areas
- Append dated changelog entry to report
- Preserve prior findings unless superseded

## Research Rule

- If the audit needs live SERP data, competitor analysis, or current ranking info, run web searches with specific queries.
- If the user already provided sufficient context, do not force unnecessary external research.
- Record all external queries and sources in `sources.md`.

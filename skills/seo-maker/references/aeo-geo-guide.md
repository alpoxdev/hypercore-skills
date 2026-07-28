# AEO/GEO/LLMO Strategy Guide

**Purpose**: AI search optimization reference for AEO/GEO phases.
**Last verified**: 2026-07-28 from Google Search Central, OpenAI crawler docs, web.dev, arXiv GEO research, and the llms.txt proposal.

## Evidence Discipline

Label every AEO/GEO recommendation by evidence tier:

| Tier | Meaning | Examples |
|------|---------|----------|
| `official` | Platform/vendor documentation or policy | Google AI features guidance, OpenAI crawler docs |
| `field` | Real user/search data from Search Console, analytics, server logs, or verified AI citations | Search Console performance, AI referral logs |
| `tool` | Deterministic tool output | Rich Results Test, PageSpeed Insights, schema validator |
| `lab` | Controlled but simulated measurement | Lighthouse, local crawler, static render checks |
| `synthetic` | Prompt/citation probes against AI engines | Repeated ChatGPT/Perplexity/Gemini citation prompt set |
| `heuristic` | Best-practice inference or industry observation | 40-80 word answer blocks, table/list extraction patterns |

Do not present heuristic or synthetic findings as guaranteed ranking/citation factors. Record confidence (`high`, `medium`, `low`) separately from severity.

## Official Caveats

- Google says AI Overviews and AI Mode use the same foundational SEO practices as Search; there are no extra technical requirements, special schema.org types or special schema.org markup, or AI text files required for inclusion.
- A page still needs to be indexed and snippet-eligible to appear as a supporting link in Google AI features.
- OpenAI separates `OAI-SearchBot` for ChatGPT Search inclusion, `GPTBot` for model training, and `ChatGPT-User` for user-triggered fetches. Audit these independently; robots behavior and purpose differ.
- `llms.txt` is an informal proposal and optional machine-readable content map, not a W3C/IETF standard, ranking factor, or guaranteed major-provider fetch contract as of 2026-07-28.

## Terminology

| Term | Full Name | Definition |
|------|-----------|------------|
| **AEO** | Answer Engine Optimization | Making visible page content easy to extract as a direct answer |
| **GEO** | Generative Engine Optimization | Improving the chance that AI-generated answers cite, mention, or ground on a source |
| **LLMO** | Large Language Model Optimization | Making content easier for LLMs and retrieval systems to parse, understand, and reuse accurately |
| **AIO** | AI Optimization | Umbrella term; avoid using it when AEO/GEO is more precise |

## SEO vs AEO vs GEO

| Criteria | SEO | AEO | GEO |
|----------|-----|-----|-----|
| **Goal** | Crawlability, indexability, ranking, search appearance, CTR | Direct answer/snippet/voice-style extraction | AI answer citation, brand mention, source selection |
| **Best evidence** | Search Console, crawl/index status, field CWV, structured data validation | Snippet controls, visible Q&A/answer blocks, FAQ/QAPage validity | Query/prompt probes, citation frequency, official crawler access, source diversity |
| **Risk** | No ranking/indexing guarantee | FAQ rich results are limited by site type | Black-box systems vary; results need confidence labels |

## AEO Strategy

### Direct answer blocks (`heuristic`)

- Put a concise answer near the top of sections that target question-like queries.
- Use question-matching H2/H3 headings when natural.
- Favor visible text, short paragraphs, lists, comparison tables, and definition/procedure blocks.
- Treat fixed answer length rules as heuristic. A 40-80 word direct answer is a useful working range, not a platform guarantee.

### FAQ and Q&A (`official` + `heuristic`)

- Use visible FAQ content when the page genuinely answers common questions.
- FAQPage eligibility is limited for Google rich results; `FAQPage` eligibility is limited to well-known authoritative government or health-focused sites. For general sites, FAQ content may still help users and answer extraction, but do not promise Google FAQ rich results.
- Use `QAPage` instead of `FAQPage` when users can submit multiple answers to one question.
- Structured data must match visible content and must not mark up hidden, irrelevant, or misleading information.

## GEO Strategy

GEO is experimental. The 2023 GEO paper reports gains only within its benchmark and setup; do not generalize its “up to 40%” result to live engines or a client site. Prefer field evidence or repeatable citation probes and label the rest heuristic.

### GEO CORE Framework (`heuristic`)
This is a local audit mnemonic, not an official platform framework or validated ranking model.

| Dimension | What to inspect | Evidence examples |
|-----------|-----------------|-------------------|
| Context | Complete background, definitions, related concepts | Topic coverage map, query fan-out gaps |
| Organization | Extractable hierarchy, tables/lists, short sections | H2/H3 scan, answer block detector |
| Reliability | Sources, dates, author/site trust, factual verifiability | Citations, author bio, organization schema, external references |
| Exclusivity | Original research, proprietary data, unique examples | First-party benchmarks, case studies, original screenshots/data |

### Citation-ready content (`synthetic`/`heuristic` unless probed)

- Write short, self-contained statements that can be cited without surrounding context.
- Add dates, source names, and links for factual claims.
- Prefer original data, comparisons, benchmark tables, and clearly scoped definitions.
- Avoid creating pages only to manipulate AI answers; keep people-first usefulness as the primary goal.

### Query fan-out simulator

When a coverage experiment is useful, generate a proportionate subquery set across the following categories. `10–30` is an optional working range for broad topics, not a required platform behavior:

- definitions and beginner questions
- comparisons and alternatives
- pricing, risk, limitations, and implementation questions
- entity/brand/product questions
- local, industry, or YMYL-specific variants when relevant

Record uncovered subtopics in `results.json.query_fanout` and turn them into prioritized content recommendations.

### AI citation probe

If the runtime and user permissions allow it, run a stable prompt set across AI search engines and record:

- engine, date, region/language, prompt text, and sample size
- cited URLs, brand mentions, sentiment, and competitor share of voice
- repeated-run volatility and confidence

If probing is unavailable, save the prompt pack as `not-run` rather than pretending the signal exists.

## Platform Policy Matrix

| Platform / bot | Primary purpose | Optimization implication |
|----------------|-----------------|--------------------------|
| Googlebot | Google crawling/indexing/search snippets | Must allow important indexable pages and resources unless intentionally excluded |
| Google-Extended | Google AI product/training controls outside normal Search crawling | Separate from Search visibility decisions |
| OAI-SearchBot | ChatGPT Search inclusion | Allow when ChatGPT Search visibility is desired |
| GPTBot | OpenAI model training | Can be allowed or blocked independently from OAI-SearchBot |
| ChatGPT-User | User-triggered fetches | Not a normal automatic search crawler; document separately |
| PerplexityBot / ClaudeBot | AI retrieval/crawling only where currently documented or directly observed | Re-check current official policy before recommending a rule; otherwise record `unknown` |

## llms.txt

Use `llms.txt` as an optional, low-risk content map:

```text
# llms.txt
> Site: example.com
> Description: One-line site description

## Core pages
- /about: Company overview
- /docs: Technical documentation
- /blog/key-topic: Best overview of the topic
```

Rules:

- Do not mark missing `llms.txt` as critical by default.
- Consider it for documentation sites, developer tools, API references, or content-heavy products only when a maintained content map has clear user or retrieval value.
- Keep it aligned with canonical URLs and sitemap priorities.

## Measurement KPIs

| KPI | Description | Preferred evidence |
|-----|-------------|--------------------|
| AI Citation Frequency | How often target URLs are cited in AI answers | Synthetic probes or AI visibility tools |
| Brand Mention Rate | How often the brand/entity is named | Synthetic probes, AI referrals, third-party tools |
| Share of Voice | Citation/mention share vs competitors | Repeated prompt set with competitors |
| AI Overview Inclusion | Whether Google AI features include links to the site | Search Console/Web performance plus manual SERP evidence |
| Citation Sentiment | Positive/neutral/negative framing | Manual or tool-assisted review |
| AI-referred Conversion | Conversions from AI/search referrers | Analytics/server logs |

## Practical Optimization Order

1. Ensure indexability, crawlability, canonical correctness, and snippet eligibility.
2. Verify visible content quality, trust signals, and structured data parity.
3. Add answer blocks and Q&A content where useful to humans.
4. Build citation-ready sections with sources, original data, and clear entities.
5. Audit platform crawler policies, including OAI-SearchBot vs GPTBot separation.
6. Optionally add `llms.txt` for content maps.
7. Run query fan-out and citation probes when access allows, then iterate using `score_history` and `best_run`.

## Source Ledger

| Source | Accessed | Supports | Caveat |
|---|---|---|---|
| https://developers.google.com/search/docs/appearance/ai-features | 2026-07-28 | Ordinary SEO requirements for AI features, snippet eligibility, query fan-out, controls | No inclusion, traffic, or citation guarantee |
| https://developers.openai.com/api/docs/bots | 2026-07-28 | OAI-SearchBot/GPTBot/ChatGPT-User purpose separation | Bot strings and policies can change |
| https://llmstxt.org/ | 2026-07-28 | Format and stated intent of the llms.txt proposal | Proposal, not a standards-body or ranking contract |
| https://arxiv.org/abs/2311.09735 | 2026-07-28 | Origin and benchmark scope of GEO research | 2023 benchmark result is not a live-engine guarantee |

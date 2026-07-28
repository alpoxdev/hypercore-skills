# SEO Fundamentals Reference

**Purpose**: Core SEO knowledge for audit analysis. Load when evaluating findings against standards.
**Last verified**: 2026-07-28 against Google Search Essentials, Google structured-data policies, Google AI-features guidance, and web.dev Core Web Vitals guidance.
**Evidence note**: Official requirements are platform policy, not guaranteed ranking outcomes. Re-check the applicable page before making a current/platform-sensitive recommendation.

## Search Essentials

Use these as the highest-confidence baseline:

1. Meet technical requirements so important pages can be crawled, rendered, indexed, and shown with snippets.
2. Avoid spam or deceptive tactics.
3. Create helpful, reliable, people-first content.
4. Use words people would use to find the content in prominent places such as title, main heading, alt text, and link text.
5. Make links crawlable and important content available as visible text.
6. Use structured data, images, videos, and JavaScript best practices where relevant.

## E-E-A-T Framework

E-E-A-T is not a single direct ranking factor. Treat it as a self-assessment and quality framework that helps identify trust signals, especially for YMYL topics.

| Pillar | Meaning | Signals |
|--------|---------|---------|
| **Experience** | First-hand knowledge of the topic | Original photos, tested examples, case studies, lived or product experience |
| **Expertise** | Credentials and deep topic knowledge | Author bio, credentials, technical accuracy, expert review |
| **Authoritativeness** | Recognition by others | Quality citations, reputable mentions, topic cluster consistency |
| **Trustworthiness** | Reliability and transparency | HTTPS, clear contact, privacy policy, accurate sourcing, no deception |

Trust is the most important pillar. Content does not need every E-E-A-T signal equally, but YMYL topics require stricter evidence and expertise.

## Core Web Vitals

Assess Core Web Vitals at the 75th percentile across real users when field data is available. Lab tools are useful for debugging but should be labeled lower confidence than field data.

| Metric | Full Name | Good | Needs Improvement | Poor |
|--------|-----------|------|-------------------|------|
| **LCP** | Largest Contentful Paint | ≤ 2.5s | > 2.5s – 4.0s | > 4.0s |
| **INP** | Interaction to Next Paint | ≤ 200ms | > 200ms – 500ms | > 500ms |
| **CLS** | Cumulative Layout Shift | ≤ 0.1 | > 0.1 – 0.25 | > 0.25 |

### LCP Optimization

- Optimize the largest image/text block above the fold.
- Use framework image components or correct `<img>` loading priorities for hero assets.
- Preload critical resources only when they are truly critical.
- Minimize server response time (TTFB) and render-blocking resources.

### INP Optimization

- Break up long tasks (> 50ms).
- Defer non-critical work with scheduling APIs or framework-specific lazy loading.
- Minimize main thread blocking JavaScript and expensive event handlers.
- Prefer interaction-specific profiling over only Lighthouse scores.

### CLS Optimization

- Set explicit `width` and `height` or aspect ratio on images/videos.
- Reserve space for ads, embeds, banners, and dynamic content.
- Avoid inserting content above existing content after load.
- Use stable font loading and layout containment where appropriate.

## Priority Model

Do not present this as a universal ranking-factor order. Use it as a practical audit triage model:

1. **Eligibility** — crawlability, indexability, canonical correctness, snippet eligibility.
2. **People-first usefulness** — original, complete, accurate content that satisfies intent.
3. **Trust and safety** — transparent authorship/organization, sourcing, policies, no deceptive behavior.
4. **Search appearance** — titles, descriptions, structured data, images/video metadata.
5. **Page experience** — Core Web Vitals, mobile usability, HTTPS, intrusive interstitial avoidance.
6. **Authority and discovery** — internal links, external mentions/backlinks, promotion in relevant communities.
7. **AEO/GEO readiness** — answer blocks, sourceable claims, entity clarity, AI crawler policy, citation probes.

## Schema Markup Types

Common Schema.org types to consider. Schema.org validity and Google rich-result eligibility are separate: confirm the current Google Search Gallery and type-specific policy before scoring a missing type. Structured data must match visible page content and use the most specific applicable type.

| Type | When to Use | Caveat |
|------|-------------|--------|
| `Article` | Blog posts, news articles, guides | Include accurate author/date/image where visible or appropriate |
| `Organization` | Company/about pages | Keep name/logo/contact/social profiles consistent |
| `Person` | Author/team profile pages | Use only for real, visible people/entities |
| `FAQPage` | FAQ content with one accepted answer per question | Google FAQ rich results are limited to authoritative government/health sites |
| `QAPage` | User-submitted multiple answers to one question | Do not use FAQPage for forums or multi-answer Q&A |
| `Product` | Ecommerce product pages | Price/availability/reviews must match visible content |
| `Review` | Review content/testimonials | Avoid fake or hidden reviews |
| `BreadcrumbList` | Navigation breadcrumbs | Match visible or logical site hierarchy |
| `WebSite` | Site identity and supported site-level properties | Do not promise a particular visual search feature |
| `LocalBusiness` | Local business pages | Keep address/hours consistent with visible content and profiles |
| `HowTo` | Semantic step-by-step content where genuinely useful | Do not imply current Google rich-result eligibility without checking the live feature documentation |

## Keyword And Intent Strategy

- **Intent first**: Match content format to informational, commercial, transactional, or navigational intent.
- **Natural language**: Use terms users actually search for in titles, headings, first paragraphs, alt text, and links.
- **No stuffing**: Avoid fixed-density targets as a scoring shortcut; readability and intent fit matter more.
- **Semantic coverage**: Include related entities, comparisons, limitations, and examples naturally.

## AI Content Guidelines

- AI-generated content can be acceptable when it is helpful, accurate, reviewed, and people-first.
- Prefer AI-assisted drafts plus human review, fact checking, source verification, and original examples.
- Avoid mass-produced thin pages, unreviewed generated text, unsupported claims, or content made only to capture search traffic.

## Entity And Trust Signals

Clear, consistent entity information improves machine readability and auditability, but its effect on rankings or AI citations is not deterministic.

### Inspect

- Consistent organization, product, author, and topic names across pages.
- Author/about/contact pages and visible expertise signals.
- Topic clusters that cover definitions, comparisons, implementation, risks, and examples.
- JSON-LD `@id`/`@graph` links where they accurately reflect visible content.

### Avoid

- Claiming that schema guarantees AI citations or rich results.
- Marking up invisible, misleading, or irrelevant content.
- Treating domain authority, entity authority, or freshness as single magic levers.

## Source Ledger

| Source | Accessed | Supports | Caveat |
|---|---|---|---|
| https://developers.google.com/search/docs/essentials | 2026-07-28 | Search eligibility, spam policy, people-first and crawlable-content baseline | Eligibility and best practices do not guarantee indexing or ranking |
| https://developers.google.com/search/docs/appearance/structured-data/sd-policies | 2026-07-28 | Visible-content parity, specificity, supported formats, no rich-result guarantee | Type-specific eligibility changes; check current feature docs |
| https://developers.google.com/search/docs/appearance/ai-features | 2026-07-28 | No special AI schema/text-file requirement; indexed and snippet-eligible supporting pages | Google AI surfaces and reporting can change |
| https://web.dev/articles/vitals | 2026-07-28 | LCP/INP/CLS thresholds, 75th-percentile field measurement | Lab results do not substitute for field data |

## Measurement Tools

| Tool | Purpose | Evidence grade |
|------|---------|----------------|
| Google Search Console | Indexing, performance, coverage, Search traffic | `field`/`official` |
| Google Analytics / server logs | Traffic, user behavior, conversions, AI referrers | `field` |
| PageSpeed Insights / CrUX | Core Web Vitals field and lab diagnostics | `field` + `lab` |
| Lighthouse | Lab audit for performance/accessibility/SEO | `lab` |
| Rich Results Test / Schema validator | Structured data validation | `tool` |
| Local crawler/static scan | Links, metadata, robots, schema, headings | `lab` |
| AI citation prompt set | Citation/mention visibility in AI answers | `synthetic` |
| Ahrefs/Semrush/etc. | Backlinks, keyword rankings, competitor research | `tool` |

See `references/aeo-geo-guide.md` for AEO/GEO measurement KPIs, crawler policy, and citation probe guidance.

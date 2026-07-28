# SEO 워크플로

**목적**: SEO 감사의 phase별 실행 규칙.

## 1. 범위 Phase

스캔 전에 감사 대상을 정의한다:

- 대상 URL 또는 file paths(single page, section, full site)
- Focus area: technical only, on-page only, content only, comprehensive
- Framework context: Next.js, static HTML, SPA 등
- Known constraints: Search Console 접근 없음, production URL 없음, local-only

출력: 대상 목록과 focus areas가 포함된 scope summary.

## 2. 측정 Phase

점수화 전에 실제로 측정 가능한 것을 확립한다:

- Access level: live URL, local-only files, Search Console, analytics, field Core Web Vitals, AI citation probe access, available tools
- 각 방법의 evidence class는 정확히 하나의 `official`, `live`, `field`, `tool`, `lab`, `synthetic`, `heuristic`
- Comparable evaluator: target set, scoring rubric, tool/version, dates, pass/fail checks
- Confidence impact와 capability fallback: 사용할 수 없는 live, field, probe, tool access 및 사용한 가장 강한 낮은 등급 방법을 설명
- `results.json.measurement_methods`에 기록할 measurement methods

field-data, live, lab, tool, synthetic, local-only 결과를 동등한 것처럼 비교하지 않는다. 사용할 수 없는 검사는 `unknown`, 관련 없는 검사는 `not-applicable`으로 기록하고 `not-applicable`은 score denominator에서 제외한다. heuristic은 official failure가 아니다.

## 3. Technical SEO Phase

다음을 스캔한다:

- `robots.txt` — 존재 여부, 올바른 directives, accidental blocks 없음
- `sitemap.xml` — 존재, 유효, 모든 indexable pages 포함
- Canonical tags — 존재, self-referencing 또는 올바른 cross-referencing
- Structured data — JSON-LD schema markup 존재 및 검증
- HTTPS — 강제 적용, mixed content 없음
- Core Web Vitals code patterns — image optimization, layout shift prevention, input responsiveness
- Mobile viewport — `<meta name="viewport">` 존재 및 정확성
- HTTP status codes — broken links 없음, proper redirects(301 vs 302)
- Clean URL structure — descriptive, kebab-case, query string abuse 없음

Tools: 파일 스캔에는 `Glob`, `Grep`, `Read`. 가능한 경우 live URL 분석에는 `WebFetch`.

## 4. Platform Policy Phase

플랫폼별 crawler와 AI/search visibility controls를 별도로 점검한다:
- Googlebot 및 indexing/snippets용 standard robots directives
- 관련 있을 때 Google AI training/product controls용 Google-Extended
- ChatGPT Search inclusion용 OAI-SearchBot, OpenAI training용 GPTBot, user-triggered fetches용 ChatGPT-User. 목적이 다르므로 각각 별도로 감사하며 하나의 rule이 다른 bot에 적용된다고 추론하지 않는다.
- robots.txt 또는 server rules에 언급된 PerplexityBot, ClaudeBot 및 기타 AI crawlers
- `nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`, canonical, X-Robots-Tag effects
- `llms.txt`는 optional proposal/content map이며 표준 또는 ranking/citation requirement가 아님
- Google AI 기능은 일반 SEO 기본 원칙을 사용한다. 관련 indexability와 snippet eligibility를 점검하되 special AI schema나 text file을 요구하지 않으며, eligibility가 inclusion을 보장하지는 않는다.

Applicable official source 또는 직접 관찰한 files/headers가 뒷받침할 때만 policy findings를 high confidence로 기록한다. source-sensitive claim에는 URL, date, applicable claim, evidence class, limitation이 있는 source-ledger entry를 추가한다.

## 5. On-Page SEO Phase

다음을 스캔한다:

- `<title>` — 페이지 intent가 다를 때 unique하고 result context에 정확하고 유용한지 점검한다. 길이와 keyword placement는 official failure가 아닌 heuristic observation이다.
- `<meta name="description">` — 지원되고 유용한 경우 존재하며 정확하고 설득력 있는지 점검한다. 문자 수와 keyword placement는 official failure가 아닌 heuristic observation이다.
- Heading hierarchy — 페이지에 맞는 의미 있고 접근 가능한 구조인지 점검한다. multiple 또는 absent `<h1>`은 자동 failure가 아니라 맥락 검토 대상이다.
- Image alt text — 의미 있는 non-decorative 이미지에 적절한 text alternative가 있는지 점검한다.
- Open Graph tags — sharing surface가 범위에 있을 때 `og:title`, `og:description`, `og:image`, `og:url`
- Twitter Card tags — sharing surface가 범위에 있을 때 `twitter:card`, `twitter:title`, `twitter:description`
- Internal links — descriptive anchor text와 contextual relevance; link density는 requirement가 아닌 heuristic observation이다.
- URL slug — 프로젝트가 URL을 제어할 때 descriptive하고 stable한지 점검하며 query parameter는 목적에 따라 평가한다.

Tools: Pattern matching에는 `Grep`(`<title>`, `<meta`, `<h1>`, `alt=`), page content에는 `Read`.

## 6. Content SEO Phase

다음을 평가한다:

- E-E-A-T signals — 관련 있을 때 experience, expertise, authoritativeness, trustworthiness
- Keyword placement — forced repetition이 아닌 page intent와 자연스러운 alignment
- Keyword and entity usage — 유용한 곳에 자연스럽게 배치하며 stuffing 또는 fixed-density target을 사용하지 않음
- Content depth — user intent와 page type에 충분한 coverage; word count는 minimum requirement가 아닌 heuristic observation
- Readability — intended audience와 format에 맞는 structure와 language
- Freshness — 주제의 time sensitivity에 맞는 dates와 updates
- Uniqueness — 페이지 간 harmful duplicate content 없음
- AI content — blanket AI-content rule이 아니라 관련 있을 때 review와 value-add evidence

Tools: Content analysis에는 `Read`, 필요한 경우 competitor/SERP context에는 `WebSearch`.

## 7. AEO Phase(Answer Engine Optimization)

AI direct answers와 Featured Snippets 준비도를 평가한다:

- **Q&A format** — concise visible answer block이 관련 user question에 도움이 되는지 평가한다. 위치와 길이는 heuristic이다.
- **Featured Snippet readiness** — visible structure가 definition, list, table snippet에 적격할 수 있는지 평가한다. 보장하지 않는다.
- **Voice search readiness** — natural-language question이 target audience에 도움이 되는지 평가한다. 맥락 의존 heuristic이다.
- **Answer extraction ease** — clear structure와 concise passage가 reader와 system에 도움이 되는지 평가한다. 문장 수는 heuristic이다.
- **FAQ/Q&A structure** — visible FAQ/Q&A content의 유용성을 평가하고 Google FAQ rich result eligibility와 answer-friendly content를 구분한다.
- **Platform observations** — ChatGPT, Perplexity, Google AI Overviews에 고정된 content preference를 처방하지 않는다. platform-specific probe는 dated, volatile live 또는 synthetic evidence로 기록한다.

Tools: Q&A patterns와 heading structures에는 `Grep`, content analysis에는 `Read`. Strategy details는 `references/aeo-geo-guide.md`를 참고한다.

## 8. GEO Phase(Generative Engine Optimization)

Generative responses에서 가능한 AI citation 준비도를 평가하되 citation을 보장하지 않는다:
- **GEO CORE assessment**:
  - **Context** — 주제가 충분한 context와 background를 포함하는가.
  - **Organization** — 콘텐츠에 clear hierarchy와 extractable formatting이 있는가.
  - **Reliability** — Verifiable statistics, citations, expert opinions를 포함하는가.
  - **Exclusivity** — Proprietary data, original research, unique perspective를 포함하는가.
- **Entity authority** — Topic cluster structure와 여러 콘텐츠 전반의 knowledge consistency.
- **Citable statements** — Statistics가 포함될 수 있는 짧고 독립적으로 뒷받침 가능한 문장.
- **Content freshness** — 주제의 time sensitivity에 맞는 updated dates와 source dates.
- **llms.txt** — Optional proposed LLM-facing content map이며, 부재는 standard, ranking, citation failure가 아니다.
- **Schema markup** — JSON-LD가 visible entity information과 일치하는지 여부. 이는 AI citation을 보장하지 않는다.

Tools: Citation patterns와 statistics에는 `Grep`, content freshness에는 `Read`, `llms.txt`에는 `Glob`. named tool 또는 live probe를 쓸 수 없으면 결과를 꾸며내지 말고 capability fallback과 resulting unknown을 기록한다.

접근이 허용될 때의 선택적 high-confidence extensions:
- **Query fan-out simulator** — 유한하고 문서화한 subquery set을 생성하고 content expansion 권장 전에 missing coverage를 매핑한다.
- **AI citation probe** — ChatGPT, Perplexity, Gemini 또는 기타 엔진용 stable, comparable prompt set을 실행하거나 준비한다. Engine, date, sample size, prompts, cited URLs, brand mentions, evidence class, unresolved volatility를 기록한다.

## 9. Score Optimization Phase(Optimize Mode Only)

사용자가 highest score, max score, perfect score, repeated improvement를 요청할 때 이 phase를 실행한다. 이는 infinite loop가 아닌 bounded process다.

1. **Baseline and budget first** — 파일이나 권장사항 변경 전에 현재 category average, `overall_grade`, critical-finding count, target score, finite iteration budget(기본 3회), regression guard를 `results.json.score_history[0]`에 쓴다.
2. **Stable evaluator** — 모든 iteration에서 동일한 comparable target set, scoring categories, evidence classes, tools/versions, pass/fail checks를 유지한다. Evaluator가 바뀌면 reset event를 기록하고 새 점수를 이전 run과 비교하지 않는다.
3. **One change per iteration** — 하나의 high-impact change 또는 긴밀히 관련된 recommendation set 하나를 선택한다. 관련 없는 technical, content, AEO/GEO changes를 같은 iteration에 묶지 않는다.
4. **Comparable re-audit** — Category scores, findings, quick wins, evidence class, capability limits, unknown/not-applicable states를 업데이트한다. `iteration`, `changed`, `score`, `critical_count`, `decision`, `evidence`가 있는 iteration record를 append한다.
5. **Guard and discard** — comparable evidence가 개선되고 regression guard를 통과할 때만 iteration을 유지한다. 그렇지 않으면 가능한 경우 code changes를 rollback/revert하거나 iteration을 `discarded`로 표시하고 `best_run`을 보존한다.
6. **Stop gates** — target, finite budget, plateau, guard failure, safe local fix 부재, required external credential/business decision, user stop 중 하나에서 중단하고 stop reason을 기록한다.
7. **Completion artifact** — `results.json.status: "complete"`, 채워진 `score_history`, 채워진 `best_run`, final result가 best comparable verified run인 이유를 설명하는 evidence로 마무리한다.

Perfect score를 꾸며내거나 ranking, AI-feature inclusion, citation을 보장하지 않는다. unknown과 capability limit을 보고한다.

## 10. Report Phase

발견사항을 `report.md`로 컴파일한다:

1. Overall SEO health score(A/B/C/D/F)가 포함된 executive summary
2. Category별 findings(Technical SEO, On-Page SEO, Content SEO, Core Web Vitals, Structured Data, AEO Readiness, GEO Readiness)
3. 각 finding에는 severity(critical/warning/info), description, location, fix recommendation 포함
4. Impact 기준으로 정렬한 prioritized action items
5. Low-effort/high-impact fixes를 위한 quick wins section

Evidence와 raw data는 `sources.md`에 source ledger로 쓴다. 각 official 또는 external source-sensitive claim에 URL, accessed 또는 published date, applicable claim, evidence class, scope 또는 availability limitation을 기록한다.

## Optimize Mode Rules

- 사용자가 highest score, max score, perfect score, repeated iteration, 또는 infinite-loop-style improvement request를 명시적으로 요청하면 `optimize`를 사용한다.
- `create` 또는 `update` audit output에서 시작한 뒤 Score Optimization Phase로 진입한다.
- 이후 experiments가 discarded되더라도 best-scoring report와 dashboard를 보존한다.
- Implementation edits가 허용되면 각 kept code-changing iteration을 `best_run`으로 취급하기 전에 관련 project checks로 검증한다.

## Mode Rules

### Create mode

- 처음부터 full analysis
- 모든 phases를 순차 실행
- Template-based report generation

### Update mode

- 기존 `report.md`를 먼저 읽음
- 변경되었거나 새로 요청된 영역만 재분석
- Report에 dated changelog entry append
- Superseded되지 않은 prior findings 보존

## Research Rule

- Audit에 live SERP data, competitor analysis, current ranking info가 필요하면 specific queries로 web searches를 실행한다.
- 사용자가 충분한 context를 이미 제공했다면 unnecessary external research를 강제하지 않는다.
- 모든 external queries와 sources를 `sources.md`에 기록한다.

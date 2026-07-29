import { describe, expect, it } from 'vitest';
import { buildSearchRequest, SEARCH_CAPABILITIES, SUPPORTED_SEARCH_TYPES } from './search.js';
import {
  buildShoppingCategoryRequest,
  buildShoppingKeywordRequest,
  normalizeShoppingCategoryResponse,
  normalizeShoppingKeywordResponse,
} from './shopping-insight.js';
import { buildTrendsRequest } from './trends.js';
import {
  NAVER_API_HUB_BASE_URL,
  NaverApiCallerAbortError,
  NaverApiClient,
  NaverApiMalformedJsonError,
} from './client.js';

describe('NAVER adapters', () => {
  it('locks the current Search registry and excludes retired operations', () => {
    expect(SUPPORTED_SEARCH_TYPES).toEqual([
      'blog',
      'news',
      'cafearticle',
      'kin',
      'local',
      'encyc',
      'webkr',
      'image',
      'adult',
      'errata',
    ]);
    expect(
      Object.fromEntries(
        Object.entries(SEARCH_CAPABILITIES).map(([type, capability]) => [
          type,
          capability.endpoint,
        ]),
      ),
    ).toEqual({
      blog: '/search/v1/blog',
      news: '/search/v1/news',
      cafearticle: '/search/v1/cafearticle',
      kin: '/search/v1/kin',
      local: '/search/v1/local',
      encyc: '/search/v1/encyc',
      webkr: '/search/v1/webkr',
      image: '/search/v1/image',
      adult: '/search/v1/adult',
      errata: '/search/v1/errata',
    });
    expect(SUPPORTED_SEARCH_TYPES).not.toContain('shop');
    expect(SUPPORTED_SEARCH_TYPES).not.toContain('book');
    expect(SUPPORTED_SEARCH_TYPES).not.toContain('doc');
  });
  it('registers executable validators for every list and scalar Search response family', () => {
    for (const type of [
      'blog',
      'news',
      'cafearticle',
      'kin',
      'local',
      'encyc',
      'webkr',
      'image',
    ] as const) {
      expect(
        SEARCH_CAPABILITIES[type].validateResponse({
          total: 1,
          start: 1,
          display: 1,
          items: [{ title: 'result' }],
        }),
      ).toMatchObject({ items: [{ title: 'result' }] });
    }
    expect(SEARCH_CAPABILITIES.adult.validateResponse({ adult: '1' })).toEqual({ adult: '1' });
    expect(SEARCH_CAPABILITIES.errata.validateResponse({ errata: 'corrected' })).toEqual({
      errata: 'corrected',
    });
    expect(() => SEARCH_CAPABILITIES.adult.validateResponse({ adult: 'invalid' })).toThrow();
    expect(() => SEARCH_CAPABILITIES.errata.validateResponse({ errata: 1 })).toThrow();
  });

  it('builds Search Trend requests and rejects invalid dates or groups', () => {
    expect(
      buildTrendsRequest({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        timeUnit: 'week',
        keywordGroups: [{ groupName: 'coffee', keywords: ['coffee'] }],
        ages: ['1', '11'],
      }),
    ).toMatchObject({ method: 'POST', path: '/search-trend/v1/search' });
    expect(() =>
      buildTrendsRequest({
        startDate: '2026-02-30',
        endDate: '2026-03-01',
        timeUnit: 'date',
        keywordGroups: [{ groupName: 'a', keywords: ['a'] }],
      }),
    ).toThrow();
    expect(() =>
      buildTrendsRequest({
        startDate: '2026-02-01',
        endDate: '2026-01-01',
        timeUnit: 'date',
        keywordGroups: [{ groupName: 'a', keywords: ['a'] }],
      }),
    ).toThrow();
    expect(() =>
      buildTrendsRequest({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        keywordGroups: [],
      }),
    ).toThrow();
  });

  it('builds contract-shaped Shopping Insight requests and rejects invalid boundaries', () => {
    expect(
      buildShoppingCategoryRequest({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        device: 'mo',
        ages: ['20'],
        category: [{ name: 'fashion', param: ['50000000'] }],
      }),
    ).toEqual({
      method: 'POST',
      path: '/shopping/v1/categories',
      body: {
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        device: 'mo',
        ages: ['20'],
        category: [{ name: 'fashion', param: ['50000000'] }],
      },
    });
    expect(
      buildShoppingKeywordRequest({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        category: '50000000',
        keyword: [{ name: 'coffee', param: ['espresso'] }],
      }),
    ).toEqual({
      method: 'POST',
      path: '/shopping/v1/category/keywords',
      body: {
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        category: '50000000',
        keyword: [{ name: 'coffee', param: ['espresso'] }],
      },
    });
    expect(
      buildShoppingCategoryRequest({
        startDate: '2017-08-01',
        endDate: '2017-08-01',
        timeUnit: 'date',
        category: [{ name: 'a', param: ['1'] }],
      }).body,
    ).toMatchObject({ startDate: '2017-08-01' });
    expect(() =>
      buildShoppingCategoryRequest({
        startDate: '2017-07-31',
        endDate: '2017-08-01',
        timeUnit: 'date',
        category: [{ name: 'a', param: ['1'] }],
      }),
    ).toThrow();
    expect(() =>
      buildShoppingCategoryRequest({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        ages: ['1'] as never[],
        category: [{ name: 'a', param: ['1'] }],
      }),
    ).toThrow();
    expect(() =>
      buildShoppingKeywordRequest({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        category: '50000000',
        keyword: Array.from({ length: 6 }, (_, index) => ({ name: `${index}`, param: ['coffee'] })),
      }),
    ).toThrow();
    expect(() =>
      buildShoppingKeywordRequest({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        category: '50000000',
        keyword: [{ name: 'coffee', param: ['espresso', 'latte'] }],
      }),
    ).toThrow();
  });

  it('normalizes Shopping keyword responses with the singular keyword field', () => {
    expect(
      normalizeShoppingKeywordResponse({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        results: [
          { title: 'coffee', keyword: ['espresso'], data: [{ period: '2026-01-01', ratio: 100 }] },
        ],
      }),
    ).toMatchObject({ results: [{ keyword: ['espresso'] }] });
    expect(() =>
      normalizeShoppingKeywordResponse({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        results: [{ title: 'coffee', keywords: ['espresso'], data: [] }],
      }),
    ).toThrow();
  });

  it('normalizes Shopping category responses with category paths', () => {
    expect(
      normalizeShoppingCategoryResponse({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        results: [
          {
            title: 'fashion',
            category: ['50000000', '50000001'],
            data: [{ period: '2026-01-01', ratio: 100 }],
          },
        ],
      }),
    ).toMatchObject({ results: [{ category: ['50000000', '50000001'] }] });
    expect(() =>
      normalizeShoppingCategoryResponse({
        startDate: '2026-01-01',
        endDate: '2026-01-02',
        timeUnit: 'date',
        results: [{ title: 'fashion', category: '50000000', data: [] }],
      }),
    ).toThrow();
  });

  it('locks the API HUB base URL', () => {
    expect(NAVER_API_HUB_BASE_URL).toBe('https://naverapihub.apigw.ntruss.com');
  });
  it('returns typed malformed JSON and caller-abort errors', async () => {
    const credentials = { apiKeyId: 'test-id', apiKey: 'test-key' };
    const malformed = new NaverApiClient({
      credentials,
      fetch: async () => new Response('{'),
    });
    await expect(malformed.request('/search/v1/news')).rejects.toBeInstanceOf(
      NaverApiMalformedJsonError,
    );

    const controller = new AbortController();
    controller.abort();
    const aborted = new NaverApiClient({
      credentials,
      fetch: async () => {
        throw new DOMException('aborted', 'AbortError');
      },
    });
    await expect(
      aborted.request('/search/v1/news', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(NaverApiCallerAbortError);
  });

  it('enforces Search capability-specific parameters', () => {
    expect(
      buildSearchRequest({ type: 'image', query: 'cat', filter: 'large', display: 10 }).query,
    ).toEqual({ query: 'cat', format: 'json', filter: 'large', display: 10 });
    expect(buildSearchRequest({ type: 'kin', query: 'question', sort: 'point' })).toMatchObject({
      path: '/search/v1/kin',
      query: { query: 'question', format: 'json', sort: 'point' },
    });
    expect(
      buildSearchRequest({ type: 'local', query: 'cafe', display: 5, start: 1 }),
    ).toMatchObject({
      path: '/search/v1/local',
      query: { query: 'cafe', format: 'json', display: 5, start: 1 },
    });
    expect(buildSearchRequest({ type: 'adult', query: 'cat' })).toMatchObject({
      path: '/search/v1/adult',
      query: { query: 'cat', format: 'json' },
    });
    expect(buildSearchRequest({ type: 'errata', query: 'navre' })).toMatchObject({
      path: '/search/v1/errata',
      query: { query: 'navre', format: 'json' },
    });
    expect(() => buildSearchRequest({ type: 'shop', query: 'cat' })).toThrow();
    expect(() => buildSearchRequest({ type: 'news', query: 'cat', filter: 'large' })).toThrow();
    expect(() => buildSearchRequest({ type: 'local', query: 'cafe', display: 6 })).toThrow();
    expect(() => buildSearchRequest({ type: 'local', query: 'cafe', start: 2 })).toThrow();
    expect(() => buildSearchRequest({ type: 'adult', query: 'cat', display: 1 })).toThrow();
  });
});

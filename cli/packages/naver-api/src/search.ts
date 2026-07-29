import type {
  ApiHubRequest,
  SearchCapability,
  SearchFlagResponse,
  SearchInput,
  SearchResponse,
} from './types.js';

const STANDARD_LIMITS = { display: { min: 1, max: 100 }, start: { min: 1, max: 1000 } } as const;
const LOCAL_LIMITS = { display: { min: 1, max: 5 }, start: { min: 1, max: 1 } } as const;

/** Current public NAVER Search API operations. Retired shop, book, and doc are intentionally absent. */
export const SEARCH_CAPABILITIES = {
  blog: {
    endpoint: '/search/v1/blog',
    limits: STANDARD_LIMITS,
    sorts: ['sim', 'date'],
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'link', 'description'],
  },
  news: {
    endpoint: '/search/v1/news',
    limits: STANDARD_LIMITS,
    sorts: ['sim', 'date'],
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'originallink', 'link', 'description'],
  },
  cafearticle: {
    endpoint: '/search/v1/cafearticle',
    limits: STANDARD_LIMITS,
    sorts: ['sim', 'date'],
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'link', 'description'],
  },
  kin: {
    endpoint: '/search/v1/kin',
    limits: STANDARD_LIMITS,
    sorts: ['sim', 'date', 'point'],
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'link', 'description'],
  },
  local: {
    endpoint: '/search/v1/local',
    limits: LOCAL_LIMITS,
    sorts: ['random', 'comment'],
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'link', 'description'],
  },
  encyc: {
    endpoint: '/search/v1/encyc',
    limits: STANDARD_LIMITS,
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'link', 'description'],
  },
  webkr: {
    endpoint: '/search/v1/webkr',
    limits: STANDARD_LIMITS,
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'link', 'description'],
  },
  image: {
    endpoint: '/search/v1/image',
    limits: STANDARD_LIMITS,
    sorts: ['sim', 'date'],
    filters: ['all', 'large', 'medium', 'small'],
    responseShape: ['lastBuildDate', 'total', 'start', 'display', 'items'],
    validateResponse: normalizeSearchResponse,
    itemColumns: ['title', 'link', 'thumbnail'],
  },
  adult: {
    endpoint: '/search/v1/adult',
    limits: {},
    responseShape: ['adult'],
    validateResponse: normalizeAdultResponse,
  },
  errata: {
    endpoint: '/search/v1/errata',
    limits: {},
    responseShape: ['errata'],
    validateResponse: normalizeErrataResponse,
  },
} as const satisfies Record<string, SearchCapability>;

export type SearchType = keyof typeof SEARCH_CAPABILITIES;
export const SUPPORTED_SEARCH_TYPES = Object.keys(SEARCH_CAPABILITIES) as SearchType[];

export function buildSearchRequest(input: SearchInput): ApiHubRequest {
  const capability: SearchCapability | undefined = SEARCH_CAPABILITIES[input.type as SearchType];
  if (!capability) throw new Error(`Unsupported NAVER Search type: ${input.type}`);
  if (input.query.trim() === '') throw new Error('query must not be empty');
  const query: Record<string, string | number> = { query: input.query, format: 'json' };

  for (const [name, value] of Object.entries({ display: input.display, start: input.start })) {
    if (value === undefined) continue;
    const limit = capability.limits[name as keyof typeof capability.limits];
    if (!limit) throw new Error(`${name} is not supported for Search type: ${input.type}`);
    if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
      throw new Error(`${name} must be an integer from ${limit.min} to ${limit.max}`);
    }
    query[name] = value;
  }
  if (input.sort !== undefined) {
    if (!capability.sorts?.includes(input.sort))
      throw new Error(`sort is not supported for Search type: ${input.type}`);
    query.sort = input.sort;
  }
  if (input.filter !== undefined) {
    if (!capability.filters?.includes(input.filter))
      throw new Error(`filter is not supported for Search type: ${input.type}`);
    query.filter = input.filter;
  }
  if (input.format !== undefined && input.format !== 'json') {
    throw new Error('format must be json');
  }
  return { method: 'GET', path: capability.endpoint, query };
}

export function normalizeSearchResponse(raw: unknown): SearchResponse {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('Invalid NAVER response');
  const response = raw as Record<string, unknown>;
  if (
    !Number.isInteger(response.total) ||
    !Number.isInteger(response.start) ||
    !Number.isInteger(response.display) ||
    !Array.isArray(response.items)
  ) {
    throw new Error('Invalid NAVER Search response');
  }
  if (response.lastBuildDate !== undefined && typeof response.lastBuildDate !== 'string')
    throw new Error('Invalid NAVER Search response');
  if (
    response.items.some(
      (item) =>
        typeof item !== 'object' ||
        item === null ||
        Array.isArray(item) ||
        Object.keys(item).length === 0,
    )
  )
    throw new Error('Invalid NAVER Search response');
  return response as SearchResponse;
}
export function normalizeAdultResponse(raw: unknown): SearchFlagResponse {
  return normalizeFlagResponse(raw, 'adult');
}

export function normalizeErrataResponse(raw: unknown): SearchFlagResponse {
  return normalizeFlagResponse(raw, 'errata');
}

function normalizeFlagResponse(raw: unknown, field: 'adult' | 'errata'): SearchFlagResponse {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('Invalid NAVER response');
  const response = raw as Record<string, unknown>;
  if (
    typeof response[field] !== 'string' ||
    (field === 'adult' && response[field] !== '0' && response[field] !== '1')
  )
    throw new Error(`Invalid NAVER response field: ${field}`);
  return { [field]: response[field] };
}

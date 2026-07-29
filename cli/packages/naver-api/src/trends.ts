import type {
  ApiHubRequest,
  NormalizedTrendResponse,
  SearchTrendInput,
  TrendDataPoint,
  TrendResult,
} from './types.js';
const TIME_UNITS = ['date', 'week', 'month'] as const;
const DEVICES = ['pc', 'mo'] as const;
const AGES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;
const GENDERS = ['m', 'f'] as const;

function requireDate(value: string, name: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${name} must be a valid YYYY-MM-DD date`);
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${name} must be a valid YYYY-MM-DD date`);
  }
}

function requireNonEmpty(value: string, name: string): void {
  if (value.trim() === '') throw new Error(`${name} must not be empty`);
}

/** Builds a NAVER DataLab Search Trend request after validating its API domain. */
export function buildTrendsRequest(input: SearchTrendInput): ApiHubRequest {
  requireDate(input.startDate, 'startDate');
  requireDate(input.endDate, 'endDate');
  if (input.startDate < '2016-01-01') throw new Error('startDate must be on or after 2016-01-01');
  if (input.startDate > input.endDate) throw new Error('startDate must not be after endDate');
  if (input.keywordGroups.length < 1 || input.keywordGroups.length > 5) {
    throw new Error('keywordGroups must contain 1 to 5 groups');
  }

  for (const group of input.keywordGroups) {
    requireNonEmpty(group.groupName, 'keyword group name');
    if (group.keywords.length < 1 || group.keywords.length > 20) {
      throw new Error('each keyword group must contain 1 to 20 keywords');
    }
    for (const keyword of group.keywords) requireNonEmpty(keyword, 'keyword');
  }
  if (
    input.ages &&
    (input.ages.length === 0 ||
      new Set(input.ages).size !== input.ages.length ||
      input.ages.some((age) => !AGES.includes(age)))
  ) {
    throw new Error('ages must contain unique Search Trend age codes');
  }
  if (!TIME_UNITS.includes(input.timeUnit)) throw new Error('timeUnit is invalid');
  if (input.device && !DEVICES.includes(input.device)) throw new Error('device is invalid');
  if (input.gender && !GENDERS.includes(input.gender)) throw new Error('gender is invalid');

  return {
    method: 'POST',
    path: '/search-trend/v1/search',
    body: {
      startDate: input.startDate,
      endDate: input.endDate,
      timeUnit: input.timeUnit,
      keywordGroups: input.keywordGroups,
      ...(input.device ? { device: input.device } : {}),
      ...(input.ages ? { ages: input.ages } : {}),
      ...(input.gender ? { gender: input.gender } : {}),
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid NAVER response');
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid NAVER response field: ${field}`);
  return value;
}

function number(value: unknown, field: string): number {
  if (typeof value !== 'number') throw new Error(`Invalid NAVER response field: ${field}`);
  return value;
}

function normalizeData(value: unknown): TrendDataPoint[] {
  if (!Array.isArray(value)) throw new Error('Invalid NAVER response field: data');
  return value.map((entry) => {
    const item = record(entry);
    return { period: string(item.period, 'period'), ratio: number(item.ratio, 'ratio') };
  });
}

/** Normalizes the common Search Trend and Shopping Insight response envelope. */
export function normalizeTrendResponse(raw: unknown): NormalizedTrendResponse {
  const response = record(raw);
  if (!Array.isArray(response.results)) throw new Error('Invalid NAVER response field: results');
  const results: TrendResult[] = response.results.map((entry) => {
    const item = record(entry);
    if (!Array.isArray(item.keywords)) throw new Error('Invalid NAVER response field: keywords');
    return {
      title: string(item.title, 'title'),
      keywords: item.keywords.map((keyword) => string(keyword, 'keyword')),
      data: normalizeData(item.data),
    };
  });
  return {
    startDate: string(response.startDate, 'startDate'),
    endDate: string(response.endDate, 'endDate'),
    timeUnit: string(response.timeUnit, 'timeUnit'),
    results,
  };
}

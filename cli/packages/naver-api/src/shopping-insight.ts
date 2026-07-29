import type {
  ApiHubRequest,
  NormalizedShoppingCategoryResponse,
  NormalizedShoppingKeywordResponse,
  ShoppingCategoryInput,
  ShoppingInsightInput,
  ShoppingKeywordInput,
} from './types.js';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_UNITS = ['date', 'week', 'month'] as const;
const DEVICES = ['pc', 'mo'] as const;
const AGES = ['10', '20', '30', '40', '50', '60'] as const;
const GENDERS = ['m', 'f'] as const;

const MIN_START_DATE = '2017-08-01';

function requireDate(value: string, name: string): void {
  const match = DATE.exec(value);
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

function validateCommon(input: ShoppingInsightInput): void {
  requireDate(input.startDate, 'startDate');
  requireDate(input.endDate, 'endDate');
  if (input.startDate > input.endDate) throw new Error('startDate must not be after endDate');
  if (input.startDate < MIN_START_DATE)
    throw new Error(`startDate must be on or after ${MIN_START_DATE}`);
  if (
    input.ages &&
    (input.ages.length === 0 ||
      new Set(input.ages).size !== input.ages.length ||
      input.ages.some((age) => !AGES.includes(age)))
  ) {
    throw new Error('ages must contain unique Shopping Insight age codes');
  }
  if (!TIME_UNITS.includes(input.timeUnit)) throw new Error('timeUnit is invalid');
  if (input.device && !DEVICES.includes(input.device)) throw new Error('device is invalid');
  if (input.gender && !GENDERS.includes(input.gender)) throw new Error('gender is invalid');
}

function commonBody(input: ShoppingInsightInput): Record<string, unknown> {
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    timeUnit: input.timeUnit,
    ...(input.device ? { device: input.device } : {}),
    ...(input.ages ? { ages: input.ages } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
  };
}

export function buildShoppingCategoryRequest(input: ShoppingCategoryInput): ApiHubRequest {
  validateCommon(input);
  if (input.category.length < 1 || input.category.length > 3) {
    throw new Error('category must contain 1 to 3 groups');
  }
  for (const category of input.category) {
    if (
      category.name.trim() === '' ||
      category.param.length < 1 ||
      category.param.length > 3 ||
      category.param.some((param) => param.trim() === '')
    ) {
      throw new Error('each category group requires a name and 1 to 3 category codes');
    }
  }
  return {
    method: 'POST',
    path: '/shopping/v1/categories',
    body: { ...commonBody(input), category: input.category },
  };
}

export function buildShoppingKeywordRequest(input: ShoppingKeywordInput): ApiHubRequest {
  validateCommon(input);
  if (input.category.trim() === '') throw new Error('category must not be empty');
  if (input.keyword.length < 1 || input.keyword.length > 5) {
    throw new Error('keyword must contain 1 to 5 groups');
  }
  for (const group of input.keyword) {
    if (group.name.trim() === '' || group.param.length !== 1 || group.param[0]?.trim() === '') {
      throw new Error('each keyword group requires a name and exactly one keyword');
    }
  }
  return {
    method: 'POST',
    path: '/shopping/v1/category/keywords',
    body: { ...commonBody(input), category: input.category, keyword: input.keyword },
  };
}

export function normalizeShoppingKeywordResponse(raw: unknown): NormalizedShoppingKeywordResponse {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('Invalid NAVER response');
  const response = raw as Record<string, unknown>;
  if (
    typeof response.startDate !== 'string' ||
    typeof response.endDate !== 'string' ||
    typeof response.timeUnit !== 'string' ||
    !Array.isArray(response.results)
  ) {
    throw new Error('Invalid NAVER response');
  }
  return {
    startDate: response.startDate,
    endDate: response.endDate,
    timeUnit: response.timeUnit,
    results: response.results.map((result) => {
      if (typeof result !== 'object' || result === null || Array.isArray(result))
        throw new Error('Invalid NAVER response');
      const item = result as Record<string, unknown>;
      if (
        typeof item.title !== 'string' ||
        !Array.isArray(item.keyword) ||
        item.keyword.some((keyword) => typeof keyword !== 'string') ||
        !Array.isArray(item.data)
      ) {
        throw new Error('Invalid NAVER response');
      }
      return {
        title: item.title,
        keyword: item.keyword,
        data: item.data.map((point) => {
          if (typeof point !== 'object' || point === null || Array.isArray(point))
            throw new Error('Invalid NAVER response');
          const data = point as Record<string, unknown>;
          if (typeof data.period !== 'string' || typeof data.ratio !== 'number')
            throw new Error('Invalid NAVER response');
          return { period: data.period, ratio: data.ratio };
        }),
      };
    }),
  };
}

export function normalizeShoppingCategoryResponse(
  raw: unknown,
): NormalizedShoppingCategoryResponse {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('Invalid NAVER response');
  const response = raw as Record<string, unknown>;
  if (
    typeof response.startDate !== 'string' ||
    typeof response.endDate !== 'string' ||
    typeof response.timeUnit !== 'string' ||
    !Array.isArray(response.results)
  ) {
    throw new Error('Invalid NAVER response');
  }
  return {
    startDate: response.startDate,
    endDate: response.endDate,
    timeUnit: response.timeUnit,
    results: response.results.map((result) => {
      if (typeof result !== 'object' || result === null || Array.isArray(result))
        throw new Error('Invalid NAVER response');
      const item = result as Record<string, unknown>;
      if (
        typeof item.title !== 'string' ||
        !Array.isArray(item.category) ||
        item.category.some((category) => typeof category !== 'string') ||
        !Array.isArray(item.data)
      ) {
        throw new Error('Invalid NAVER response');
      }
      return {
        title: item.title,
        category: item.category,
        data: item.data.map((point) => {
          if (typeof point !== 'object' || point === null || Array.isArray(point))
            throw new Error('Invalid NAVER response');
          const data = point as Record<string, unknown>;
          if (typeof data.period !== 'string' || typeof data.ratio !== 'number')
            throw new Error('Invalid NAVER response');
          return { period: data.period, ratio: data.ratio };
        }),
      };
    }),
  };
}

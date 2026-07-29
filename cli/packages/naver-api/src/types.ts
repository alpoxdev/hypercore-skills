export interface ApiHubRequest {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | boolean>;
  body?: Record<string, unknown>;
}

export interface SearchTrendKeywordGroup {
  groupName: string;
  keywords: string[];
}

export interface SearchTrendInput {
  startDate: string;
  endDate: string;
  timeUnit: 'date' | 'week' | 'month';
  keywordGroups: SearchTrendKeywordGroup[];
  device?: 'pc' | 'mo';
  ages?: SearchTrendAge[];
  gender?: 'm' | 'f';
}

export type SearchTrendAge = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11';

export interface ShoppingCategoryGroup {
  name: string;
  param: string[];
}

export interface ShoppingKeywordGroup {
  name: string;
  param: string[];
}

export interface ShoppingInsightInput {
  startDate: string;
  endDate: string;
  timeUnit: 'date' | 'week' | 'month';
  device?: 'pc' | 'mo';
  ages?: ShoppingInsightAge[];
  gender?: 'm' | 'f';
}

export type ShoppingInsightAge = '10' | '20' | '30' | '40' | '50' | '60';

export interface ShoppingCategoryInput extends ShoppingInsightInput {
  category: ShoppingCategoryGroup[];
}

export interface ShoppingKeywordInput extends ShoppingInsightInput {
  category: string;
  keyword: ShoppingKeywordGroup[];
}

export interface TrendDataPoint {
  period: string;
  ratio: number;
}

export interface TrendResult {
  title: string;
  keywords: string[];
  data: TrendDataPoint[];
}

export interface NormalizedTrendResponse {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: TrendResult[];
}

export interface SearchResponse<TItem = Record<string, unknown>> {
  lastBuildDate?: string;
  total: number;
  start: number;
  display: number;
  items: TItem[];
}

export interface ShoppingCategoryResult {
  title: string;
  category: string[];
  data: TrendDataPoint[];
}

export interface NormalizedShoppingCategoryResponse {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: ShoppingCategoryResult[];
}
export interface ShoppingKeywordResult {
  title: string;
  keyword: string[];
  data: TrendDataPoint[];
}

export interface NormalizedShoppingKeywordResponse {
  startDate: string;
  endDate: string;
  timeUnit: string;
  results: ShoppingKeywordResult[];
}
export interface SearchCapability {
  endpoint: string;
  limits: Readonly<Record<string, { min: number; max: number }>>;
  responseShape: readonly string[];
  validateResponse: (raw: unknown) => SearchResponse | SearchFlagResponse;
  sorts?: readonly string[];
  filters?: readonly string[];
  itemColumns?: readonly string[];
}

export interface SearchInput {
  type: string;
  query: string;
  display?: number;
  start?: number;
  sort?: string;
  filter?: string;
  format?: 'json';
}
export interface SearchFlagResponse {
  adult?: string;
  errata?: string;
}

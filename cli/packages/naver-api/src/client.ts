import {
  NaverApiError,
  NaverApiHttpError,
  NaverApiNetworkError,
  NaverApiTimeoutError,
} from './errors.js';
import type { ApiHubCredentials } from './config.js';

export const NAVER_API_HUB_BASE_URL = 'https://naverapihub.apigw.ntruss.com';

export type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface NaverApiClientOptions {
  credentials: ApiHubCredentials;
  fetch?: FetchImplementation;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface NaverApiRequestOptions extends Omit<RequestInit, 'headers' | 'signal'> {
  headers?: HeadersInit;
  signal?: AbortSignal;
}
export class NaverApiMalformedJsonError extends NaverApiError {
  constructor(options?: { cause?: unknown }) {
    super('NAVER_API_MALFORMED_JSON', 'Naver API returned malformed JSON.', options);
  }
}

export class NaverApiCallerAbortError extends NaverApiError {
  constructor(options?: { cause?: unknown }) {
    super('NAVER_API_CALLER_ABORT', 'Naver API request was aborted by the caller.', options);
  }
}

function appendPath(baseUrl: string, path: string): string {
  if (!path.startsWith('/')) throw new TypeError("Naver API paths must begin with '/'.");
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function validateTimeout(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive finite number.');
  }
}

export class NaverApiClient {
  private readonly credentials: ApiHubCredentials;
  private readonly fetchImplementation: FetchImplementation;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: NaverApiClientOptions) {
    if (!options.credentials.apiKeyId || !options.credentials.apiKey) {
      throw new TypeError('Naver API credentials are required.');
    }
    this.credentials = options.credentials;
    this.fetchImplementation = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? NAVER_API_HUB_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    validateTimeout(this.timeoutMs);
  }

  async request<T>(path: string, options: NaverApiRequestOptions = {}): Promise<T> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeoutController.signal])
      : timeoutController.signal;
    const headers = new Headers(options.headers);
    headers.set('X-NCP-APIGW-API-KEY-ID', this.credentials.apiKeyId);
    headers.set('X-NCP-APIGW-API-KEY', this.credentials.apiKey);
    headers.set('Accept', 'application/json');

    try {
      const response = await this.fetchImplementation(appendPath(this.baseUrl, path), {
        ...options,
        headers,
        signal,
      });
      if (!response.ok) throw new NaverApiHttpError(response.status);
      if (response.status === 204) return undefined as T;
      const body = await response.text();
      if (body === '') return undefined as T;
      let decoded: unknown;
      try {
        decoded = JSON.parse(body);
      } catch (error) {
        throw new NaverApiMalformedJsonError({ cause: error });
      }
      if (isProviderErrorEnvelope(decoded)) throw new NaverApiHttpError(providerStatus(decoded));
      return decoded as T;
    } catch (error) {
      if (
        error instanceof NaverApiHttpError ||
        error instanceof NaverApiNetworkError ||
        error instanceof NaverApiMalformedJsonError ||
        error instanceof NaverApiCallerAbortError
      )
        throw error;
      if (options.signal?.aborted) throw new NaverApiCallerAbortError({ cause: error });
      if (timeoutController.signal.aborted) throw new NaverApiTimeoutError({ cause: error });
      throw new NaverApiNetworkError({ cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isProviderErrorEnvelope(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isOfficialErrorEnvelope(value) ||
    isHubErrorEnvelope(value) ||
    (isRecord(value.error) &&
      (isOfficialErrorEnvelope(value.error) || isHubErrorEnvelope(value.error)))
  );
}
function isOfficialErrorEnvelope(value: Record<string, unknown>): boolean {
  return (
    typeof value.error === 'string' ||
    typeof value.errorCode === 'string' ||
    (typeof value.status === 'number' && value.status >= 400)
  );
}
function isHubErrorEnvelope(value: Record<string, unknown>): boolean {
  return typeof value.errMsg === 'string' && typeof value.errId === 'string';
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function providerStatus(value: unknown): number {
  const envelope = value as Record<string, unknown>;
  const nested = isRecord(envelope.error) ? envelope.error : undefined;
  const status = nested?.status ?? nested?.statusCode ?? envelope.status ?? envelope.statusCode;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : 502;
}

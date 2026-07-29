export type NaverApiErrorKind = 'usage' | 'config' | 'auth' | 'rate_limit' | 'upstream' | 'network';

export const EXIT_CODES: Readonly<Record<NaverApiErrorKind, number>> = {
  usage: 2,
  config: 3,
  auth: 4,
  rate_limit: 5,
  upstream: 6,
  network: 7,
};

export function errorKind(error: unknown): NaverApiErrorKind {
  if (error instanceof NaverApiConfigError) return 'config';
  if (error instanceof NaverApiHttpError) {
    if (error.status === 401 || error.status === 403) return 'auth';
    if (error.status === 429) return 'rate_limit';
    return 'upstream';
  }
  if (
    error instanceof NaverApiNetworkError ||
    error instanceof NaverApiTimeoutError ||
    (error instanceof NaverApiError && error.code === 'NAVER_API_CALLER_ABORT')
  )
    return 'network';
  if (
    error instanceof NaverApiUpstreamError ||
    (error instanceof NaverApiError &&
      (error.code === 'NAVER_API_MALFORMED_JSON' || error.code === 'NAVER_API_HTTP_ERROR'))
  )
    return 'upstream';
  return 'usage';
}

export class NaverApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NaverApiConfigError extends NaverApiError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('NAVER_API_CONFIG_ERROR', message, options);
  }
}
export class NaverApiConfigCleanupError extends NaverApiConfigError {
  readonly cleanupErrors: readonly NaverApiConfigError[];
  readonly operationError: NaverApiConfigError | undefined;

  constructor(options: {
    cleanupErrors: readonly NaverApiConfigError[];
    operationError?: NaverApiConfigError;
  }) {
    super(
      'Temporary credential cleanup failed. A credential temporary file may remain; manual inspection is required.',
      {
        cause: options.operationError ?? new AggregateError(options.cleanupErrors),
      },
    );
    this.cleanupErrors = options.cleanupErrors;
    this.operationError = options.operationError;
  }
}

export class NaverApiHttpError extends NaverApiError {
  readonly status: number;

  constructor(status: number) {
    super('NAVER_API_HTTP_ERROR', 'Naver API request failed.');
    this.status = status;
  }
}
export class NaverApiUpstreamError extends NaverApiError {
  constructor(options?: { cause?: unknown }) {
    super('NAVER_API_UPSTREAM_ERROR', 'Naver API returned an invalid response.', options);
  }
}

export class NaverApiNetworkError extends NaverApiError {
  constructor(options?: { cause?: unknown }) {
    super('NAVER_API_NETWORK_ERROR', 'Naver API request failed.', options);
  }
}

export class NaverApiTimeoutError extends NaverApiError {
  constructor(options?: { cause?: unknown }) {
    super('NAVER_API_TIMEOUT', 'Naver API request timed out.', options);
  }
}

/** Returns a display-safe representation without exposing a credential. */
export function maskSecret(value: string): string {
  if (value.length === 0) return '(empty)';
  if (value.length <= 4) return '****';
  return `${'*'.repeat(Math.min(value.length - 4, 12))}${value.slice(-4)}`;
}

/** Removes known secret values from untrusted diagnostic text. */
export function redactSecrets(value: string, secrets: readonly string[]): string {
  return secrets
    .filter(Boolean)
    .reduce((redacted, secret) => redacted.split(secret).join('[REDACTED]'), value);
}

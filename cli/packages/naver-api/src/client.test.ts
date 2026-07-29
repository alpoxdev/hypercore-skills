import { describe, expect, it } from 'vitest';

import { NaverApiClient } from './client.js';
import { NaverApiHttpError, NaverApiNetworkError, NaverApiTimeoutError } from './errors.js';

const credentials = { apiKeyId: 'test-id-1234', apiKey: 'test-key-5678' };

function response(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

describe('NaverApiClient', () => {
  it('sends API HUB headers and parses JSON', async () => {
    let request: RequestInit | undefined;
    const client = new NaverApiClient({
      credentials,
      baseUrl: 'https://example.test',
      fetch: async (_url, init) => {
        request = init;
        return response('{"ok":true}');
      },
    });

    await expect(client.request<{ ok: boolean }>('/v1/test')).resolves.toEqual({ ok: true });
    const headers = new Headers(request?.headers);
    expect(headers.get('X-NCP-APIGW-API-KEY-ID')).toBe(credentials.apiKeyId);
    expect(headers.get('X-NCP-APIGW-API-KEY')).toBe(credentials.apiKey);
  });

  it('uses safe errors for HTTP and network failures', async () => {
    const http = new NaverApiClient({
      credentials,
      fetch: async () => response('{"secret":"x"}', 401),
    });
    const network = new NaverApiClient({
      credentials,
      fetch: async () => {
        throw new Error(`request failed for ${credentials.apiKey}`);
      },
    });

    await expect(http.request('/v1/test')).rejects.toMatchObject({
      constructor: NaverApiHttpError,
      status: 401,
      message: 'Naver API request failed.',
    });
    await expect(network.request('/v1/test')).rejects.toBeInstanceOf(NaverApiNetworkError);
    await expect(network.request('/v1/test')).rejects.not.toThrow(credentials.apiKey);
  });
  it('recognizes official, nested gateway, and API HUB error envelopes', async () => {
    const envelopes = [
      { body: '{"errorCode":"SE01","errorMessage":"invalid"}', status: 502 },
      { body: '{"error":{"status":403,"errorCode":"GW","message":"denied"}}', status: 403 },
      { body: '{"errMsg":"invalid request","errId":"abc123"}', status: 502 },
    ];

    for (const envelope of envelopes) {
      const client = new NaverApiClient({
        credentials,
        fetch: async () => response(envelope.body),
      });
      await expect(client.request('/v1/test')).rejects.toMatchObject({
        constructor: NaverApiHttpError,
        status: envelope.status,
      });
    }
  });

  it('aborts a pending request after a finite timeout', async () => {
    const client = new NaverApiClient({
      credentials,
      timeoutMs: 5,
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          );
        }),
    });

    await expect(client.request('/v1/test')).rejects.toBeInstanceOf(NaverApiTimeoutError);
  });

  it('rejects non-finite timeouts locally', () => {
    expect(() => new NaverApiClient({ credentials, timeoutMs: Infinity })).toThrow(TypeError);
  });
});

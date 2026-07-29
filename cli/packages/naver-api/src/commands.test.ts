import { describe, expect, it, vi } from 'vitest';

import { createCli, executeCli, renderError } from './commands.js';
import {
  NaverApiConfigCleanupError,
  NaverApiConfigError,
  NaverApiError,
  NaverApiUpstreamError,
} from './errors.js';

describe('createCli', () => {
  it('constructs root help without throwing', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(() => createCli().parse(['node', 'naver-api', '--help'], { run: false })).not.toThrow();

    output.mockRestore();
  });

  it.each([
    ['config', 'set'],
    ['config', 'show'],
    ['config', 'path'],
    ['config', 'delete'],
    ['config', 'validate'],
    ['shopping-insight', 'categories', '--input', 'input.yml'],
    ['shopping-insight', 'keywords', '--input', 'input.yml'],
    ['trends', '--input', 'input.yml'],
    ['search', 'webkr', 'query'],
    ['search', 'adult', 'query'],
    ['search', 'errata', 'query'],
  ])('parses %s command syntax', (...args: string[]) => {
    const cli = createCli();

    expect(() => cli.parse(['node', 'naver-api', ...args], { run: false })).not.toThrow();
    expect(cli.matchedCommand).toBeDefined();
  });
});
it.each([
  ['trends', ['trends', '--input', 'missing.yml']],
  ['shopping input', ['shopping-insight', 'categories', '--input', 'missing.yml']],
])('returns an input error for an unreadable %s file', async (_name: string, args: string[]) => {
  await expect(executeCli(['node', 'naver-api', ...args])).rejects.toMatchObject({
    code: 'NAVER_API_INPUT_ERROR',
  });
});

it('documents input and configuration error exit codes', () => {
  expect(renderError(new NaverApiError('NAVER_API_INPUT_ERROR', 'bad input'))).toMatchObject({
    exitCode: 2,
  });
  expect(renderError(new NaverApiConfigError('bad config'))).toMatchObject({ exitCode: 3 });
});
it('renders normalization failures as redacted upstream errors in human and JSON output', () => {
  const error = new NaverApiUpstreamError({ cause: new Error('secret response body') });

  expect(renderError(error, 'search')).toEqual({
    exitCode: 6,
    output: 'upstream: Naver API returned an invalid response.',
  });
  expect(JSON.parse(renderError(error, 'search', true).output)).toEqual({
    ok: false,
    command: 'search',
    error: {
      kind: 'upstream',
      code: 'NAVER_API_UPSTREAM_ERROR',
      message: 'Naver API returned an invalid response.',
    },
  });
});
it('renders cleanup residue as a redacted configuration error', () => {
  const secret = 'test-key-5678';
  const temporaryPath = '/private/config/.config.yml.temporary.tmp';
  const cleanupError = new NaverApiConfigCleanupError({
    cleanupErrors: [new NaverApiConfigError(`Unable to remove ${temporaryPath}: ${secret}`)],
    operationError: new NaverApiConfigError(`Unable to save ${temporaryPath}: ${secret}`),
  });

  const rendered = renderError(cleanupError, 'config set', true);

  expect(rendered.exitCode).toBe(3);
  expect(JSON.parse(rendered.output)).toEqual({
    ok: false,
    command: 'config set',
    error: {
      kind: 'config',
      code: 'NAVER_API_CONFIG_ERROR',
      message:
        'Temporary credential cleanup failed. A credential temporary file may remain; manual inspection is required.',
    },
  });
  expect(rendered.output).not.toContain(secret);
  expect(rendered.output).not.toContain(temporaryPath);
});

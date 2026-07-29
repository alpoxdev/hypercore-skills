import { readFile } from 'node:fs/promises';
import { stdin as input, stderr } from 'node:process';
import { cac, type CAC } from 'cac';
import { parse } from 'yaml';
import { NaverApiConfigStore, maskCredentials, validateApiHubCredentials } from './config.js';
import { NaverApiClient } from './client.js';
import {
  EXIT_CODES,
  errorKind,
  NaverApiConfigError,
  NaverApiError,
  NaverApiUpstreamError,
} from './errors.js';
import { renderJson, renderJsonError, renderTable, renderTrendResults } from './render.js';
import { buildSearchRequest, SEARCH_CAPABILITIES } from './search.js';
import {
  buildShoppingCategoryRequest,
  buildShoppingKeywordRequest,
  normalizeShoppingCategoryResponse,
  normalizeShoppingKeywordResponse,
} from './shopping-insight.js';
import { buildTrendsRequest, normalizeTrendResponse } from './trends.js';
import type {
  ApiHubRequest,
  SearchInput,
  ShoppingCategoryInput,
  ShoppingKeywordInput,
  SearchTrendInput,
} from './types.js';

type Options = Record<string, unknown>;

const configStore = new NaverApiConfigStore();

export function createCli(): CAC {
  const cli = cac('naver-api');
  cli.option('--json', 'Print one discriminated JSON document.');

  cli
    .command('config <command>', 'Manage local API HUB credentials.')
    .option('--stdin', 'Read credentials from YAML stdin.')
    .action(async (command: string, options: Options) => {
      switch (command) {
        case 'set':
          await configStore.save(await readCredentials(Boolean(options.stdin)));
          print('config set', { configured: true }, options);
          return;
        case 'show': {
          const value = await configStore.load();
          print(
            'config show',
            { configured: Boolean(value), ...(value ? maskCredentials(value) : {}) },
            options,
          );
          return;
        }
        case 'path':
          print('config path', { path: configStore.path }, options);
          return;
        case 'validate': {
          const value = await configStore.load();
          if (!value) throw new NaverApiConfigError('No local configuration was found.');
          validateApiHubCredentials(value);
          print('config validate', { valid: true }, options);
          return;
        }
        case 'delete':
          await configStore.delete();
          print('config delete', { deleted: true }, options);
          return;
        default:
          throw new NaverApiConfigError(`Unknown config command: ${command}.`);
      }
    });

  cli
    .command('trends', 'Request Search Trend data using a YAML or JSON input file.')
    .option('--input <file>', 'YAML or JSON input file.')
    .action(async (options: Options) => {
      const result = await invoke(
        (await requestFrom(options)) as SearchTrendInput,
        buildTrendsRequest,
        normalizeTrendResponse,
      );
      renderResponse('trends', result, options, (data) =>
        renderTrendResults((data as { results?: [] }).results ?? []),
      );
    });

  cli
    .command('shopping-insight <command>', 'Request Shopping Insight data.')
    .option('--input <file>', 'YAML or JSON input file.')
    .action(async (command: string, options: Options) => {
      switch (command) {
        case 'categories': {
          const result = await invoke(
            (await requestFrom(options)) as ShoppingCategoryInput,
            buildShoppingCategoryRequest,
            normalizeShoppingCategoryResponse,
          );
          renderResponse('shopping-insight categories', result, options, (data) =>
            renderTrendResults((data as { results?: [] }).results ?? []),
          );
          return;
        }
        case 'keywords': {
          const result = await invoke(
            (await requestFrom(options)) as ShoppingKeywordInput,
            buildShoppingKeywordRequest,
            normalizeShoppingKeywordResponse,
          );
          renderResponse('shopping-insight keywords', result, options, (data) =>
            renderTrendResults((data as { results?: [] }).results ?? []),
          );
          return;
        }
        default:
          throw new NaverApiError(
            'NAVER_API_INPUT_ERROR',
            `Unknown shopping-insight command: ${command}.`,
          );
      }
    });

  cli
    .command('search <type> <query>', 'Search a currently registered API HUB search type.')
    .option('--display <count>', 'Number of results.')
    .option('--start <index>', 'Start index.')
    .option('--sort <sort>', 'Search sort order.')
    .option('--filter <filter>', 'Search filter.')
    .option('--format <format>', 'Response format (json only).')
    .action(async (type: string, query: string, options: Options) => {
      const request: SearchInput = { type, query, ...searchOptions(options) } as SearchInput;
      const capability = SEARCH_CAPABILITIES[type as keyof typeof SEARCH_CAPABILITIES];
      const handler =
        capability?.responseShape[capability.responseShape.length - 1] === 'items'
          ? {
              normalize: capability.validateResponse,
              render: (data: unknown) =>
                renderSearchRows(
                  (data as { items?: Record<string, unknown>[] }).items ?? [],
                  capability.itemColumns,
                ),
            }
          : capability
            ? {
                normalize: capability.validateResponse,
                render: (data: unknown) => renderTable([data as Record<string, unknown>]),
              }
            : {
                normalize: (raw: unknown) => raw,
                render: (data: unknown) =>
                  renderSearchRows(
                    (data as { items?: Record<string, unknown>[] }).items ?? [],
                    undefined,
                  ),
              };
      const result = await invoke(request, buildSearchRequest, handler.normalize);
      renderResponse('search', result, options, handler.render);
    });

  cli.help();
  cli.version('0.1.0');
  return cli;
}

export async function executeCli(argv: string[]): Promise<void> {
  const cli = createCli();
  cli.parse(argv, { run: false });
  await (cli as unknown as { runMatchedCommand(): Promise<void> }).runMatchedCommand();
}

function renderSearchRows(
  items: readonly Record<string, unknown>[],
  columns: readonly string[] | undefined,
): string {
  if (!columns) return renderTable(items);
  return renderTable(
    items.map((item) => Object.fromEntries(columns.map((column) => [column, item[column]]))),
  );
}
async function invoke<TInput, TResult>(
  inputValue: TInput,
  build: (value: TInput) => ApiHubRequest,
  normalize: (raw: unknown) => TResult,
): Promise<TResult> {
  let request: ApiHubRequest;
  try {
    request = build(inputValue);
  } catch (error) {
    throw new NaverApiError(
      'NAVER_API_INPUT_ERROR',
      error instanceof Error ? error.message : 'Invalid API request.',
    );
  }
  const credentials = await configStore.load();
  if (!credentials) throw new NaverApiConfigError('No local configuration was found.');
  validateApiHubCredentials(credentials);
  const query = request.query
    ? `?${new URLSearchParams(Object.entries(request.query).map(([key, value]) => [key, String(value)]))}`
    : '';
  const raw = await new NaverApiClient({ credentials }).request<unknown>(
    `${request.path}${query}`,
    {
      method: request.method,
      ...(request.body
        ? { body: JSON.stringify(request.body), headers: { 'Content-Type': 'application/json' } }
        : {}),
    },
  );
  try {
    return normalize(raw);
  } catch (error) {
    throw new NaverApiUpstreamError({ cause: error });
  }
}

async function requestFrom(options: Options): Promise<Record<string, unknown>> {
  const file = options.input;
  if (typeof file !== 'string' || file.length === 0)
    throw new NaverApiError('NAVER_API_INPUT_ERROR', 'An input file is required.');
  let source: string;
  try {
    source = file === '-' ? await readStdin() : await readFile(file, 'utf8');
  } catch {
    throw new NaverApiError('NAVER_API_INPUT_ERROR', `Unable to read input: ${file}.`);
  }
  try {
    const parsed = parse(source);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new NaverApiError('NAVER_API_INPUT_ERROR', 'Input must be a YAML or JSON object.');
  }
}

async function readCredentials(fromStdin: boolean): Promise<{ apiKeyId: string; apiKey: string }> {
  let value: unknown;
  try {
    value = fromStdin ? parse(await readStdin()) : await promptCredentials();
  } catch (error) {
    if (error instanceof NaverApiConfigError) throw error;
    throw new NaverApiConfigError('Credentials must be valid YAML.');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.apiKeyId !== 'string' ||
    typeof value.apiKey !== 'string'
  ) {
    throw new NaverApiConfigError('Credentials must contain apiKeyId and apiKey.');
  }
  return value as { apiKeyId: string; apiKey: string };
}

async function promptCredentials(): Promise<{ apiKeyId: string; apiKey: string }> {
  if (!input.isTTY)
    throw new NaverApiConfigError('Use config set --stdin when standard input is not a TTY.');
  return { apiKeyId: await readHidden('API key ID: '), apiKey: await readHidden('API key: ') };
}

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = input.isRaw;
    const wasPaused = input.isPaused();
    let finished = false;
    const cleanup = () => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      if (input.isRaw !== wasRaw) input.setRawMode(wasRaw);
      if (wasPaused) input.pause();
      else input.resume();
      stderr.write('\n');
    };
    const finish = (result: { value: string } | { error: Error }) => {
      if (finished) return;
      finished = true;
      cleanup();
      if ('error' in result) reject(result.error);
      else resolve(result.value);
    };
    const onEnd = () =>
      finish({ error: new NaverApiConfigError('Credential input was cancelled.') });
    const onError = () =>
      finish({ error: new NaverApiConfigError('Unable to read credential input.') });
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\r' || character === '\n') return finish({ value });
        if (character === '\u0003')
          return finish({ error: new NaverApiConfigError('Credential input was cancelled.') });
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    stderr.write(prompt);
    try {
      input.setRawMode(true);
      input.resume();
      input.on('data', onData);
      input.once('end', onEnd);
      input.once('error', onError);
    } catch (error) {
      finish({
        error: new NaverApiConfigError('Unable to read credential input.', { cause: error }),
      });
    }
  });
}

async function readStdin(): Promise<string> {
  let value = '';
  for await (const chunk of input) value += chunk;
  return value;
}

function renderResponse(
  command: string,
  data: unknown,
  options: Options,
  text: (data: unknown) => string,
): void {
  process.stdout.write(`${options.json ? renderJson(command, data) : text(data)}\n`);
}

function print(command: string, data: unknown, options: Options): void {
  process.stdout.write(
    `${options.json ? renderJson(command, data) : renderTable([data as Record<string, unknown>])}\n`,
  );
}

function pick(options: Options, names: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(
    names.filter((name) => options[name] !== undefined).map((name) => [name, options[name]]),
  );
}
function searchOptions(options: Options): Record<string, unknown> {
  const values = pick(options, ['display', 'start', 'sort', 'filter', 'format']);
  for (const name of ['display', 'start']) {
    if (typeof values[name] === 'string') values[name] = Number(values[name]);
  }
  return values;
}

export function renderError(
  error: unknown,
  command = 'unknown',
  json = false,
): { exitCode: number; output: string } {
  const known =
    error instanceof NaverApiError
      ? error
      : new NaverApiError('NAVER_API_ERROR', 'Naver API command failed.');
  const kind = errorKind(known);
  return {
    exitCode: EXIT_CODES[kind],
    output: json
      ? renderJsonError(command, kind, known.code, known.message)
      : `${kind}: ${known.message}`,
  };
}

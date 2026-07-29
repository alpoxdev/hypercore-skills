import { randomUUID } from 'node:crypto';
import { promises as defaultFs } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { NaverApiConfigCleanupError, NaverApiConfigError, maskSecret } from './errors.js';

export interface ApiHubCredentials {
  apiKeyId: string;
  apiKey: string;
}

export interface NaverApiConfigStoreOptions {
  homeDirectory?: string;
  fs?: typeof defaultFs;
}

const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const CONFIG_DIRECTORY = '.hypercore/naver-api';
const CONFIG_FILENAME = 'config.yml';

function hasMode(stat: { mode: number }, expected: number): boolean {
  return (stat.mode & 0o777) === expected;
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** Validates credentials locally; no API request is made. */
export function validateApiHubCredentials(value: ApiHubCredentials): ApiHubCredentials {
  if (typeof value.apiKeyId !== 'string' || value.apiKeyId.trim() === '') {
    throw new NaverApiConfigError('apiKeyId must be a non-empty string.');
  }
  if (typeof value.apiKey !== 'string' || value.apiKey.trim() === '') {
    throw new NaverApiConfigError('apiKey must be a non-empty string.');
  }
  return value;
}

export function maskCredentials(
  credentials: ApiHubCredentials,
): Record<keyof ApiHubCredentials, string> {
  return {
    apiKeyId: maskSecret(credentials.apiKeyId),
    apiKey: maskSecret(credentials.apiKey),
  };
}

function serialize(credentials: ApiHubCredentials): string {
  // JSON quoted scalars are valid YAML and safely preserve punctuation in API keys.
  return `apiKeyId: ${JSON.stringify(credentials.apiKeyId)}\napiKey: ${JSON.stringify(credentials.apiKey)}\n`;
}

function parse(contents: string): ApiHubCredentials {
  const values: Partial<ApiHubCredentials> = {};
  const lines = contents.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length !== 2)
    throw new NaverApiConfigError('Configuration must contain apiKeyId and apiKey.');

  for (const line of lines) {
    const match = /^(apiKeyId|apiKey):\s*("(?:[^"\\]|\\.)*")\s*$/.exec(line);
    if (!match || match[1] in values) {
      throw new NaverApiConfigError('Configuration is malformed.');
    }
    try {
      values[match[1] as keyof ApiHubCredentials] = JSON.parse(match[2]);
    } catch {
      throw new NaverApiConfigError('Configuration is malformed.');
    }
  }
  return validateApiHubCredentials(values as ApiHubCredentials);
}

export class NaverApiConfigStore {
  readonly directory: string;
  readonly path: string;
  private readonly fs: typeof defaultFs;

  constructor(options: NaverApiConfigStoreOptions = {}) {
    const home = options.homeDirectory ?? homedir();
    this.directory = join(home, CONFIG_DIRECTORY);
    this.path = join(this.directory, CONFIG_FILENAME);
    this.fs = options.fs ?? defaultFs;
  }
  private get parentDirectory(): string {
    return dirname(this.directory);
  }

  private async assertSafeParent(create: boolean): Promise<boolean> {
    try {
      const stat = await this.fs.lstat(this.parentDirectory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new NaverApiConfigError('Configuration parent directory is not a regular directory.');
      }
      return true;
    } catch (error) {
      if (!isMissing(error)) throw error;
      if (!create) return false;
      await this.fs.mkdir(this.parentDirectory, { mode: DIRECTORY_MODE });
      const stat = await this.fs.lstat(this.parentDirectory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new NaverApiConfigError('Configuration parent directory is not a regular directory.');
      }
      return true;
    }
  }

  private async assertSafeDirectory(): Promise<boolean> {
    try {
      const stat = await this.fs.lstat(this.directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || !hasMode(stat, DIRECTORY_MODE)) {
        throw new NaverApiConfigError(
          'Configuration directory is not a protected regular directory.',
        );
      }
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  private async ensureDirectory(): Promise<void> {
    if (await this.assertSafeDirectory()) return;
    await this.fs.mkdir(this.directory, { mode: DIRECTORY_MODE });
    const stat = await this.fs.lstat(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !hasMode(stat, DIRECTORY_MODE)) {
      throw new NaverApiConfigError(
        'Configuration directory is not a protected regular directory.',
      );
    }
  }

  private async assertSafeConfigFile(): Promise<void> {
    try {
      const stat = await this.fs.lstat(this.path);
      if (!stat.isFile() || stat.isSymbolicLink() || !hasMode(stat, FILE_MODE)) {
        throw new NaverApiConfigError('Configuration path is not a protected regular file.');
      }
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
  }

  async load(): Promise<ApiHubCredentials | undefined> {
    if (!(await this.assertSafeParent(false)) || !(await this.assertSafeDirectory()))
      return undefined;
    await this.assertSafeConfigFile();
    try {
      const contents = await this.fs.readFile(this.path, 'utf8');
      return parse(contents);
    } catch (error) {
      if (isMissing(error)) return undefined;
      if (error instanceof NaverApiConfigError) throw error;
      throw new NaverApiConfigError('Unable to read configuration.', { cause: error });
    }
  }

  async save(credentials: ApiHubCredentials): Promise<void> {
    validateApiHubCredentials(credentials);
    await this.assertSafeParent(true);
    await this.ensureDirectory();
    await this.assertSafeConfigFile();
    const temporaryPath = join(dirname(this.path), `.${CONFIG_FILENAME}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof this.fs.open>> | undefined;
    let temporaryFileCreated = false;
    let operationError: NaverApiConfigError | undefined;
    try {
      handle = await this.fs.open(temporaryPath, 'wx', FILE_MODE);
      temporaryFileCreated = true;
      await handle.writeFile(serialize(credentials), 'utf8');
      await handle.chmod(FILE_MODE);
      await handle.close();
      handle = undefined;
      await this.fs.rename(temporaryPath, this.path);
      temporaryFileCreated = false;
      const stat = await this.fs.lstat(this.path);
      if (!stat.isFile() || stat.isSymbolicLink() || !hasMode(stat, FILE_MODE)) {
        throw new NaverApiConfigError('Configuration file permissions are unsafe.');
      }
    } catch (error) {
      operationError =
        error instanceof NaverApiConfigError
          ? error
          : new NaverApiConfigError('Unable to save configuration.', { cause: error });
    }

    const cleanupErrors: NaverApiConfigError[] = [];
    if (handle) {
      try {
        await handle.close();
      } catch {
        cleanupErrors.push(new NaverApiConfigError('Unable to close temporary credential file.'));
      }
    }
    if (temporaryFileCreated) {
      try {
        await this.fs.unlink(temporaryPath);
      } catch (error) {
        if (!isMissing(error)) {
          cleanupErrors.push(
            new NaverApiConfigError('Unable to remove temporary credential file.'),
          );
        }
      }
    }

    if (cleanupErrors.length > 0) {
      throw new NaverApiConfigCleanupError({
        cleanupErrors,
        ...(operationError ? { operationError } : {}),
      });
    }
    if (operationError) throw operationError;
  }

  async delete(): Promise<void> {
    if (!(await this.assertSafeParent(false)) || !(await this.assertSafeDirectory())) return;
    await this.assertSafeConfigFile();
    try {
      await this.fs.unlink(this.path);
    } catch (error) {
      if (!isMissing(error))
        throw new NaverApiConfigError('Unable to delete configuration.', { cause: error });
    }
  }
}

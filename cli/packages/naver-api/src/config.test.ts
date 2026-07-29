import { chmod, mkdtemp, lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { promises as defaultFs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { NaverApiConfigStore, maskCredentials, validateApiHubCredentials } from './config.js';
import { NaverApiConfigCleanupError, NaverApiConfigError, redactSecrets } from './errors.js';

const homes: string[] = [];

async function home(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'naver-api-test-'));
  await chmod(directory, 0o700);
  homes.push(directory);
  return directory;
}

async function createSafeConfigDirectory(store: NaverApiConfigStore): Promise<void> {
  await mkdir(store.directory, { recursive: true, mode: 0o700 });
  await chmod(dirname(store.directory), 0o700);
  await chmod(store.directory, 0o700);
}

afterEach(async () => {
  await Promise.all(
    homes.splice(0).map(async (directory) => {
      const { rm } = await import('node:fs/promises');
      await rm(directory, { recursive: true, force: true });
    }),
  );
});

describe('NaverApiConfigStore', () => {
  it('writes restrictive files and reads the saved credentials', async () => {
    const store = new NaverApiConfigStore({ homeDirectory: await home() });
    const credentials = { apiKeyId: 'test-id-1234', apiKey: 'test-key-5678' };

    await store.save(credentials);

    expect(await store.load()).toEqual(credentials);
    expect((await lstat(store.directory)).mode & 0o777).toBe(0o700);
    expect((await lstat(store.path)).mode & 0o777).toBe(0o600);
    expect(await readFile(store.path, 'utf8')).not.toContain('apiKeyId: test-id-1234');
  });

  it('rejects malformed configuration without leaking its values', async () => {
    const store = new NaverApiConfigStore({ homeDirectory: await home() });
    await createSafeConfigDirectory(store);
    await writeFile(store.path, 'apiKeyId: exposed\napiKey: broken\n', { mode: 0o600 });

    await expect(store.load()).rejects.toBeInstanceOf(NaverApiConfigError);
  });

  it('rejects a symlink at the config path', async () => {
    const store = new NaverApiConfigStore({ homeDirectory: await home() });
    await createSafeConfigDirectory(store);
    const target = join(store.directory, 'target.yml');
    await writeFile(target, 'apiKeyId: "test"\napiKey: "test"\n', { mode: 0o600 });
    expect((await lstat(dirname(store.directory))).mode & 0o777).toBe(0o700);
    expect((await lstat(store.directory)).mode & 0o777).toBe(0o700);
    await symlink(target, store.path);

    await expect(store.load()).rejects.toBeInstanceOf(NaverApiConfigError);
    await expect(store.delete()).rejects.toBeInstanceOf(NaverApiConfigError);
  });
  it('rejects an unsafe config-file mode before loading or deleting it', async () => {
    const store = new NaverApiConfigStore({ homeDirectory: await home() });
    await createSafeConfigDirectory(store);
    await writeFile(store.path, 'apiKeyId: "test"\napiKey: "test"\n', { mode: 0o600 });
    await chmod(store.path, 0o644);

    await expect(store.load()).rejects.toBeInstanceOf(NaverApiConfigError);
    await expect(store.delete()).rejects.toBeInstanceOf(NaverApiConfigError);
  });
  it('rejects a symlinked .hypercore parent without creating or repairing it', async () => {
    const directory = await home();
    const target = join(directory, 'target');
    await mkdir(target);
    await symlink(target, join(directory, '.hypercore'));
    const store = new NaverApiConfigStore({ homeDirectory: directory });

    await expect(store.load()).rejects.toBeInstanceOf(NaverApiConfigError);
    await expect(store.save({ apiKeyId: 'test', apiKey: 'test' })).rejects.toBeInstanceOf(
      NaverApiConfigError,
    );
    expect((await lstat(join(directory, '.hypercore'))).isSymbolicLink()).toBe(true);
  });

  it('deletes absent configuration idempotently', async () => {
    const store = new NaverApiConfigStore({ homeDirectory: await home() });
    await expect(store.delete()).resolves.toBeUndefined();
    await expect(store.delete()).resolves.toBeUndefined();
  });
  it('does not create a directory when loading or deleting absent configuration', async () => {
    const store = new NaverApiConfigStore({ homeDirectory: await home() });

    await expect(store.load()).resolves.toBeUndefined();
    await expect(store.delete()).resolves.toBeUndefined();
    await expect(lstat(store.directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('does not repair an unsafe directory while loading', async () => {
    const store = new NaverApiConfigStore({ homeDirectory: await home() });
    await createSafeConfigDirectory(store);
    await chmod(store.directory, 0o755);

    await expect(store.load()).rejects.toBeInstanceOf(NaverApiConfigError);
    expect((await lstat(store.directory)).mode & 0o777).toBe(0o755);
  });

  it('reports credential cleanup residue without exposing credentials or paths', async () => {
    const credentials = { apiKeyId: 'test-id-1234', apiKey: 'test-key-5678' };
    const injectedFs = {
      ...defaultFs,
      open: async (...args: Parameters<typeof defaultFs.open>) => {
        const handle = await defaultFs.open(...args);
        return {
          writeFile: handle.writeFile.bind(handle),
          chmod: handle.chmod.bind(handle),
          close: async () => {
            throw new Error('injected close failure');
          },
        };
      },
      unlink: async (path: Parameters<typeof defaultFs.unlink>[0]) => {
        if (String(path).includes('.config.yml.')) {
          throw Object.assign(new Error('injected unlink failure'), { code: 'EACCES' });
        }
        return defaultFs.unlink(path);
      },
    } as typeof defaultFs;
    const store = new NaverApiConfigStore({ homeDirectory: await home(), fs: injectedFs });

    const error = await store.save(credentials).then(
      () => undefined,
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(NaverApiConfigCleanupError);
    const cleanupError = error as NaverApiConfigCleanupError;
    expect(cleanupError.message).toBe(
      'Temporary credential cleanup failed. A credential temporary file may remain; manual inspection is required.',
    );
    expect(cleanupError.operationError?.message).toBe('Unable to save configuration.');
    expect(cleanupError.cause).toBe(cleanupError.operationError);
    expect(cleanupError.cleanupErrors.map((cleanupError) => cleanupError.message)).toEqual([
      'Unable to close temporary credential file.',
      'Unable to remove temporary credential file.',
    ]);
    const diagnostics = JSON.stringify(cleanupError);
    expect(diagnostics).not.toContain(credentials.apiKeyId);
    expect(diagnostics).not.toContain(credentials.apiKey);
    expect(diagnostics).not.toContain(store.directory);
    expect(diagnostics).not.toContain(store.path);
  });

  it('masks and redacts credential values', () => {
    const credentials = { apiKeyId: 'test-id-1234', apiKey: 'test-key-5678' };
    expect(maskCredentials(credentials)).toEqual({
      apiKeyId: '********1234',
      apiKey: '*********5678',
    });
    expect(redactSecrets('failed test-key-5678', [credentials.apiKey])).toBe('failed [REDACTED]');
    expect(() => validateApiHubCredentials({ apiKeyId: '', apiKey: 'test' })).toThrow(
      NaverApiConfigError,
    );
  });
});

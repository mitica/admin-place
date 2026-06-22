import { mkdtemp, readFile, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cachedDownload } from './file-cache';

let cacheDir: string;

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'admin-place-cache-'));
});

afterEach(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

const fakeFetch = (body: string) =>
  vi.fn(async () => new Response(body)) as unknown as typeof fetch;

describe('cachedDownload', () => {
  it('downloads on first call and serves from cache within the TTL', async () => {
    const fetchImpl = fakeFetch('hello world');
    const url = 'https://example.test/data.txt';

    const first = await cachedDownload(url, { cacheDir, ttlMs: 60_000, fetchImpl });
    expect(await readFile(first, 'utf8')).toBe('hello world');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const second = await cachedDownload(url, { cacheDir, ttlMs: 60_000, fetchImpl });
    expect(second).toBe(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // not re-fetched
  });

  it('re-downloads once the cached file is older than the TTL', async () => {
    const fetchImpl = fakeFetch('v1');
    const url = 'https://example.test/data.txt';

    const path = await cachedDownload(url, { cacheDir, ttlMs: 1_000, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Backdate the file's mtime well beyond the TTL.
    const past = (await stat(path)).mtimeMs / 1000 - 3600;
    await utimes(path, past, past);

    await cachedDownload(url, { cacheDir, ttlMs: 1_000, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

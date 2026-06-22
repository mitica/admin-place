import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { ROOT_DIR } from '../paths';

/** 30 days. */
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface FileCacheOptions {
  /** Cache directory. Defaults to `ADMIN_PLACE_CACHE_DIR` or `<repo>/.cache`. */
  cacheDir?: string;
  /** Max age before a cached file is considered stale. Defaults to 30 days. */
  ttlMs?: number;
  /** Injectable fetch, for tests. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export function resolveCacheDir(options: FileCacheOptions = {}): string {
  return options.cacheDir ?? process.env.ADMIN_PLACE_CACHE_DIR ?? join(ROOT_DIR, '.cache');
}

/** Deterministic, readable cache filename: `<hash>-<basename>`. */
function cacheFileName(url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const base = url.split('/').pop()?.split('?')[0] || 'file';
  return `${hash}-${base}`;
}

/**
 * Download `url` to the cache directory and return the local path. A cached
 * copy younger than the TTL is reused without re-fetching. The download is
 * streamed to a temp file and atomically renamed, so an interrupted download
 * never leaves a partial file that looks fresh.
 */
export async function cachedDownload(url: string, options: FileCacheOptions = {}): Promise<string> {
  const dir = resolveCacheDir(options);
  const dest = join(dir, cacheFileName(url));
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  try {
    const info = await stat(dest);
    if (Date.now() - info.mtimeMs < ttlMs) {
      return dest;
    }
  } catch {
    // Not cached yet — fall through and download.
  }

  await mkdir(dir, { recursive: true });
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url);
  if (!response.ok || response.body === null) {
    throw new Error(`download failed (${response.status}) for ${url}`);
  }

  const tmp = `${dest}.${process.pid}.tmp`;
  // res.body is a web ReadableStream; Readable.fromWeb adapts it to a Node stream.
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    createWriteStream(tmp),
  );
  await rename(tmp, dest);
  return dest;
}

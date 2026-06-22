import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import StreamZip from 'node-stream-zip';

import { cachedDownload, resolveCacheDir, type FileCacheOptions } from '../../cache/file-cache';

const DEFAULT_BASE_URL = 'https://download.geonames.org/export/dump/';

export interface GeoNamesFetchOptions extends FileCacheOptions {
  /** Base URL of the GeoNames dump directory. */
  baseUrl?: string;
}

/** Extract a single entry from a zip to a destination file. */
async function extractEntry(zipPath: string, entryName: string, destPath: string): Promise<void> {
  const zip = new StreamZip.async({ file: zipPath });
  try {
    await zip.extract(entryName, destPath);
  } finally {
    await zip.close();
  }
}

/**
 * Download `{CC}.zip` (cached), extract the `{CC}.txt` entry to the cache
 * directory, and return a line iterator over it. Re-extraction is skipped when
 * the extracted file is newer than the downloaded archive.
 */
export async function fetchCountryDumpLines(
  countryCode: string,
  options: GeoNamesFetchOptions = {},
): Promise<AsyncIterable<string>> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const zipPath = await cachedDownload(`${baseUrl}${countryCode}.zip`, options);
  const dir = resolveCacheDir(options);
  const txtPath = join(dir, `geonames-${countryCode}.txt`);

  let needsExtract = true;
  try {
    const [zipInfo, txtInfo] = await Promise.all([stat(zipPath), stat(txtPath)]);
    needsExtract = txtInfo.mtimeMs < zipInfo.mtimeMs;
  } catch {
    needsExtract = true;
  }
  if (needsExtract) {
    await mkdir(dir, { recursive: true });
    await extractEntry(zipPath, `${countryCode}.txt`, txtPath);
  }

  return createInterface({
    input: createReadStream(txtPath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
}

/** Download and read the global `countryInfo.txt` (cached). */
export async function fetchCountryInfoText(options: GeoNamesFetchOptions = {}): Promise<string> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const path = await cachedDownload(`${baseUrl}countryInfo.txt`, options);
  return readFile(path, 'utf8');
}

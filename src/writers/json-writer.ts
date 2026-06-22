import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

interface HasId {
  id: string;
}

/** Codepoint-stable comparison so ordering never depends on locale. */
const byId = (a: HasId, b: HasId): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Rebuild a value with object keys sorted recursively, for stable output. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      result[key] = canonicalize(source[key]);
    }
    return result;
  }
  return value;
}

/**
 * Write records to `filePath` as deterministic JSON: records sorted by `id`,
 * object keys sorted, 2-space indented, with a trailing newline. Re-running
 * with the same input yields byte-identical output, keeping git diffs minimal.
 * Parent directories are created as needed.
 */
export async function writeRecords<T extends HasId>(filePath: string, records: T[]): Promise<void> {
  const sorted = [...records].sort(byId);
  const json = JSON.stringify(canonicalize(sorted), null, 2);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${json}\n`, 'utf8');
}

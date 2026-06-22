import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeRecords } from './json-writer';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'admin-place-writer-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('writeRecords', () => {
  it('sorts by id, sorts keys, indents 2 spaces, ends with a newline', async () => {
    const file = join(dir, 'out.json');
    await writeRecords(file, [
      { name: 'B', id: 'b' },
      { name: 'A', id: 'a' },
    ]);
    const text = await readFile(file, 'utf8');
    expect(text).toBe(
      '[\n  {\n    "id": "a",\n    "name": "A"\n  },\n  {\n    "id": "b",\n    "name": "B"\n  }\n]\n',
    );
  });

  it('produces identical output regardless of input order or key order', async () => {
    const a = join(dir, 'a.json');
    const b = join(dir, 'b.json');
    await writeRecords(a, [
      { id: 'x', name: 'X', level: 1 },
      { id: 'y', name: 'Y', level: 2 },
    ]);
    await writeRecords(b, [
      { level: 2, id: 'y', name: 'Y' },
      { name: 'X', level: 1, id: 'x' },
    ]);
    expect(await readFile(b, 'utf8')).toBe(await readFile(a, 'utf8'));
  });

  it('creates parent directories as needed', async () => {
    const file = join(dir, 'deeply', 'nested', 'out.json');
    await writeRecords(file, [{ id: 'a' }]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([{ id: 'a' }]);
  });
});

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generate } from './generate';
import { SampleSource } from './sources/sample';
import type { Source } from './sources/source';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'admin-place-generate-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const readJson = async (relativePath: string): Promise<unknown> =>
  JSON.parse(await readFile(join(dir, relativePath), 'utf8'));

const ids = (records: unknown): string[] => (records as { id: string }[]).map((r) => r.id);

describe('generate', () => {
  it('writes the expected sharded files from the sample source', async () => {
    await generate({ dataDir: dir, source: new SampleSource() });

    expect(ids(await readJson('countries.json'))).toEqual(['AD', 'US']);
    expect(ids(await readJson('admin/US/1.json'))).toEqual(['US.CA', 'US.TX']);
    expect(ids(await readJson('admin/US/2.json'))).toEqual(['US.CA.037', 'US.TX.201']);
    expect(ids(await readJson('admin/AD/1.json'))).toEqual(['AD.03', 'AD.07']);

    expect(await readJson('localities/US/US.CA.json')).toEqual([
      { id: '5368361', name: 'Los Angeles', parentId: 'US.CA.037' },
    ]);
    expect(ids(await readJson('localities/US/US.TX.json'))).toEqual(['4699066']);
    expect(ids(await readJson('localities/AD/AD.07.json'))).toEqual(['3041563']);
  });

  it('produces byte-identical output when re-run with the same source', async () => {
    await generate({ dataDir: dir, source: new SampleSource() });
    const first = await readFile(join(dir, 'localities/US/US.CA.json'), 'utf8');
    await generate({ dataDir: dir, source: new SampleSource() });
    const second = await readFile(join(dir, 'localities/US/US.CA.json'), 'utf8');
    expect(second).toBe(first);
  });

  it('groups a country-direct locality under {CC}.json', async () => {
    const source: Source = {
      countries: async () => [{ id: 'XX', name: 'Example' }],
      adminDivisions: async () => [],
      localities: async () => [{ id: '1', name: 'Capital', parentId: 'XX' }],
    };
    await generate({ dataDir: dir, source });
    expect(await readJson('localities/XX/XX.json')).toEqual([
      { id: '1', name: 'Capital', parentId: 'XX' },
    ]);
  });
});

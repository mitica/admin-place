import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

const exists = async (relativePath: string): Promise<boolean> => {
  try {
    await stat(join(dir, relativePath));
    return true;
  } catch {
    return false;
  }
};

describe('generate (full rebuild)', () => {
  it('writes the expected sharded files from the sample source', async () => {
    await generate({ dataDir: dir, source: new SampleSource() });

    expect(ids(await readJson('countries.json'))).toEqual(['AD', 'US']);
    expect(ids(await readJson('admin/US/1.json'))).toEqual(['US.CA', 'US.TX']);
    expect(ids(await readJson('admin/US/2.json'))).toEqual(['US.CA.037', 'US.TX.201']);
    expect(ids(await readJson('admin/AD/1.json'))).toEqual(['AD.03', 'AD.07']);

    expect(await readJson('localities/US/US.CA.json')).toEqual([
      {
        id: '5368361',
        name: 'Los Angeles',
        geonameId: '5368361',
        featureClass: 'P',
        featureCode: 'PPL',
        population: 3898747,
        lat: 34.05223,
        lng: -118.24368,
        parentId: 'US.CA.037',
      },
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
      localities: async () => [
        {
          id: '1',
          name: 'Capital',
          geonameId: '1',
          featureClass: 'P',
          featureCode: 'PPLC',
          parentId: 'XX',
        },
      ],
    };
    await generate({ dataDir: dir, source });
    expect(await readJson('localities/XX/XX.json')).toEqual([
      {
        id: '1',
        name: 'Capital',
        geonameId: '1',
        featureClass: 'P',
        featureCode: 'PPLC',
        parentId: 'XX',
      },
    ]);
  });
});

describe('generate (incremental)', () => {
  it('updates only the targeted country and upserts countries.json', async () => {
    const source = new SampleSource();
    await generate({ dataDir: dir, source, countryCodes: ['US'] });

    // Seed an unrelated country subtree that an AD run must not touch.
    await mkdir(join(dir, 'admin', 'ZZ'), { recursive: true });
    await writeFile(join(dir, 'admin', 'ZZ', '1.json'), '[]\n', 'utf8');

    await generate({ dataDir: dir, source, countryCodes: ['AD'] });

    expect(ids(await readJson('countries.json'))).toEqual(['AD', 'US']); // upserted
    expect(await exists('admin/US/1.json')).toBe(true); // preserved
    expect(await exists('admin/AD/1.json')).toBe(true); // added
    expect(await exists('admin/ZZ/1.json')).toBe(true); // untouched
  });
});

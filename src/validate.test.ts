import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generate } from './generate';
import { SampleSource } from './sources/sample';
import { validateData } from './validate';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'admin-place-validate-'));
  await generate({ dataDir: dir, source: new SampleSource() });
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const overwrite = (relativePath: string, value: unknown): Promise<void> =>
  writeFile(join(dir, relativePath), JSON.stringify(value), 'utf8');

const adm = (over: Record<string, unknown>) => ({
  id: 'US.CA',
  name: 'California',
  geonameId: '5332921',
  featureClass: 'A',
  featureCode: 'ADM1',
  level: 1,
  parentId: 'US',
  ...over,
});

describe('validateData', () => {
  it('passes on freshly generated data', async () => {
    expect(await validateData(dir)).toEqual([]);
  });

  it('flags a dangling admin parentId', async () => {
    await overwrite('admin/US/2.json', [
      adm({
        id: 'US.CA.037',
        name: 'Los Angeles County',
        featureCode: 'ADM2',
        level: 2,
        parentId: 'US.ZZ',
      }),
    ]);
    const problems = await validateData(dir);
    expect(problems.some((p) => p.includes('US.ZZ'))).toBe(true);
  });

  it('flags a level that disagrees with the filename', async () => {
    await overwrite('admin/US/1.json', [adm({ level: 2 })]);
    const problems = await validateData(dir);
    expect(problems.some((p) => p.toLowerCase().includes('level'))).toBe(true);
  });

  it('flags a featureCode that disagrees with the level', async () => {
    await overwrite('admin/US/1.json', [adm({ featureCode: 'ADM3' })]);
    const problems = await validateData(dir);
    expect(problems.some((p) => p.includes('featureCode'))).toBe(true);
  });

  it('flags a locality filed under the wrong ADM1 ancestor', async () => {
    await overwrite('localities/US/US.TX.json', [
      {
        id: '5368361',
        name: 'Los Angeles',
        geonameId: '5368361',
        featureClass: 'P',
        featureCode: 'PPL',
        parentId: 'US.CA.037',
      },
    ]);
    const problems = await validateData(dir);
    expect(problems.some((p) => p.includes('ancestor'))).toBe(true);
  });

  it('flags an unsorted file', async () => {
    await overwrite('admin/US/1.json', [
      adm({ id: 'US.TX', name: 'Texas', geonameId: '4736286' }),
      adm({ id: 'US.CA', name: 'California', geonameId: '5332921' }),
    ]);
    const problems = await validateData(dir);
    expect(problems.some((p) => p.includes('not sorted'))).toBe(true);
  });
});

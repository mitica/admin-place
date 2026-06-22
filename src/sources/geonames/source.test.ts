import { describe, expect, it, vi } from 'vitest';

import { AD_DUMP_LINES, adCountryInfoText } from './__fixtures__/ad';
import { GeoNamesSource } from './source';

function makeSource() {
  const localDumpLines = vi.fn(async () => AD_DUMP_LINES);
  const source = new GeoNamesSource({
    countryCodes: ['AD'],
    localDumpLines,
    countryInfoText: async () => adCountryInfoText(),
  });
  return { source, localDumpLines };
}

describe('GeoNamesSource', () => {
  it('returns countries from countryInfo', async () => {
    const { source } = makeSource();
    expect(await source.countries()).toEqual([
      { id: 'AD', name: 'Andorra', geonameId: '3041565', population: 77006 },
    ]);
  });

  it('extracts admin divisions (ADM1..ADM5 only)', async () => {
    const { source } = makeSource();
    const ids = (await source.adminDivisions('AD')).map((d) => d.id).sort();
    expect(ids).toEqual(['AD.03', 'AD.07', 'AD.07.001']);
  });

  it('extracts pop>0 localities with clamped parents', async () => {
    const { source } = makeSource();
    const byId = new Map((await source.localities('AD')).map((l) => [l.id, l.parentId]));
    expect(byId.get('3041563')).toBe('AD.07'); // under ADM1
    expect(byId.get('7770001')).toBe('AD.07.001'); // under ADM2
    expect(byId.get('5550001')).toBe('AD.03'); // bogus admin2 clamped to ADM1
    expect(byId.get('4440001')).toBe('AD'); // admin1=00 → country
    expect(byId.has('6660001')).toBe(false); // population 0 excluded
    expect(byId.size).toBe(4);
  });

  it('parses each country dump only once (memoized)', async () => {
    const { source, localDumpLines } = makeSource();
    await source.adminDivisions('AD');
    await source.localities('AD');
    expect(localDumpLines).toHaveBeenCalledTimes(1);
  });
});

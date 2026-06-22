import { describe, expect, it } from 'vitest';

import { AD_DUMP_LINES, adCountryInfoText } from './__fixtures__/ad';
import { parseCountryInfo, parseDump } from './parse';

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe('parseDump', () => {
  it('maps tab columns to typed fields', async () => {
    const rows = await collect(parseDump(AD_DUMP_LINES));
    const adm1 = rows.find((r) => r.geonameId === '3040684');
    expect(adm1).toMatchObject({
      name: 'Andorra la Vella',
      featureClass: 'A',
      featureCode: 'ADM1',
      countryCode: 'AD',
      admin1: '07',
      latitude: '42.5',
      longitude: '1.52',
    });
  });

  it('skips blank and malformed (<19 column) lines', async () => {
    const rows = await collect(parseDump(['', 'malformed\trow', ...AD_DUMP_LINES]));
    // 11 fixture lines, 1 of which is malformed → 10 valid rows.
    expect(rows).toHaveLength(10);
  });
});

describe('parseCountryInfo', () => {
  it('indexes by ISO code and ignores comment lines', () => {
    const info = parseCountryInfo(adCountryInfoText());
    expect(info.get('AD')).toEqual({ name: 'Andorra', population: '77006', geonameId: '3041565' });
    expect(info.has('#ISO')).toBe(false);
  });
});

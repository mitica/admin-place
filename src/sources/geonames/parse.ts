/** One row of the GeoNames "geoname" table (all fields kept as raw strings). */
export interface GeoNamesRow {
  geonameId: string;
  name: string;
  asciiName: string;
  alternateNames: string;
  latitude: string;
  longitude: string;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  cc2: string;
  admin1: string;
  admin2: string;
  admin3: string;
  admin4: string;
  population: string;
  elevation: string;
  dem: string;
  timezone: string;
  modificationDate: string;
}

const COLUMN_COUNT = 19;

/**
 * Parse the tab-separated GeoNames per-country dump into typed rows. Accepts
 * any (async) iterable of lines, so production can feed a `readline` stream and
 * tests can feed an array. Blank lines and rows with too few columns are
 * skipped rather than throwing, to tolerate occasional dump irregularities.
 */
export async function* parseDump(
  lines: AsyncIterable<string> | Iterable<string>,
): AsyncGenerator<GeoNamesRow> {
  for await (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') continue;
    const p = line.split('\t');
    if (p.length < COLUMN_COUNT) continue;
    yield {
      geonameId: p[0] ?? '',
      name: p[1] ?? '',
      asciiName: p[2] ?? '',
      alternateNames: p[3] ?? '',
      latitude: p[4] ?? '',
      longitude: p[5] ?? '',
      featureClass: p[6] ?? '',
      featureCode: p[7] ?? '',
      countryCode: p[8] ?? '',
      cc2: p[9] ?? '',
      admin1: p[10] ?? '',
      admin2: p[11] ?? '',
      admin3: p[12] ?? '',
      admin4: p[13] ?? '',
      population: p[14] ?? '',
      elevation: p[15] ?? '',
      dem: p[16] ?? '',
      timezone: p[17] ?? '',
      modificationDate: p[18] ?? '',
    };
  }
}

export interface CountryInfo {
  name: string;
  geonameId: string;
  population: string;
}

/**
 * Parse GeoNames `countryInfo.txt` into a map keyed by ISO 3166-1 alpha-2 code.
 * Comment lines (starting with `#`) and blank lines are ignored.
 */
export function parseCountryInfo(text: string): Map<string, CountryInfo> {
  const result = new Map<string, CountryInfo>();
  for (const raw of text.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '' || line.startsWith('#')) continue;
    const p = line.split('\t');
    const iso = p[0] ?? '';
    if (iso === '') continue;
    result.set(iso, {
      name: p[4] ?? '',
      population: p[7] ?? '',
      geonameId: p[16] ?? '',
    });
  }
  return result;
}

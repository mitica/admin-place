import type { AdminDivision, Country, Locality } from '../../schemas';
import type { Source } from '../source';
import { fetchCountryDumpLines, fetchCountryInfoText, type GeoNamesFetchOptions } from './download';
import { parseCountryInfo, parseDump, type GeoNamesRow } from './parse';
import {
  isAdminRow,
  isLocalityRow,
  localityParentId,
  rowToAdminDivision,
  rowToLocality,
} from './transform';

export interface GeoNamesSourceOptions extends GeoNamesFetchOptions {
  /** ISO 3166-1 alpha-2 codes to generate, e.g. ['US', 'RO']. */
  countryCodes: string[];
  /** Test seam: supply dump lines for a country instead of downloading. */
  localDumpLines?: (countryCode: string) => Promise<AsyncIterable<string> | Iterable<string>>;
  /** Test seam: supply countryInfo.txt text instead of downloading. */
  countryInfoText?: () => Promise<string>;
}

interface ParsedCountry {
  admins: AdminDivision[];
  localities: Locality[];
}

/**
 * A `Source` backed by GeoNames per-country dumps. Each country's dump is
 * parsed once (memoized) and split into admin divisions (feature class 'A',
 * codes ADM1..ADM5) and populated places (class 'P', population > 0). Localities
 * are attached to the deepest admin division that exists, falling back to the
 * country.
 */
export class GeoNamesSource implements Source {
  private readonly parsed = new Map<string, Promise<ParsedCountry>>();

  constructor(private readonly options: GeoNamesSourceOptions) {}

  async countries(): Promise<Country[]> {
    const text = this.options.countryInfoText
      ? await this.options.countryInfoText()
      : await fetchCountryInfoText(this.options);
    const info = parseCountryInfo(text);

    return this.options.countryCodes.map((code) => {
      const entry = info.get(code);
      if (entry === undefined) {
        throw new Error(`country "${code}" not found in countryInfo.txt`);
      }
      const country: Country = { id: code, name: entry.name };
      if (entry.geonameId !== '') country.geonameId = entry.geonameId;
      const population = Number(entry.population);
      if (Number.isInteger(population) && population > 0) country.population = population;
      return country;
    });
  }

  async adminDivisions(countryCode: string): Promise<AdminDivision[]> {
    return (await this.parseCountry(countryCode)).admins;
  }

  async localities(countryCode: string): Promise<Locality[]> {
    return (await this.parseCountry(countryCode)).localities;
  }

  private parseCountry(countryCode: string): Promise<ParsedCountry> {
    let cached = this.parsed.get(countryCode);
    if (cached === undefined) {
      cached = this.doParseCountry(countryCode);
      this.parsed.set(countryCode, cached);
    }
    return cached;
  }

  private async doParseCountry(countryCode: string): Promise<ParsedCountry> {
    const lines = this.options.localDumpLines
      ? await this.options.localDumpLines(countryCode)
      : await fetchCountryDumpLines(countryCode, this.options);

    const rows: GeoNamesRow[] = [];
    for await (const row of parseDump(lines)) {
      rows.push(row);
    }

    // Pass 1: admin divisions, building the set of ids that actually exist.
    const admins: AdminDivision[] = [];
    const adminIds = new Set<string>();
    for (const row of rows) {
      if (!isAdminRow(row)) continue;
      const division = rowToAdminDivision(row);
      if (division === undefined) continue;
      if (adminIds.has(division.id)) {
        console.warn(`duplicate admin id "${division.id}" in ${countryCode} — skipping`);
        continue;
      }
      adminIds.add(division.id);
      admins.push(division);
    }

    // Pass 2: populated places, clamping each parent to an existing ancestor.
    const localities: Locality[] = [];
    for (const row of rows) {
      if (!isLocalityRow(row)) continue;
      localities.push(rowToLocality(row, localityParentId(row, adminIds, countryCode)));
    }

    return { admins, localities };
  }
}

import { readFile, rm } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

import { indexAdminDivisions, resolveAdm1AncestorId } from './hierarchy';
import {
  DATA_DIR,
  adminDir,
  adminFile,
  countriesFile,
  localitiesDir,
  localitiesFile,
} from './paths';
import {
  AdminDivisionSchema,
  CountrySchema,
  LocalitySchema,
  type AdminDivision,
  type Country,
  type Locality,
} from './schemas';
import { GeoNamesSource } from './sources/geonames/source';
import { SampleSource } from './sources/sample';
import type { Source } from './sources/source';
import { writeRecords } from './writers/json-writer';

export interface GenerateOptions {
  /** Directory to write into. Defaults to the repo's `data/`. */
  dataDir?: string;
  /** Where the data comes from. Defaults to the bundled sample source. */
  source?: Source;
  /**
   * When set, only these countries are (re)generated — their subtrees are
   * replaced and `countries.json` is upserted, leaving other countries on disk
   * untouched. When omitted, the whole data directory is rebuilt.
   */
  countryCodes?: string[];
}

/** Validate every item against `schema`, throwing a readable error on failure. */
function parseAll<T>(schema: z.ZodType<T>, items: unknown[], context: string): T[] {
  return items.map((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      throw new Error(`invalid ${context} at index ${index}: ${z.prettifyError(result.error)}`);
    }
    return result.data;
  });
}

/** Refuse to wipe a path that is suspiciously shallow (e.g. "/" or "/data"). */
function assertSafeToWipe(dataDir: string): void {
  const segments = resolve(dataDir).split(sep).filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`refusing to wipe a top-level path: ${resolve(dataDir)}`);
  }
}

/** Refuse to remove anything that is not strictly inside `dataDir`. */
function assertSafeToWipeSubtree(dataDir: string, target: string): void {
  const rel = relative(resolve(dataDir), resolve(target));
  if (rel === '' || rel.startsWith('..') || rel.startsWith(sep)) {
    throw new Error(`refusing to wipe a path outside the data dir: ${resolve(target)}`);
  }
}

/** Group items by a derived key, preserving insertion order within each group. */
function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

/** Read and validate an existing `countries.json`, or [] if absent/unreadable. */
async function readExistingCountries(dataDir: string): Promise<Country[]> {
  let text: string;
  try {
    text = await readFile(countriesFile(dataDir), 'utf8');
  } catch {
    return [];
  }
  const parsed: unknown = JSON.parse(text);
  return parseAll(CountrySchema, Array.isArray(parsed) ? parsed : [], 'existing country');
}

/** Merge `incoming` over `existing` by id (incoming wins). */
function upsertById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const merged = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

/** Write the admin and locality subtrees for a single country. */
async function writeCountrySubtrees(
  dataDir: string,
  source: Source,
  country: Country,
): Promise<void> {
  const divisions = parseAll(
    AdminDivisionSchema,
    await source.adminDivisions(country.id),
    `admin division (${country.id})`,
  );
  for (const [level, list] of groupBy(divisions, (d: AdminDivision) => d.level)) {
    await writeRecords(adminFile(dataDir, country.id, level), list);
  }

  const index = indexAdminDivisions(divisions);
  const localities = parseAll(
    LocalitySchema,
    await source.localities(country.id),
    `locality (${country.id})`,
  );
  const byAncestor = groupBy(localities, (loc: Locality) =>
    resolveAdm1AncestorId(loc.parentId, index, country.id),
  );
  for (const [adm1Id, list] of byAncestor) {
    await writeRecords(localitiesFile(dataDir, country.id, adm1Id), list);
  }
}

/**
 * Build the `data/` tree from a source. With `countryCodes`, only those
 * countries are replaced (incremental); otherwise the whole tree is rebuilt.
 * Output is deterministic, so unchanged input yields no diff.
 */
export async function generate(options: GenerateOptions = {}): Promise<void> {
  const dataDir = options.dataDir ?? DATA_DIR;
  const source = options.source ?? new SampleSource();
  const incremental = options.countryCodes !== undefined && options.countryCodes.length > 0;

  const countries = parseAll(CountrySchema, await source.countries(), 'country');

  if (!incremental) {
    assertSafeToWipe(dataDir);
    await rm(dataDir, { recursive: true, force: true });
    await writeRecords(countriesFile(dataDir), countries);
    for (const country of countries) {
      await writeCountrySubtrees(dataDir, source, country);
    }
    return;
  }

  const requested = new Set(options.countryCodes);
  const targets = countries.filter((country) => requested.has(country.id));
  const missing = [...requested].filter((code) => !targets.some((c) => c.id === code));
  if (missing.length > 0) {
    throw new Error(`source did not provide requested countries: ${missing.join(', ')}`);
  }

  const merged = upsertById(await readExistingCountries(dataDir), targets);
  await writeRecords(countriesFile(dataDir), merged);
  for (const country of targets) {
    for (const dir of [adminDir(dataDir, country.id), localitiesDir(dataDir, country.id)]) {
      assertSafeToWipeSubtree(dataDir, dir);
      await rm(dir, { recursive: true, force: true });
    }
    await writeCountrySubtrees(dataDir, source, country);
  }
}

/** True when this module is the process entry point (not imported by a test). */
function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return moduleUrl === pathToFileURL(entry).href;
}

if (isMain(import.meta.url)) {
  const codes = process.argv.slice(2).map((code) => code.toUpperCase());
  const invalid = codes.filter((code) => !/^[A-Z]{2}$/.test(code));
  if (invalid.length > 0) {
    console.error(`invalid country code(s): ${invalid.join(', ')} (expected ISO 3166-1 alpha-2)`);
    process.exit(1);
  }

  const run =
    codes.length > 0
      ? generate({ source: new GeoNamesSource({ countryCodes: codes }), countryCodes: codes })
      : generate();

  run
    .then(() => {
      console.log(
        codes.length > 0
          ? `Generated ${codes.join(', ')} into ${DATA_DIR}`
          : `Generated data into ${DATA_DIR}`,
      );
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

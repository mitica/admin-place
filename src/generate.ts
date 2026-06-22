import { rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

import { indexAdminDivisions, resolveAdm1AncestorId } from './hierarchy';
import { DATA_DIR, adminFile, countriesFile, localitiesFile } from './paths';
import {
  AdminDivisionSchema,
  CountrySchema,
  LocalitySchema,
  type AdminDivision,
  type Locality,
} from './schemas';
import { SampleSource } from './sources/sample';
import type { Source } from './sources/source';
import { writeRecords } from './writers/json-writer';

export interface GenerateOptions {
  /** Directory to write into. Defaults to the repo's `data/`. */
  dataDir?: string;
  /** Where the data comes from. Defaults to the bundled sample source. */
  source?: Source;
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

/**
 * Build the full `data/` tree from a source. Wipes the data directory first so
 * the result is a clean, deterministic full regeneration with no stale files.
 */
export async function generate(options: GenerateOptions = {}): Promise<void> {
  const dataDir = options.dataDir ?? DATA_DIR;
  const source = options.source ?? new SampleSource();

  assertSafeToWipe(dataDir);
  await rm(dataDir, { recursive: true, force: true });

  const countries = parseAll(CountrySchema, await source.countries(), 'country');
  await writeRecords(countriesFile(dataDir), countries);

  for (const country of countries) {
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
}

/** True when this module is the process entry point (not imported by a test). */
function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return moduleUrl === pathToFileURL(entry).href;
}

if (isMain(import.meta.url)) {
  generate()
    .then(() => {
      console.log(`Generated data into ${DATA_DIR}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

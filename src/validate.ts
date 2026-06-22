import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

import { resolveAdm1AncestorId, type AdminIndex } from './hierarchy';
import { DATA_DIR, countriesFile } from './paths';
import { AdminDivisionSchema, CountrySchema, LocalitySchema, type AdminDivision } from './schemas';

/** Read a file expected to contain a JSON array; report and return [] on failure. */
async function readJsonArray(
  filePath: string,
  label: string,
  problems: string[],
): Promise<unknown[]> {
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch {
    problems.push(`${label}: cannot read file`);
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    problems.push(`${label}: invalid JSON (${(error as Error).message})`);
    return [];
  }
  if (!Array.isArray(parsed)) {
    problems.push(`${label}: expected a JSON array`);
    return [];
  }
  return parsed;
}

/** Subdirectory names directly under `root` (empty when `root` is absent). */
async function listDirs(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** `.json` file names directly under `dir`. */
async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Validate each item, and check ids are unique and sorted within the file. */
function checkRecords<T extends { id: string }>(
  items: unknown[],
  schema: z.ZodType<T>,
  label: string,
  problems: string[],
): T[] {
  const valid: T[] = [];
  const seen = new Set<string>();
  let previousId: string | undefined;
  items.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      problems.push(`${label}[${index}]: ${z.prettifyError(result.error)}`);
      return;
    }
    const record = result.data;
    if (seen.has(record.id)) {
      problems.push(`${label}: duplicate id "${record.id}"`);
    }
    seen.add(record.id);
    if (previousId !== undefined && previousId > record.id) {
      problems.push(`${label}: not sorted by id ("${record.id}" follows "${previousId}")`);
    }
    previousId = record.id;
    valid.push(record);
  });
  return valid;
}

/**
 * Validate the committed `data/` tree: schema conformance, unique/sorted ids,
 * level↔filename agreement, and referential integrity of the parent chain.
 * Returns a list of human-readable problems (empty when valid).
 */
export async function validateData(dataDir: string): Promise<string[]> {
  const problems: string[] = [];

  const countries = checkRecords(
    await readJsonArray(countriesFile(dataDir), 'countries.json', problems),
    CountrySchema,
    'countries.json',
    problems,
  );
  const countryIds = new Set(countries.map((c) => c.id));

  // Admin divisions — per country, per level. Build an index for locality checks.
  const adminRoot = join(dataDir, 'admin');
  const adminIndexByCountry = new Map<string, AdminIndex>();
  for (const cc of await listDirs(adminRoot)) {
    if (!countryIds.has(cc)) {
      problems.push(`admin/${cc}: country not present in countries.json`);
    }
    const index: AdminIndex = new Map();
    const divisions: AdminDivision[] = [];
    for (const file of await listJsonFiles(join(adminRoot, cc))) {
      const label = `admin/${cc}/${file}`;
      const expectedLevel = Number(file.replace(/\.json$/, ''));
      const records = checkRecords(
        await readJsonArray(join(adminRoot, cc, file), label, problems),
        AdminDivisionSchema,
        label,
        problems,
      );
      for (const division of records) {
        if (division.level !== expectedLevel) {
          problems.push(
            `${label}: "${division.id}" has level ${division.level}, expected ${expectedLevel}`,
          );
        }
        index.set(division.id, division);
        divisions.push(division);
      }
    }
    for (const division of divisions) {
      if (division.level === 1) {
        if (division.parentId !== cc) {
          problems.push(
            `admin/${cc}: ADM1 "${division.id}" parentId "${division.parentId}" is not country "${cc}"`,
          );
        }
        continue;
      }
      const parent = index.get(division.parentId);
      if (parent === undefined) {
        problems.push(`admin/${cc}: "${division.id}" parentId "${division.parentId}" not found`);
      } else if (parent.level !== division.level - 1) {
        problems.push(
          `admin/${cc}: "${division.id}" parent "${parent.id}" is level ${parent.level}, expected ${division.level - 1}`,
        );
      }
    }
    adminIndexByCountry.set(cc, index);
  }

  // Localities — grouped per ADM1 ancestor; the file name must equal that ancestor.
  const localitiesRoot = join(dataDir, 'localities');
  for (const cc of await listDirs(localitiesRoot)) {
    if (!countryIds.has(cc)) {
      problems.push(`localities/${cc}: country not present in countries.json`);
    }
    const index: AdminIndex = adminIndexByCountry.get(cc) ?? new Map();
    for (const file of await listJsonFiles(join(localitiesRoot, cc))) {
      const label = `localities/${cc}/${file}`;
      const expectedAncestor = file.replace(/\.json$/, '');
      const records = checkRecords(
        await readJsonArray(join(localitiesRoot, cc, file), label, problems),
        LocalitySchema,
        label,
        problems,
      );
      for (const locality of records) {
        if (locality.parentId !== cc && !index.has(locality.parentId)) {
          problems.push(`${label}: "${locality.id}" parentId "${locality.parentId}" not found`);
          continue;
        }
        let ancestor: string;
        try {
          ancestor = resolveAdm1AncestorId(locality.parentId, index, cc);
        } catch (error) {
          problems.push(`${label}: "${locality.id}" ${(error as Error).message}`);
          continue;
        }
        if (ancestor !== expectedAncestor) {
          problems.push(
            `${label}: "${locality.id}" belongs to ADM1 ancestor "${ancestor}", not file "${expectedAncestor}"`,
          );
        }
      }
    }
  }

  return problems;
}

/** True when this module is the process entry point (not imported by a test). */
function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return moduleUrl === pathToFileURL(entry).href;
}

if (isMain(import.meta.url)) {
  validateData(DATA_DIR)
    .then((problems) => {
      if (problems.length === 0) {
        console.log('✓ data is valid');
        return;
      }
      console.error(`✗ ${problems.length} problem(s) found:`);
      for (const problem of problems) {
        console.error(`  - ${problem}`);
      }
      process.exit(1);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

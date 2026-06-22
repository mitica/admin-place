import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root — `src/` lives directly under it. */
export const ROOT_DIR = join(here, '..');

/**
 * Default data directory. Overridable via `ADMIN_PLACE_DATA_DIR` for ad-hoc
 * runs; tests pass an explicit directory to `generate`/`validateData` instead.
 */
export const DATA_DIR = process.env.ADMIN_PLACE_DATA_DIR ?? join(ROOT_DIR, 'data');

export const countriesFile = (dataDir: string): string => join(dataDir, 'countries.json');

export const adminDir = (dataDir: string, countryCode: string): string =>
  join(dataDir, 'admin', countryCode);

export const adminFile = (dataDir: string, countryCode: string, level: number): string =>
  join(adminDir(dataDir, countryCode), `${level}.json`);

export const localitiesDir = (dataDir: string, countryCode: string): string =>
  join(dataDir, 'localities', countryCode);

export const localitiesFile = (dataDir: string, countryCode: string, adm1Id: string): string =>
  join(localitiesDir(dataDir, countryCode), `${adm1Id}.json`);

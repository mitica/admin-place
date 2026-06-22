import type { AdminDivision, Locality } from '../../schemas';
import type { GeoNamesRow } from './parse';

/** Admin feature codes we model. Historical (ADM*H) and ADMD are excluded. */
export const ADMIN_FEATURE_CODES: ReadonlySet<string> = new Set([
  'ADM1',
  'ADM2',
  'ADM3',
  'ADM4',
  'ADM5',
]);

/** GeoNames uses "00" as an "unknown/general" admin1 sentinel — treat as absent. */
const isAbsentCode = (code: string): boolean => code === '' || code === '00';

/** `ADM3` → 3. Returns NaN for non-admin codes. */
export function adminLevel(featureCode: string): number {
  return ADMIN_FEATURE_CODES.has(featureCode) ? Number(featureCode.slice(3)) : Number.NaN;
}

export function isAdminRow(row: GeoNamesRow): boolean {
  return (
    row.featureClass === 'A' &&
    ADMIN_FEATURE_CODES.has(row.featureCode) &&
    ['ADM1'].includes(row.featureCode)
  );
}

export function isLocalityRow(row: GeoNamesRow): boolean {
  return row.featureClass === 'P' && toPopulation(row.population) > 0;
}

/** The admin code columns in order. */
function adminCodes(row: GeoNamesRow): string[] {
  return [row.admin1, row.admin2, row.admin3, row.admin4];
}

/**
 * The dot-concatenated id for an admin row (e.g. "US.CA.037"), or undefined if
 * the row's own admin codes for its level are incomplete (malformed).
 */
export function adminDotId(row: GeoNamesRow): string | undefined {
  const level = adminLevel(row.featureCode);
  if (!Number.isInteger(level) || level < 1) return undefined;
  const codes = adminCodes(row).slice(0, level);
  if (codes.length < level || codes.some(isAbsentCode)) return undefined;
  return [row.countryCode, ...codes].join('.');
}

/** Drop the last segment of a dot-id; an ADM1's parent is the country code. */
export function adminParentId(dotId: string): string {
  return dotId.split('.').slice(0, -1).join('.');
}

/**
 * Resolve a locality's parent id: the deepest admin ancestor that actually
 * exists, walking up the place's admin codes. Falls back to the country code
 * when no ancestor exists (guaranteeing referential integrity).
 */
export function localityParentId(
  row: GeoNamesRow,
  existingAdminIds: ReadonlySet<string>,
  countryCode: string,
): string {
  const segments: string[] = [];
  for (const code of adminCodes(row)) {
    if (isAbsentCode(code)) break;
    segments.push(code);
  }
  for (let depth = segments.length; depth >= 1; depth--) {
    const candidate = [countryCode, ...segments.slice(0, depth)].join('.');
    if (existingAdminIds.has(candidate)) return candidate;
  }
  return countryCode;
}

function toPopulation(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toCoord(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** Common base fields derived from a row. `population` is omitted unless > 0. */
function baseFields(row: GeoNamesRow): {
  id: string;
  name: string;
  geonameId: string;
  featureClass: string;
  featureCode: string;
  population?: number;
  lat?: number;
  lng?: number;
} {
  const population = toPopulation(row.population);
  const lat = toCoord(row.latitude);
  const lng = toCoord(row.longitude);
  return {
    id: row.geonameId,
    name: row.name,
    geonameId: row.geonameId,
    featureClass: row.featureClass,
    featureCode: row.featureCode,
    ...(population > 0 ? { population } : {}),
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
  };
}

/** Build an `AdminDivision` from an admin row, or undefined if malformed. */
export function rowToAdminDivision(row: GeoNamesRow): AdminDivision | undefined {
  const id = adminDotId(row);
  if (id === undefined) return undefined;
  return {
    ...baseFields(row),
    id,
    level: adminLevel(row.featureCode),
    parentId: adminParentId(id),
  };
}

/** Build a `Locality` from a populated-place row with a resolved parent id. */
export function rowToLocality(row: GeoNamesRow, parentId: string): Locality {
  return {
    ...baseFields(row),
    parentId,
  };
}

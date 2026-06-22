import type { AdminDivision } from './schemas';

/** id → admin division, for resolving parent chains within a single country. */
export type AdminIndex = Map<string, AdminDivision>;

export const indexAdminDivisions = (divisions: AdminDivision[]): AdminIndex =>
  new Map(divisions.map((d) => [d.id, d]));

/**
 * Resolve the id used to group a locality (or division) into a locality shard:
 * the ADM1 (level-1) ancestor reached by walking `parentId` upward.
 *
 * If `parentId` points directly at the country (no admin level in between),
 * the country id is returned. Throws when a parent id cannot be resolved within
 * the index — referential integrity is checked separately, but resolution
 * itself cannot continue past a dangling link.
 */
export function resolveAdm1AncestorId(
  parentId: string,
  index: AdminIndex,
  countryId: string,
): string {
  let current = index.get(parentId);
  if (current === undefined) {
    if (parentId === countryId) return countryId;
    throw new Error(`unresolvable parentId "${parentId}" in country ${countryId}`);
  }
  while (current.level > 1) {
    const parent = index.get(current.parentId);
    if (parent === undefined) {
      throw new Error(
        `admin division "${current.id}" has unresolvable parentId "${current.parentId}"`,
      );
    }
    current = parent;
  }
  return current.id;
}

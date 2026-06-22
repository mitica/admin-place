import { z } from 'zod';

import { placeBaseShape } from './base';

/** Shallowest and deepest supported administrative levels (ADM1..ADM5). */
export const ADMIN_LEVEL_MIN = 1;
export const ADMIN_LEVEL_MAX = 5;

/**
 * An administrative division at any level. `id` is the dot-concatenated
 * GeoNames code ("US.CA", "US.CA.037"). `parentId` is the country id for an
 * ADM1 division ("US") or the parent division's id for deeper levels ("US.CA").
 */
export const AdminDivisionSchema = z.strictObject({
  ...placeBaseShape,
  level: z.number().int().min(ADMIN_LEVEL_MIN).max(ADMIN_LEVEL_MAX),
  parentId: z.string().min(1),
});

export type AdminDivision = z.infer<typeof AdminDivisionSchema>;

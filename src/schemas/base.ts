import { z } from 'zod';

/**
 * Fields shared by every GeoNames place (admin divisions and localities).
 * Exposed as a plain shape object so each entity can spread it into its own
 * `z.strictObject({...})` — this keeps strictness explicit and avoids relying
 * on `.extend()` semantics.
 *
 * `id`, `name`, `geonameId`, `featureClass`, `featureCode` are always present.
 * `population`/`lat`/`lng` are populated from the GeoNames dump when available.
 * `wikidataId`/`names`/`wikipediaTitles` are defined for forward-compatibility
 * but are NOT populated in v1 (they require the alternateNames enrichment that
 * is deferred); adding them later is a purely additive change.
 */
export const placeBaseShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  geonameId: z.string().regex(/^[1-9][0-9]*$/),
  featureClass: z.string().length(1),
  featureCode: z.string().min(1),
  population: z.number().int().nonnegative().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  wikidataId: z
    .string()
    .regex(/^Q[1-9][0-9]*$/)
    .optional(),
  names: z.record(z.string(), z.string()).optional(),
  wikipediaTitles: z.record(z.string(), z.string()).optional(),
} as const;

export const PlaceBaseSchema = z.strictObject(placeBaseShape);

export type PlaceBase = z.infer<typeof PlaceBaseSchema>;

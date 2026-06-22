import { z } from 'zod';

/**
 * A populated place. `id` is the GeoNames geonameId as a string. `parentId` is
 * the id of its deepest parent admin division, or the country id when the
 * locality is attached directly to the country.
 */
export const LocalitySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1),
});

export type Locality = z.infer<typeof LocalitySchema>;
